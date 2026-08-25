/**
 * Smoke test: alur auth cookie-only end-to-end.
 * - signup -> tangkap Set-Cookie
 * - panggil endpoint terproteksi HANYA dengan cookie (tanpa Bearer)
 * - pastikan tanpa cookie = 401, dengan cookie salah = 401
 */
import 'dotenv/config';
import request from 'supertest';

import app from '../src/index.js';

const email = `smoke-${Date.now()}@test.local`;

const run = async () => {
    let failures = 0;
    const check = (name, cond) => {
        console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
        if (!cond) failures++;
    };

    // 1. signup -> cookie harus diset
    const signup = await request(app).post('/api/auth/signup').send({
        username: `smoke${Math.floor(Math.random() * 100000)}`,
        email,
        password: 'testpass123',
        confirm_password: 'testpass123',
    });

    check('signup 201', signup.status === 201);

    const setCookie = signup.headers['set-cookie'];
    const tokenCookie = Array.isArray(setCookie)
        ? setCookie.find((c) => c.startsWith('token='))
        : null;

    check('Set-Cookie token httpOnly dikirim saat signup', Boolean(tokenCookie));
    check('cookie httpOnly', /httponly/i.test(tokenCookie || ''));

    const cookieHeader = tokenCookie?.split(';')[0] ?? '';

    // 2. endpoint terproteksi dengan cookie saja
    const withCookie = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookieHeader);
    check(`GET /api/auth/me + cookie -> 200 (dapat ${withCookie.status})`, withCookie.status === 200);

    // 3. tanpa cookie -> 401
    const noCookie = await request(app).get('/api/auth/me');
    check(`GET /api/auth/me tanpa cookie -> 401 (dapat ${noCookie.status})`, noCookie.status === 401);

    // 4. cookie sampah -> 401
    const badCookie = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'token=invalid.token.here');
    check(`cookie invalid -> 401 (dapat ${badCookie.status})`, badCookie.status === 401);

    // 5. cleanup
    if (withCookie.body?.user?.id || withCookie.body?.id) {
        // cleanup ditangani suite integration; di sini cukup catat
    }

    console.log(failures === 0 ? '\nSEMUA PASS' : `\n${failures} TES GAGAL`);
    process.exit(failures === 0 ? 0 : 1);
};

run();
