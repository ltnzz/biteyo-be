import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query("delete from users where email like 'smoke-%@test.local'");
console.log('test user smoke dibersihkan');
await pool.end();
