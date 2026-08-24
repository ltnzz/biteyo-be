import request from 'supertest';

import app from '../src/index.js';

describe('API contract', () => {
    describe('GET /', () => {
        it('responds 200 with API running', async () => {
            const res = await request(app).get('/');

            expect(res.status).toBe(200);
            expect(res.text).toBe('API running');
        });
    });

    describe('unknown routes', () => {
        it('responds 404 with JSON error from centralized handler', async () => {
            const res = await request(app).get('/api/does-not-exist');

            expect(res.status).toBe(404);
            expect(res.headers['content-type']).toMatch(/json/);
            expect(res.body.message).toContain('not found');
        });
    });

    describe('POST /api/auth/signup', () => {
        it('rejects invalid payload with 400 before touching DB', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({ username: 'ab', email: 'not-an-email' });

            expect(res.status).toBe(400);
        });

        it('rejects weak password with 400', async () => {
            const res = await request(app).post('/api/auth/signup').send({
                username: 'validuser',
                email: 'valid@example.com',
                password: 'short',
                confirm_password: 'short',
            });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/signin', () => {
        it('rejects missing password with 400', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'valid@example.com' });

            expect(res.status).toBe(400);
        });

        it('rejects missing email with 400', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({ password: 'password123' });

            expect(res.status).toBe(400);
        });
    });

    describe('protected routes without token', () => {
        it.each([
            ['GET', '/api/feed/bites'],
            ['GET', '/api/feed/categories'],
            ['GET', '/api/auth/me'],
            ['GET', '/api/notifications/'],
            ['DELETE', '/api/notifications/some-id'],
        ])('%s %s responds 401', async (method, url) => {
            const res = await request(app)[method.toLowerCase()](url);

            expect(res.status).toBe(401);
            expect(res.headers['content-type']).toMatch(/json/);
        });
    });

    describe('DELETE /api/notifications/:id ownership', () => {
        it('responds 401 without auth cookie', async () => {
            const res = await request(app).delete(
                '/api/notifications/00000000-0000-0000-0000-000000000000',
            );

            expect(res.status).toBe(401);
        });
    });

    describe('viral score util (single source of truth)', () => {
        it('matches the DB functional index formula weights', async () => {
            const { calculateViralScore, VIRAL_WEIGHTS } = await import(
                '../src/utils/viral.js'
            );

            // index di 0011: views*1 + likes*3 + comments*5
            expect(VIRAL_WEIGHTS).toEqual({
                views: 1,
                likes: 3,
                comments: 5,
            });
            expect(
                calculateViralScore({
                    viewsCount: 10,
                    likesCount: 2,
                    commentsCount: 1,
                })
            ).toBe(21);
        });
    });
});
