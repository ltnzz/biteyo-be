/**
 * Migration runner sederhana untuk file .sql di folder drizzle/.
 * - File diurutkan by nama (0000... 0014...).
 * - File yang sudah diterapkan dicatat di tabel _migrations.
 *
 * Jalankan: node scripts/run-migrations.mjs
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.join(__dirname, '..', 'drizzle');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL tidak terpasang.');
    process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`
    create table if not exists _migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
    )
`);

const files = fs
    .readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

const { rows } = await pool.query('select filename from _migrations');
const applied = new Set(rows.map((r) => r.filename));

let ran = 0;

for (const file of files) {
    if (applied.has(file)) {
        console.log('=  skip', file);
        continue;
    }

    const sql = fs.readFileSync(path.join(DRIZZLE_DIR, file), 'utf8');
    const client = await pool.connect();

    try {
        await client.query('begin');
        await client.query(sql);
        await client.query(
            'insert into _migrations (filename) values ($1)',
            [file],
        );
        await client.query('commit');
        console.log('> applied', file);
        ran++;
    } catch (err) {
        await client.query('rollback');
        console.error(`x FAILED ${file}: ${err.message}`);
        process.exit(1);
    } finally {
        client.release();
    }
}

await pool.end();
console.log(`\nSelesai. ${ran} migration dijalankan.`);
