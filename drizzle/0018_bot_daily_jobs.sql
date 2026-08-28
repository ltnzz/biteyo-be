-- Idempotency untuk cron daily upload: satu baris per tanggal UTC
CREATE TABLE IF NOT EXISTS "bot_daily_jobs" (
    "job_date" date PRIMARY KEY,
    "bite_id" varchar(36) REFERENCES "bites"("id") ON DELETE SET NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
