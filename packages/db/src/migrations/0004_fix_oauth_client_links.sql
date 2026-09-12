-- Better Auth stores OAuth client references by the public client_id, not the
-- internal oauthClient.id. Repair links created by the original migration.
ALTER TABLE "oauthClientResource" DROP CONSTRAINT IF EXISTS "oauthClientResource_client_id_oauthClient_id_fk";
ALTER TABLE "oauthClientResource" DROP CONSTRAINT IF EXISTS "oauthClientResource_resource_id_oauthResource_id_fk";
ALTER TABLE "oauthConsent" DROP CONSTRAINT IF EXISTS "oauthConsent_client_id_oauthClient_id_fk";
ALTER TABLE "oauthRefreshToken" DROP CONSTRAINT IF EXISTS "oauthRefreshToken_client_id_oauthClient_id_fk";
ALTER TABLE "oauthAccessToken" DROP CONSTRAINT IF EXISTS "oauthAccessToken_client_id_oauthClient_id_fk";
--> statement-breakpoint
UPDATE "oauthClientResource" AS link
SET "client_id" = client."client_id"
FROM "oauthClient" AS client
WHERE link."client_id" = client."id";
--> statement-breakpoint
UPDATE "oauthClientResource" AS link
SET "resource_id" = resource."identifier"
FROM "oauthResource" AS resource
WHERE link."resource_id" = resource."id";
--> statement-breakpoint
UPDATE "oauthConsent" AS consent
SET "client_id" = client."client_id"
FROM "oauthClient" AS client
WHERE consent."client_id" = client."id";
--> statement-breakpoint
UPDATE "oauthRefreshToken" AS token
SET "client_id" = client."client_id"
FROM "oauthClient" AS client
WHERE token."client_id" = client."id";
--> statement-breakpoint
UPDATE "oauthAccessToken" AS token
SET "client_id" = client."client_id"
FROM "oauthClient" AS client
WHERE token."client_id" = client."id";
--> statement-breakpoint
ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_client_id_oauthClient_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauthClient"("client_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_resource_id_oauthResource_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."oauthResource"("identifier") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "oauthConsent" ADD CONSTRAINT "oauthConsent_client_id_oauthClient_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauthClient"("client_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "oauthRefreshToken" ADD CONSTRAINT "oauthRefreshToken_client_id_oauthClient_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauthClient"("client_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "oauthAccessToken" ADD CONSTRAINT "oauthAccessToken_client_id_oauthClient_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauthClient"("client_id") ON DELETE no action ON UPDATE no action;
