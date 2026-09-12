CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"concept_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_decision" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"action" text NOT NULL,
	"quantity" real,
	"price_per_share" real,
	"thesis" text,
	"investigation_summary" text,
	"reasoning" text,
	"outcome" text DEFAULT 'unresolved' NOT NULL,
	"outcome_note" text,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "age_band" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "primary_goal" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "risk_comfort" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "experience" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "monthly_budget" integer;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "horizon" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "onboarded_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_decision" ADD CONSTRAINT "user_decision_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_thread_idx" ON "chat_message" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "user_decision_user_idx" ON "user_decision" USING btree ("user_id");