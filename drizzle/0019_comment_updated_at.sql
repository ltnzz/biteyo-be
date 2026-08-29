-- Tambah updatedAt untuk edit komentar
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
