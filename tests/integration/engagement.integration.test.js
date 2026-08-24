/**
 * Integration test engagement & notifikasi dengan database nyata.
 *
 * Self-contained: membuat dua user via signup + satu bite via SQL,
 * sehingga bisa jalan di database kosong (CI maupun lokal).
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

const signupUser = async (username) => {
    const email = `${TEST_EMAIL_PREFIX}${Date.now()}-${username}@test.local`;
    const res = await request(app).post('/api/auth/signup').send({
        username,
        email,
        password: 'testpass123',
        confirm_password: 'testpass123',
    });

    if (res.status !== 201) {
        throw new Error(`signup ${username} gagal: ${res.status}`);
    }

    return { email, token: res.body.token };
};

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
    let ownerToken;
    let actorToken;
    let biteId;

    beforeAll(async () => {
        pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

        // dua user: pemilik bite dan aktor engagement
        const owner = await signupUser(`owner${Math.floor(Math.random() * 100000)}`);
        const actor = await signupUser(`actor${Math.floor(Math.random() * 100000)}`);
        ownerToken = owner.token;
        actorToken = actor.token;

        // bite milik "owner", dibuat langsung via SQL agar test
        // tidak bergantung pada Supabase Storage
        const ownerIdRow = await query('select id from users where email = $1', [
            owner.email,
        ]);

        const { rows } = await query(
            `insert into bites (
                user_id, food_name, location_name, review, rating,
                photo_url, category, created_at
            ) values (
                $1, 'Test Sate', 'Jakarta', 'enak sekali', 5,
                'https://example.com/test.jpg', 'street_food', now()
            )
            returning id`,
            [ownerIdRow.rows[0].id],
        );

        biteId = rows[0].id;
    }, 60000);

    afterAll(async () => {
        if (pool) {
            await query('delete from users where email like $1', [
                `${TEST_EMAIL_PREFIX}%`,
            ]);
            await pool.end();
        }
    });

    test('siklus like -> notifikasi trigger -> unlike konsisten', async () => {
        const beforeNotifs = await query(
            `select count(*)::int as n from notifications
             where type = 'like' and bite_id = $1`,
            [biteId],
        );

        // LIKE oleh aktor (bukan pemilik) -> trigger harus buat notifikasi
        const liked = await request(app)
            .post(`/api/feed/bites/${biteId}/like`)
            .set('Authorization', `Bearer ${actorToken}`);

        expect([200, 201]).toContain(liked.status);
        expect(liked.body.liked).toBe(true);

        const afterLike = await dbBiteState(biteId);
        expect(afterLike.storedLikes).toBe(afterLike.actualLikes);
        expect(afterLike.actualLikes).toBe(1);

        const likeNotifs = await query(
            `select count(*)::int as n from notifications
             where type = 'like' and bite_id = $1`,
            [biteId],
        );
        expect(likeNotifs.rows[0].n).toBe(beforeNotifs.rows[0].n + 1);

        // UNLIKE
        const unliked = await request(app)
            .post(`/api/feed/bites/${biteId}/like`)
            .set('Authorization', `Bearer ${actorToken}`);

        expect(unliked.status).toBe(200);
        expect(unliked.body.liked).toBe(false);

        const afterUnlike = await dbBiteState(biteId);
        expect(afterUnlike.storedLikes).toBe(afterUnlike.actualLikes);
        expect(afterUnlike.actualLikes).toBe(0);
    });

    test('komentar: counter sinkron + notifikasi dibuat trigger DB', async () => {
        const beforeComments = await query(
            `select count(*)::int as n from notifications
             where type = 'comment' and bite_id = $1`,
            [biteId],
        );

        const res = await request(app)
            .post(`/api/feed/bites/${biteId}/comments`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ content: 'komentar integration test' });

        expect(res.status).toBe(201);

        const state = await dbBiteState(biteId);
        expect(state.actualComments).toBe(1);
        expect(state.storedComments).toBe(state.actualComments);

        const commentNotifs = await query(
            `select count(*)::int as n from notifications
             where type = 'comment' and bite_id = $1`,
            [biteId],
        );
        expect(commentNotifs.rows[0].n).toBe(beforeComments.rows[0].n + 1);
    });
});
