import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "status_idx";
  DROP INDEX "status_1_idx";
  DROP INDEX "status_2_idx";
  DROP INDEX "status_3_idx";
  CREATE INDEX "status_idx" ON "assignment_submissions" USING btree ("status");
  CREATE INDEX "status_1_idx" ON "quiz_submissions" USING btree ("status");
  CREATE INDEX "status_2_idx" ON "discussion_submissions" USING btree ("status");
  ALTER TABLE "activity_modules" DROP COLUMN "status";
  DROP TYPE "public"."enum_activity_modules_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_modules_status" AS ENUM('draft', 'published', 'archived');
  DROP INDEX "status_idx";
  DROP INDEX "status_1_idx";
  DROP INDEX "status_2_idx";
  ALTER TABLE "activity_modules" ADD COLUMN "status" "enum_activity_modules_status" DEFAULT 'draft' NOT NULL;
  CREATE INDEX "status_idx" ON "activity_modules" USING btree ("status");
  CREATE INDEX "status_1_idx" ON "assignment_submissions" USING btree ("status");
  CREATE INDEX "status_2_idx" ON "quiz_submissions" USING btree ("status");
  CREATE INDEX "status_3_idx" ON "discussion_submissions" USING btree ("status");`)
}
