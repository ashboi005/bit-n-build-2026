CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"level" text DEFAULT 'new' NOT NULL,
	"known_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"holdings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"past_theses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" text NOT NULL,
	"day_index" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;