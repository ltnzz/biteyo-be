-- Ubah tipe kolom bites.id dan foreign key yang mengarah ke bites.id menjadi varchar(36)
-- agar bisa menampung ID ringkas 10-12 karakter (nanoid) dan tetap kompatibel dengan data lama

ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_bite_id_bites_id_fk";
ALTER TABLE "likes" DROP CONSTRAINT IF EXISTS "likes_bite_id_bites_id_fk";
ALTER TABLE "saved" DROP CONSTRAINT IF EXISTS "saved_bite_id_bites_id_fk";
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_bite_id_bites_id_fk";
ALTER TABLE "bite_mentions" DROP CONSTRAINT IF EXISTS "bite_mentions_bite_id_bites_id_fk";
ALTER TABLE "comment_mentions" DROP CONSTRAINT IF EXISTS "comment_mentions_bite_id_bites_id_fk";

ALTER TABLE "bites" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "bites" ALTER COLUMN "id" SET DATA TYPE varchar(36) USING "id"::text;

ALTER TABLE "comments" ALTER COLUMN "bite_id" SET DATA TYPE varchar(36) USING "bite_id"::text;
ALTER TABLE "likes" ALTER COLUMN "bite_id" SET DATA TYPE varchar(36) USING "bite_id"::text;
ALTER TABLE "saved" ALTER COLUMN "bite_id" SET DATA TYPE varchar(36) USING "bite_id"::text;
ALTER TABLE "notifications" ALTER COLUMN "bite_id" SET DATA TYPE varchar(36) USING "bite_id"::text;
ALTER TABLE "bite_mentions" ALTER COLUMN "bite_id" SET DATA TYPE varchar(36) USING "bite_id"::text;
ALTER TABLE "comment_mentions" ALTER COLUMN "bite_id" SET DATA TYPE varchar(36) USING "bite_id"::text;

ALTER TABLE "comments" ADD CONSTRAINT "comments_bite_id_bites_id_fk" FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "likes" ADD CONSTRAINT "likes_bite_id_bites_id_fk" FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "saved" ADD CONSTRAINT "saved_bite_id_bites_id_fk" FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_bite_id_bites_id_fk" FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bite_mentions" ADD CONSTRAINT "bite_mentions_bite_id_bites_id_fk" FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_bite_id_bites_id_fk" FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id") ON DELETE cascade ON UPDATE no action;
