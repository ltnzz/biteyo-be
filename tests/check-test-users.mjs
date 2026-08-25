import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query("select email from users where email like '%@test.local'");
console.log('sisa test user:', r.rows.length === 0 ? 'tidak ada' : r.rows.map((x) => x.email).join(', '));
await pool.end();
