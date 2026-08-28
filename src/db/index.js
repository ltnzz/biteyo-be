import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const maxConnections = process.env.PG_POOL_MAX
    ? Number.parseInt(process.env.PG_POOL_MAX, 10)
    : process.env.NODE_ENV === 'production'
      ? 2
      : 10;

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number.isNaN(maxConnections) || maxConnections <= 0 ? 10 : maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool);
