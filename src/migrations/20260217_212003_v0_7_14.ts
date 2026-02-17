import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "courses_recurring_schedules_days_of_week" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" numeric NOT NULL
  );
  
  CREATE TABLE "courses_recurring_schedules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone
  );
  
  CREATE TABLE "courses_specific_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL
  );
  
  CREATE TABLE "quiz_submissions_completed_nested_quizzes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"nested_quiz_id" varchar NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone
  );
  
  DELETE FROM "quiz_submissions_flagged_questions" WHERE "question_id" IS NULL;
  ALTER TABLE "quiz_submissions_flagged_questions" ALTER COLUMN "question_id" SET NOT NULL;
  ALTER TABLE "quiz_submissions" ADD COLUMN "is_preview" boolean DEFAULT false;
  ALTER TABLE "quiz_submissions" ADD COLUMN "grade" numeric;
  ALTER TABLE "quiz_submissions" ADD COLUMN "feedback" varchar;
  ALTER TABLE "quiz_submissions" ADD COLUMN "graded_by_id" integer;
  ALTER TABLE "quiz_submissions" ADD COLUMN "graded_at" timestamp(3) with time zone;
  ALTER TABLE "courses_recurring_schedules_days_of_week" ADD CONSTRAINT "courses_recurring_schedules_days_of_week_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_recurring_schedules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_recurring_schedules" ADD CONSTRAINT "courses_recurring_schedules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_specific_dates" ADD CONSTRAINT "courses_specific_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quiz_submissions_completed_nested_quizzes" ADD CONSTRAINT "quiz_submissions_completed_nested_quizzes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_recurring_schedules_days_of_week_order_idx" ON "courses_recurring_schedules_days_of_week" USING btree ("_order");
  CREATE INDEX "courses_recurring_schedules_days_of_week_parent_id_idx" ON "courses_recurring_schedules_days_of_week" USING btree ("_parent_id");
  CREATE INDEX "courses_recurring_schedules_order_idx" ON "courses_recurring_schedules" USING btree ("_order");
  CREATE INDEX "courses_recurring_schedules_parent_id_idx" ON "courses_recurring_schedules" USING btree ("_parent_id");
  CREATE INDEX "courses_specific_dates_order_idx" ON "courses_specific_dates" USING btree ("_order");
  CREATE INDEX "courses_specific_dates_parent_id_idx" ON "courses_specific_dates" USING btree ("_parent_id");
  CREATE INDEX "quiz_submissions_completed_nested_quizzes_order_idx" ON "quiz_submissions_completed_nested_quizzes" USING btree ("_order");
  CREATE INDEX "quiz_submissions_completed_nested_quizzes_parent_id_idx" ON "quiz_submissions_completed_nested_quizzes" USING btree ("_parent_id");
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_graded_by_id_users_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "quiz_submissions_graded_by_idx" ON "quiz_submissions" USING btree ("graded_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_recurring_schedules_days_of_week" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_recurring_schedules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_specific_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quiz_submissions_completed_nested_quizzes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "courses_recurring_schedules_days_of_week" CASCADE;
  DROP TABLE "courses_recurring_schedules" CASCADE;
  DROP TABLE "courses_specific_dates" CASCADE;
  DROP TABLE "quiz_submissions_completed_nested_quizzes" CASCADE;
  ALTER TABLE "quiz_submissions" DROP CONSTRAINT "quiz_submissions_graded_by_id_users_id_fk";
  
  DROP INDEX "quiz_submissions_graded_by_idx";
  ALTER TABLE "quiz_submissions_flagged_questions" ALTER COLUMN "question_id" DROP NOT NULL;
  ALTER TABLE "quiz_submissions" DROP COLUMN "is_preview";
  ALTER TABLE "quiz_submissions" DROP COLUMN "grade";
  ALTER TABLE "quiz_submissions" DROP COLUMN "feedback";
  ALTER TABLE "quiz_submissions" DROP COLUMN "graded_by_id";
  ALTER TABLE "quiz_submissions" DROP COLUMN "graded_at";`)
}
