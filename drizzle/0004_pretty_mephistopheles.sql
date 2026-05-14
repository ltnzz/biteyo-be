CREATE TABLE "fcm_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bites" ALTER COLUMN "food_name" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "bites" ALTER COLUMN "photo_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "message" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "bio" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "bites" ADD COLUMN "location_name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "bites" ADD COLUMN "location_address" text;--> statement-breakpoint
ALTER TABLE "bites" ADD COLUMN "latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "bites" ADD COLUMN "longitude" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "bites" ADD COLUMN "place_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bites" ADD COLUMN "views_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bites" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fcm_tokens_token_unique" ON "fcm_tokens" USING btree ("token");--> statement-breakpoint
ALTER TABLE "bites" DROP COLUMN "location";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "location";