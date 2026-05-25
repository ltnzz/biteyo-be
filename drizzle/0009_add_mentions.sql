ALTER TYPE "public"."notif_type" ADD VALUE IF NOT EXISTS 'mention';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bite_mentions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "bite_id" uuid NOT NULL,
    "mentioned_user_id" uuid NOT NULL,
    "mentioned_by_user_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "comment_mentions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "comment_id" uuid NOT NULL,
    "bite_id" uuid NOT NULL,
    "mentioned_user_id" uuid NOT NULL,
    "mentioned_by_user_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bite_mentions_bite_id_bites_id_fk'
    ) THEN
        ALTER TABLE "bite_mentions"
        ADD CONSTRAINT "bite_mentions_bite_id_bites_id_fk"
        FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bite_mentions_mentioned_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "bite_mentions"
        ADD CONSTRAINT "bite_mentions_mentioned_user_id_users_id_fk"
        FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bite_mentions_mentioned_by_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "bite_mentions"
        ADD CONSTRAINT "bite_mentions_mentioned_by_user_id_users_id_fk"
        FOREIGN KEY ("mentioned_by_user_id") REFERENCES "public"."users"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comment_mentions_comment_id_comments_id_fk'
    ) THEN
        ALTER TABLE "comment_mentions"
        ADD CONSTRAINT "comment_mentions_comment_id_comments_id_fk"
        FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comment_mentions_bite_id_bites_id_fk'
    ) THEN
        ALTER TABLE "comment_mentions"
        ADD CONSTRAINT "comment_mentions_bite_id_bites_id_fk"
        FOREIGN KEY ("bite_id") REFERENCES "public"."bites"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comment_mentions_mentioned_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "comment_mentions"
        ADD CONSTRAINT "comment_mentions_mentioned_user_id_users_id_fk"
        FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comment_mentions_mentioned_by_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "comment_mentions"
        ADD CONSTRAINT "comment_mentions_mentioned_by_user_id_users_id_fk"
        FOREIGN KEY ("mentioned_by_user_id") REFERENCES "public"."users"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
END
$$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "bite_mentions_bite_user_unique"
ON "bite_mentions" ("bite_id", "mentioned_user_id");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "comment_mentions_comment_user_unique"
ON "comment_mentions" ("comment_id", "mentioned_user_id");--> statement-breakpoint

DO $$
DECLARE
    realtime_table text;
BEGIN
    FOREACH realtime_table IN ARRAY ARRAY[
        'bite_mentions',
        'comment_mentions'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = realtime_table
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                realtime_table
            );
        END IF;
    END LOOP;
END
$$;
