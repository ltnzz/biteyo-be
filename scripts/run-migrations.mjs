/**
 * Migration runner sederhana untuk file .sql di folder drizzle/.
 * - File diurutkan by nama (0000... 0014...).
 * - File yang sudah diterapkan dicatat di tabel _migrations.
 *
 * Jalankan:
 *   node scripts/run-migrations.mjs                 -> jalankan migrasi yang belum diterapkan
 *   node scripts/run-migrations.mjs --seed-history  -> catat semua file lama sebagai "sudah diterapkan"
 *                                                      tanpa eksekusi (untuk DB yang sudah termigrasi manual)
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.join(__dirname, '..', 'drizzle');
const SEED_HISTORY = process.argv.includes('--seed-history');

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

if (SEED_HISTORY) {
    const inserted = await pool.query(
        `insert into _migrations (filename)
         select unnest($1::text[])
         on conflict (filename) do nothing`,
        [files],
    );

    await pool.end();
    console.log(
        `\nSeed history selesai. ${inserted.rowCount} file tercatat, total ${files.length} dikenal.`,
    );
    process.exit(0);
}

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
