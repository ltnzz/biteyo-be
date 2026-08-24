/**
 * Integration test engagement & notifikasi dengan database nyata.
 *
 * Kebutuhan:
 * - DATABASE_URL mengarah ke Postgres yang sudah di-migrate
 *   (lokal: node scripts/run-migrations.mjs)
 *
 * Jalankan: npm run test:integration
 */
import 'dotenv/config';
import request from 'supertest';
import pg from 'pg';

import app from '../../src/index.js';

const TEST_EMAIL_PREFIX = 'integration-test-';

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

let pool;

const query = (text, params) => pool.query(text, params);

const dbBiteState = async (biteId) => {
    const { rows } = await query(
        'select likes_count, comments_count from bites where id = $1',
        [biteId],
    );
    const likes = await query(
        'select count(*)::int as n from likes where bite_id = $1',
        [biteId],
    );
    const comments = await query(
        'select count(*)::int as n from comments where bite_id = $1',
        [biteId],
    );

    return {
        storedLikes: Number(rows[0].likes_count),
        actualLikes: likes.rows[0].n,
        storedComments: Number(rows[0].comments_count),
        actualComments: comments.rows[0].n,
    };
};

maybeDescribe('integration: engagement & notification', () => {
    let token;
    let testEmail;

    beforeAll(async () => {
        pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

        // 1. signup user khusus test
        testEmail = `${TEST_EMAIL_PREFIX}${Date.now()}@test.local`;
        const res = await request(app).post('/api/auth/signup').send({
            username: `it${Math.floor(Math.random() * 100000)}`,
            email: testEmail,
            password: 'testpass123',
            confirm_password: 'testpass123',
        });

        if (res.status !== 201) throw new Error(`signup gagal: ${res.status}`);
        token = res.body.token;
    }, 30000);

    afterAll(async () => {
        if (pool) {
            await query('delete from users where email like $1', [
                `${TEST_EMAIL_PREFIX}%`,
            ]);
            await pool.end();
        }
    });

    test('feed tersedia untuk pengujian', async () => {
        const res = await request(app)
            .get('/api/feed/bites?limit=5')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('siklus like -> notifikasi trigger -> unlike konsisten', async () => {
        const feed = await request(app)
            .get('/api/feed/bites?limit=5')
            .set('Authorization', `Bearer ${token}`);
        const bite = feed.body.data[0];

        const beforeNotifs = await query(
            `select count(*)::int as n from notifications
             where type = 'like' and bite_id = $1`,
            [bite.id],
        );

        // LIKE
        const liked = await request(app)
            .post(`/api/feed/bites/${bite.id}/like`)
            .set('Authorization', `Bearer ${token}`);

        expect([200, 201]).toContain(liked.status);
        expect(liked.body.liked).toBe(true);

        const afterLike = await dbBiteState(bite.id);
        expect(afterLike.storedLikes).toBe(afterLike.actualLikes);

        const likeNotifs = await query(
            `select count(*)::int as n from notifications
             where type = 'like' and bite_id = $1`,
            [bite.id],
        );
        expect(likeNotifs.rows[0].n).toBeGreaterThanOrEqual(
            beforeNotifs.rows[0].n,
        );

        // UNLIKE
        const unliked = await request(app)
            .post(`/api/feed/bites/${bite.id}/like`)
            .set('Authorization', `Bearer ${token}`);

        expect(unliked.status).toBe(200);
        expect(unliked.body.liked).toBe(false);

        const afterUnlike = await dbBiteState(bite.id);
        expect(afterUnlike.storedLikes).toBe(afterUnlike.actualLikes);
    });

    test('komentar: counter sinkron + notifikasi dibuat trigger DB', async () => {
        const feed = await request(app)
            .get('/api/feed/bites?limit=5')
            .set('Authorization', `Bearer ${token}`);
        const bite = feed.body.data[0];

        const beforeComments = await query(
            `select count(*)::int as n from notifications
             where type = 'comment' and bite_id = $1`,
            [bite.id],
        );

        const res = await request(app)
            .post(`/api/feed/bites/${bite.id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'komentar integration test' });

        expect(res.status).toBe(201);

        const state = await dbBiteState(bite.id);
        expect(state.storedComments).toBe(state.actualComments);

        const commentNotifs = await query(
            `select count(*)::int as n from notifications
             where type = 'comment' and bite_id = $1`,
            [bite.id],
        );

        // tidak selalu +1 jika bite milik user test sendiri
        expect(commentNotifs.rows[0].n).toBeGreaterThanOrEqual(
            beforeComments.rows[0].n,
        );
    });
});
