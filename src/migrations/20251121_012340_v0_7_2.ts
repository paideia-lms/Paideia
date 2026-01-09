import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Note: This migration makes weight columns nullable to support auto-weighting.
  // Existing rows with weight = 0 (from previous default) will remain as 0.
  // The application treats null as "auto-weighted" and 0 as "explicitly 0 weight".
  // No data backfilling is needed as existing 0 values are preserved intentionally.
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_direction" AS ENUM('ltr', 'rtl');
  ALTER TABLE "gradebook_categories" ALTER COLUMN "weight" DROP DEFAULT;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" DROP DEFAULT;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" DROP NOT NULL;
  ALTER TABLE "users" ADD COLUMN "direction" "enum_users_direction" DEFAULT 'ltr' NOT NULL;
  ALTER TABLE "gradebook_categories" ADD COLUMN "extra_credit" boolean DEFAULT false;
  ALTER TABLE "discussion_submissions" ADD COLUMN "grade" numeric;
  ALTER TABLE "discussion_submissions" ADD COLUMN "feedback" varchar;
  ALTER TABLE "discussion_submissions" ADD COLUMN "graded_by_id" integer;
  ALTER TABLE "discussion_submissions" ADD COLUMN "graded_at" timestamp(3) with time zone;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_graded_by_id_users_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "discussion_submissions_graded_by_idx" ON "discussion_submissions" USING btree ("graded_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Update NULL weight values to 0 before setting NOT NULL constraint
  await db.execute(sql`
    UPDATE "gradebook_items" SET "weight" = 0 WHERE "weight" IS NULL;
  
   ALTER TABLE "discussion_submissions" DROP CONSTRAINT "discussion_submissions_graded_by_id_users_id_fk";
  
  DROP INDEX "discussion_submissions_graded_by_idx";
  ALTER TABLE "gradebook_categories" ALTER COLUMN "weight" SET DEFAULT 0;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" SET DEFAULT 0;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" SET NOT NULL;
  ALTER TABLE "users" DROP COLUMN "direction";
  ALTER TABLE "gradebook_categories" DROP COLUMN "extra_credit";
  ALTER TABLE "discussion_submissions" DROP COLUMN "grade";
  ALTER TABLE "discussion_submissions" DROP COLUMN "feedback";
  ALTER TABLE "discussion_submissions" DROP COLUMN "graded_by_id";
  ALTER TABLE "discussion_submissions" DROP COLUMN "graded_at";
  DROP TYPE "public"."enum_users_direction";`)
}
