import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "dueDate_idx";
  DROP INDEX "dueDate_1_idx";
  DROP INDEX "dueDate_2_idx";
  CREATE INDEX "dueDate_idx" ON "discussions" USING btree ("due_date");
  ALTER TABLE "assignments" DROP COLUMN "due_date";
  ALTER TABLE "assignments" DROP COLUMN "max_attempts";
  ALTER TABLE "assignments" DROP COLUMN "allow_late_submissions";
  ALTER TABLE "quizzes" DROP COLUMN "due_date";
  ALTER TABLE "quizzes" DROP COLUMN "max_attempts";
  ALTER TABLE "quizzes" DROP COLUMN "allow_late_submissions";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "dueDate_idx";
  ALTER TABLE "assignments" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "assignments" ADD COLUMN "max_attempts" numeric DEFAULT 1;
  ALTER TABLE "assignments" ADD COLUMN "allow_late_submissions" boolean DEFAULT false;
  ALTER TABLE "quizzes" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "quizzes" ADD COLUMN "max_attempts" numeric DEFAULT 1;
  ALTER TABLE "quizzes" ADD COLUMN "allow_late_submissions" boolean DEFAULT false;
  CREATE INDEX "dueDate_idx" ON "assignments" USING btree ("due_date");
  CREATE INDEX "dueDate_1_idx" ON "quizzes" USING btree ("due_date");
  CREATE INDEX "dueDate_2_idx" ON "discussions" USING btree ("due_date");`)
}
