ALTER TABLE "oauthClientResource" DROP CONSTRAINT IF EXISTS "oauthClientResource_resource_id_oauthResource_id_fk";
ALTER TABLE "oauthClientResource" DROP CONSTRAINT IF EXISTS "oauthClientResource_resource_id_oauthResource_identifier_fk";
--> statement-breakpoint
UPDATE "oauthClientResource" AS link
SET "resource_id" = resource."identifier"
FROM "oauthResource" AS resource
WHERE link."resource_id" = resource."id";
--> statement-breakpoint
ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_resource_id_oauthResource_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."oauthResource"("identifier") ON DELETE cascade ON UPDATE no action;
