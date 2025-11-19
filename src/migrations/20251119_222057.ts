import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discussion_submissions" ADD COLUMN "grade" numeric;
  ALTER TABLE "discussion_submissions" ADD COLUMN "feedback" varchar;
  ALTER TABLE "discussion_submissions" ADD COLUMN "graded_by_id" integer;
  ALTER TABLE "discussion_submissions" ADD COLUMN "graded_at" timestamp(3) with time zone;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_graded_by_id_users_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "discussion_submissions_graded_by_idx" ON "discussion_submissions" USING btree ("graded_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discussion_submissions" DROP CONSTRAINT "discussion_submissions_graded_by_id_users_id_fk";
  
  DROP INDEX "discussion_submissions_graded_by_idx";
  ALTER TABLE "discussion_submissions" DROP COLUMN "grade";
  ALTER TABLE "discussion_submissions" DROP COLUMN "feedback";
  ALTER TABLE "discussion_submissions" DROP COLUMN "graded_by_id";
  ALTER TABLE "discussion_submissions" DROP COLUMN "graded_at";`)
}
