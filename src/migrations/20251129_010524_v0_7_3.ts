import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activity_modules_type" ADD VALUE 'file' BEFORE 'assignment';
  CREATE TABLE "files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "files_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  DROP INDEX "assignment_idx";
  DROP INDEX "dueDate_idx";
  DROP INDEX "dueDate_1_idx";
  DROP INDEX "dueDate_2_idx";
  ALTER TABLE "activity_modules" ADD COLUMN "file_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "files_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "logo_light_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "logo_dark_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "compact_logo_light_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "compact_logo_dark_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "favicon_light_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "favicon_dark_id" integer;
  ALTER TABLE "files" ADD CONSTRAINT "files_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "files_rels" ADD CONSTRAINT "files_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "files_rels" ADD CONSTRAINT "files_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "files_created_by_idx" ON "files" USING btree ("created_by_id");
  CREATE INDEX "files_updated_at_idx" ON "files" USING btree ("updated_at");
  CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");
  CREATE INDEX "createdBy_7_idx" ON "files" USING btree ("created_by_id");
  CREATE INDEX "files_rels_order_idx" ON "files_rels" USING btree ("order");
  CREATE INDEX "files_rels_parent_idx" ON "files_rels" USING btree ("parent_id");
  CREATE INDEX "files_rels_path_idx" ON "files_rels" USING btree ("path");
  CREATE INDEX "files_rels_media_id_idx" ON "files_rels" USING btree ("media_id");
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_logo_light_id_media_id_fk" FOREIGN KEY ("logo_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_logo_dark_id_media_id_fk" FOREIGN KEY ("logo_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_compact_logo_light_id_media_id_fk" FOREIGN KEY ("compact_logo_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_compact_logo_dark_id_media_id_fk" FOREIGN KEY ("compact_logo_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_favicon_light_id_media_id_fk" FOREIGN KEY ("favicon_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_favicon_dark_id_media_id_fk" FOREIGN KEY ("favicon_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_modules_file_idx" ON "activity_modules" USING btree ("file_id");
  CREATE INDEX "file_idx" ON "activity_modules" USING btree ("file_id");
  CREATE INDEX "dueDate_idx" ON "discussions" USING btree ("due_date");
  CREATE INDEX "payload_locked_documents_rels_files_id_idx" ON "payload_locked_documents_rels" USING btree ("files_id");
  CREATE INDEX "appearance_settings_logo_light_idx" ON "appearance_settings" USING btree ("logo_light_id");
  CREATE INDEX "appearance_settings_logo_dark_idx" ON "appearance_settings" USING btree ("logo_dark_id");
  CREATE INDEX "appearance_settings_compact_logo_light_idx" ON "appearance_settings" USING btree ("compact_logo_light_id");
  CREATE INDEX "appearance_settings_compact_logo_dark_idx" ON "appearance_settings" USING btree ("compact_logo_dark_id");
  CREATE INDEX "appearance_settings_favicon_light_idx" ON "appearance_settings" USING btree ("favicon_light_id");
  CREATE INDEX "appearance_settings_favicon_dark_idx" ON "appearance_settings" USING btree ("favicon_dark_id");
  -- Note: These columns are being removed from assignments and quizzes as due dates,
  -- max attempts, and late submission settings are now managed at the activity_module level.
  -- Data loss is acceptable as these fields are being migrated to a different location.
  ALTER TABLE "assignments" DROP COLUMN "due_date";
  ALTER TABLE "assignments" DROP COLUMN "max_attempts";
  ALTER TABLE "assignments" DROP COLUMN "allow_late_submissions";
  ALTER TABLE "quizzes" DROP COLUMN "due_date";
  ALTER TABLE "quizzes" DROP COLUMN "max_attempts";
  ALTER TABLE "quizzes" DROP COLUMN "allow_late_submissions";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "files_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "files" CASCADE;
  DROP TABLE "files_rels" CASCADE;
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_file_id_files_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_files_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_logo_light_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_logo_dark_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_compact_logo_light_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_compact_logo_dark_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_favicon_light_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_favicon_dark_id_media_id_fk";
  
  -- Delete any activity_modules with type='file' before recreating enum without 'file' value.
  -- Data loss is acceptable as we're rolling back the file feature.
  DELETE FROM "activity_modules" WHERE "type" = 'file';
  ALTER TABLE "activity_modules" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_activity_modules_type";
  CREATE TYPE "public"."enum_activity_modules_type" AS ENUM('page', 'whiteboard', 'assignment', 'quiz', 'discussion');
  ALTER TABLE "activity_modules" ALTER COLUMN "type" SET DATA TYPE "public"."enum_activity_modules_type" USING "type"::"public"."enum_activity_modules_type";
  DROP INDEX "activity_modules_file_idx";
  DROP INDEX "file_idx";
  DROP INDEX "dueDate_idx";
  DROP INDEX "payload_locked_documents_rels_files_id_idx";
  DROP INDEX "appearance_settings_logo_light_idx";
  DROP INDEX "appearance_settings_logo_dark_idx";
  DROP INDEX "appearance_settings_compact_logo_light_idx";
  DROP INDEX "appearance_settings_compact_logo_dark_idx";
  DROP INDEX "appearance_settings_favicon_light_idx";
  DROP INDEX "appearance_settings_favicon_dark_idx";
  ALTER TABLE "assignments" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "assignments" ADD COLUMN "max_attempts" numeric DEFAULT 1;
  ALTER TABLE "assignments" ADD COLUMN "allow_late_submissions" boolean DEFAULT false;
  ALTER TABLE "quizzes" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "quizzes" ADD COLUMN "max_attempts" numeric DEFAULT 1;
  ALTER TABLE "quizzes" ADD COLUMN "allow_late_submissions" boolean DEFAULT false;
  CREATE INDEX "assignment_idx" ON "activity_modules" USING btree ("assignment_id");
  CREATE INDEX "dueDate_idx" ON "assignments" USING btree ("due_date");
  CREATE INDEX "dueDate_1_idx" ON "quizzes" USING btree ("due_date");
  CREATE INDEX "dueDate_2_idx" ON "discussions" USING btree ("due_date");
  ALTER TABLE "activity_modules" DROP COLUMN "file_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "files_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "logo_light_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "logo_dark_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "compact_logo_light_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "compact_logo_dark_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "favicon_light_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "favicon_dark_id";`)
}
