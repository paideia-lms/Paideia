import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "user_grades" DROP CONSTRAINT "user_grades_user_id_users_id_fk";
  
  DROP INDEX "user_grades_user_idx";
  DROP INDEX "user_gradebookItem_idx";
  DROP INDEX "user_idx";
  ALTER TABLE "courses" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "enrollments" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "activity_modules" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "merge_requests" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "user_grades" ADD COLUMN "enrollment_id" integer NOT NULL;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "user_grades_enrollment_idx" ON "user_grades" USING btree ("enrollment_id");
  CREATE UNIQUE INDEX "enrollment_gradebookItem_idx" ON "user_grades" USING btree ("enrollment_id","gradebook_item_id");
  CREATE INDEX "enrollment_idx" ON "user_grades" USING btree ("enrollment_id");
  ALTER TABLE "user_grades" DROP COLUMN "user_id";
  ALTER TABLE "user_grades" DROP COLUMN "status";
  DROP TYPE "public"."enum_user_grades_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_user_grades_status" AS ENUM('not_graded', 'graded', 'excused', 'missing');
  ALTER TABLE "user_grades" DROP CONSTRAINT "user_grades_enrollment_id_enrollments_id_fk";
  
  DROP INDEX "user_grades_enrollment_idx";
  DROP INDEX "enrollment_gradebookItem_idx";
  DROP INDEX "enrollment_idx";
  ALTER TABLE "courses" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "enrollments" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "activity_modules" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "merge_requests" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "user_grades" ADD COLUMN "user_id" integer NOT NULL;
  ALTER TABLE "user_grades" ADD COLUMN "status" "enum_user_grades_status" DEFAULT 'not_graded';
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "user_grades_user_idx" ON "user_grades" USING btree ("user_id");
  CREATE UNIQUE INDEX "user_gradebookItem_idx" ON "user_grades" USING btree ("user_id","gradebook_item_id");
  CREATE INDEX "user_idx" ON "user_grades" USING btree ("user_id");
  ALTER TABLE "user_grades" DROP COLUMN "enrollment_id";`)
}
