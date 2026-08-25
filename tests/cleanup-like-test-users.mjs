import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(
    "delete from users where email like 'like-test%@test.local' returning email",
);
console.log('dihapus:', r.rows.map((x) => x.email).join(', '));
await pool.end();
