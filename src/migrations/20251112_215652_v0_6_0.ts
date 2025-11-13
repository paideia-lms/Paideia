import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "courses_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "notes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "site_policies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_media_storage_total" numeric DEFAULT 10737418240,
  	"site_upload_limit" numeric DEFAULT 20971520,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "appearance_settings_additional_css_stylesheets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "appearance_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "media" ADD COLUMN "created_by_id" integer;
  
  UPDATE "media"
  SET "created_by_id" = (
    SELECT "id" FROM "users"
    WHERE "role" = 'admin'
    ORDER BY "id" ASC
    LIMIT 1
  )
  WHERE "created_by_id" IS NULL
  AND EXISTS (SELECT 1 FROM "users" WHERE "role" = 'admin' LIMIT 1);
  
  UPDATE "media"
  SET "created_by_id" = (
    SELECT "id" FROM "users"
    ORDER BY "id" ASC
    LIMIT 1
  )
  WHERE "created_by_id" IS NULL
  AND EXISTS (SELECT 1 FROM "users" LIMIT 1);
  
  ALTER TABLE "media" ALTER COLUMN "created_by_id" SET NOT NULL;
  
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notes_rels" ADD CONSTRAINT "notes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notes_rels" ADD CONSTRAINT "notes_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "appearance_settings_additional_css_stylesheets" ADD CONSTRAINT "appearance_settings_additional_css_stylesheets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."appearance_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_rels_order_idx" ON "courses_rels" USING btree ("order");
  CREATE INDEX "courses_rels_parent_idx" ON "courses_rels" USING btree ("parent_id");
  CREATE INDEX "courses_rels_path_idx" ON "courses_rels" USING btree ("path");
  CREATE INDEX "courses_rels_media_id_idx" ON "courses_rels" USING btree ("media_id");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_media_id_idx" ON "pages_rels" USING btree ("media_id");
  CREATE INDEX "notes_rels_order_idx" ON "notes_rels" USING btree ("order");
  CREATE INDEX "notes_rels_parent_idx" ON "notes_rels" USING btree ("parent_id");
  CREATE INDEX "notes_rels_path_idx" ON "notes_rels" USING btree ("path");
  CREATE INDEX "notes_rels_media_id_idx" ON "notes_rels" USING btree ("media_id");
  CREATE INDEX "appearance_settings_additional_css_stylesheets_order_idx" ON "appearance_settings_additional_css_stylesheets" USING btree ("_order");
  CREATE INDEX "appearance_settings_additional_css_stylesheets_parent_id_idx" ON "appearance_settings_additional_css_stylesheets" USING btree ("_parent_id");
  ALTER TABLE "media" ADD CONSTRAINT "media_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
  CREATE INDEX "media_created_by_idx" ON "media" USING btree ("created_by_id");
  CREATE INDEX "createdBy_6_idx" ON "media" USING btree ("created_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_policies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "appearance_settings_additional_css_stylesheets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "appearance_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "courses_rels" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "notes_rels" CASCADE;
  DROP TABLE "site_policies" CASCADE;
  DROP TABLE "appearance_settings_additional_css_stylesheets" CASCADE;
  DROP TABLE "appearance_settings" CASCADE;
  ALTER TABLE "media" DROP CONSTRAINT "media_created_by_id_users_id_fk";
  
  DROP INDEX "media_created_by_idx";
  DROP INDEX "createdBy_6_idx";
  ALTER TABLE "media" DROP COLUMN "created_by_id";`)
}
