import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_modules_grading_type" AS ENUM('manual', 'automatic', 'peer_review');
  CREATE TYPE "public"."enum_assignment_submissions_status" AS ENUM('draft', 'submitted', 'graded', 'returned');
  CREATE TYPE "public"."enum_quiz_submissions_answers_question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank');
  CREATE TYPE "public"."enum_quiz_submissions_status" AS ENUM('in_progress', 'completed', 'graded', 'returned');
  CREATE TYPE "public"."enum_discussion_submissions_post_type" AS ENUM('initial', 'reply', 'comment');
  CREATE TYPE "public"."enum_discussion_submissions_status" AS ENUM('draft', 'published', 'hidden', 'deleted');
  CREATE TYPE "public"."enum_user_grades_adjustments_type" AS ENUM('bonus', 'penalty', 'late_deduction', 'participation', 'curve', 'other');
  CREATE TYPE "public"."enum_user_grades_submission_type" AS ENUM('assignment', 'quiz', 'discussion', 'manual');
  CREATE TYPE "public"."enum_user_grades_base_grade_source" AS ENUM('submission', 'manual');
  CREATE TYPE "public"."enum_user_grades_status" AS ENUM('draft', 'graded', 'returned');
  CREATE TABLE "assignment_submissions_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"file_id" integer NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "assignment_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"activity_module_id" integer NOT NULL,
  	"student_id" integer NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"attempt_number" numeric DEFAULT 1 NOT NULL,
  	"status" "enum_assignment_submissions_status" DEFAULT 'draft' NOT NULL,
  	"submitted_at" timestamp(3) with time zone,
  	"content" varchar,
  	"is_late" boolean DEFAULT false,
  	"time_spent" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quiz_submissions_answers_multiple_choice_answers" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"option" varchar NOT NULL,
  	"is_selected" boolean DEFAULT false
  );
  
  CREATE TABLE "quiz_submissions_answers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question_id" varchar NOT NULL,
  	"question_text" varchar,
  	"question_type" "enum_quiz_submissions_answers_question_type" NOT NULL,
  	"selected_answer" varchar,
  	"is_correct" boolean,
  	"points_earned" numeric,
  	"max_points" numeric,
  	"feedback" varchar
  );
  
  CREATE TABLE "quiz_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"activity_module_id" integer NOT NULL,
  	"student_id" integer NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"attempt_number" numeric DEFAULT 1 NOT NULL,
  	"status" "enum_quiz_submissions_status" DEFAULT 'in_progress' NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone,
  	"time_spent" numeric,
  	"total_score" numeric,
  	"percentage" numeric,
  	"is_late" boolean DEFAULT false,
  	"auto_graded" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "discussion_submissions_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"file_id" integer NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "discussion_submissions_likes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"liked_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "discussion_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"activity_module_id" integer NOT NULL,
  	"student_id" integer NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"parent_post_id" integer,
  	"post_type" "enum_discussion_submissions_post_type" DEFAULT 'initial' NOT NULL,
  	"title" varchar,
  	"content" varchar NOT NULL,
  	"status" "enum_discussion_submissions_status" DEFAULT 'published' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"edited_at" timestamp(3) with time zone,
  	"is_edited" boolean DEFAULT false,
  	"reply_count" numeric DEFAULT 0,
  	"like_count" numeric DEFAULT 0,
  	"is_pinned" boolean DEFAULT false,
  	"is_locked" boolean DEFAULT false,
  	"participation_score" numeric,
  	"quality_score" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "course_grade_tables_grade_letters" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"letter" varchar NOT NULL,
  	"minimum_percentage" numeric NOT NULL
  );
  
  CREATE TABLE "course_grade_tables" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "user_grades_adjustments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_user_grades_adjustments_type" NOT NULL,
  	"points" numeric NOT NULL,
  	"reason" varchar NOT NULL,
  	"applied_by_id" integer NOT NULL,
  	"applied_at" timestamp(3) with time zone NOT NULL,
  	"is_active" boolean DEFAULT true
  );
  
  CREATE TABLE "user_grades_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"assignment_submissions_id" integer,
  	"quiz_submissions_id" integer,
  	"discussion_submissions_id" integer
  );
  
  CREATE TABLE "system_grade_table_grade_letters" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"letter" varchar NOT NULL,
  	"minimum_percentage" numeric NOT NULL
  );
  
  CREATE TABLE "system_grade_table" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  DROP INDEX "enrollment_idx";
  ALTER TABLE "activity_modules" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "activity_modules" ADD COLUMN "max_attempts" numeric DEFAULT 1;
  ALTER TABLE "activity_modules" ADD COLUMN "allow_late_submissions" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "instructions" varchar;
  ALTER TABLE "activity_modules" ADD COLUMN "points" numeric DEFAULT 100;
  ALTER TABLE "activity_modules" ADD COLUMN "grading_type" "enum_activity_modules_grading_type" DEFAULT 'manual';
  ALTER TABLE "activity_modules" ADD COLUMN "time_limit" numeric;
  ALTER TABLE "activity_modules" ADD COLUMN "show_correct_answers" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "allow_multiple_attempts" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "shuffle_questions" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "shuffle_answers" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "show_one_question_at_a_time" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "require_password" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "access_password" varchar;
  ALTER TABLE "user_grades" ADD COLUMN "submission_type" "enum_user_grades_submission_type" DEFAULT 'manual';
  ALTER TABLE "user_grades" ADD COLUMN "base_grade" numeric;
  ALTER TABLE "user_grades" ADD COLUMN "base_grade_source" "enum_user_grades_base_grade_source" DEFAULT 'manual';
  ALTER TABLE "user_grades" ADD COLUMN "is_overridden" boolean DEFAULT false;
  ALTER TABLE "user_grades" ADD COLUMN "override_grade" numeric;
  ALTER TABLE "user_grades" ADD COLUMN "override_reason" varchar;
  ALTER TABLE "user_grades" ADD COLUMN "overridden_by_id" integer;
  ALTER TABLE "user_grades" ADD COLUMN "overridden_at" timestamp(3) with time zone;
  ALTER TABLE "user_grades" ADD COLUMN "status" "enum_user_grades_status" DEFAULT 'draft';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "assignment_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quiz_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "discussion_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_grade_tables_id" integer;
  ALTER TABLE "assignment_submissions_attachments" ADD CONSTRAINT "assignment_submissions_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions_attachments" ADD CONSTRAINT "assignment_submissions_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions_answers_multiple_choice_answers" ADD CONSTRAINT "quiz_submissions_answers_multiple_choice_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_submissions_answers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quiz_submissions_answers" ADD CONSTRAINT "quiz_submissions_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions_attachments" ADD CONSTRAINT "discussion_submissions_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions_attachments" ADD CONSTRAINT "discussion_submissions_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussion_submissions_likes" ADD CONSTRAINT "discussion_submissions_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions_likes" ADD CONSTRAINT "discussion_submissions_likes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_parent_post_id_discussion_submissions_id_fk" FOREIGN KEY ("parent_post_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_grade_tables_grade_letters" ADD CONSTRAINT "course_grade_tables_grade_letters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."course_grade_tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_grade_tables" ADD CONSTRAINT "course_grade_tables_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades_adjustments" ADD CONSTRAINT "user_grades_adjustments_applied_by_id_users_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades_adjustments" ADD CONSTRAINT "user_grades_adjustments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."user_grades"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_grades"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_assignment_submissions_fk" FOREIGN KEY ("assignment_submissions_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_quiz_submissions_fk" FOREIGN KEY ("quiz_submissions_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_discussion_submissions_fk" FOREIGN KEY ("discussion_submissions_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "system_grade_table_grade_letters" ADD CONSTRAINT "system_grade_table_grade_letters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."system_grade_table"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "assignment_submissions_attachments_order_idx" ON "assignment_submissions_attachments" USING btree ("_order");
  CREATE INDEX "assignment_submissions_attachments_parent_id_idx" ON "assignment_submissions_attachments" USING btree ("_parent_id");
  CREATE INDEX "assignment_submissions_attachments_file_idx" ON "assignment_submissions_attachments" USING btree ("file_id");
  CREATE INDEX "assignment_submissions_activity_module_idx" ON "assignment_submissions" USING btree ("activity_module_id");
  CREATE INDEX "assignment_submissions_student_idx" ON "assignment_submissions" USING btree ("student_id");
  CREATE INDEX "assignment_submissions_enrollment_idx" ON "assignment_submissions" USING btree ("enrollment_id");
  CREATE INDEX "assignment_submissions_updated_at_idx" ON "assignment_submissions" USING btree ("updated_at");
  CREATE INDEX "assignment_submissions_created_at_idx" ON "assignment_submissions" USING btree ("created_at");
  CREATE INDEX "activityModule_idx" ON "assignment_submissions" USING btree ("activity_module_id");
  CREATE INDEX "student_idx" ON "assignment_submissions" USING btree ("student_id");
  CREATE INDEX "enrollment_idx" ON "assignment_submissions" USING btree ("enrollment_id");
  CREATE UNIQUE INDEX "activityModule_student_attemptNumber_idx" ON "assignment_submissions" USING btree ("activity_module_id","student_id","attempt_number");
  CREATE INDEX "status_1_idx" ON "assignment_submissions" USING btree ("status");
  CREATE INDEX "submittedAt_idx" ON "assignment_submissions" USING btree ("submitted_at");
  CREATE INDEX "quiz_submissions_answers_multiple_choice_answers_order_idx" ON "quiz_submissions_answers_multiple_choice_answers" USING btree ("_order");
  CREATE INDEX "quiz_submissions_answers_multiple_choice_answers_parent_id_idx" ON "quiz_submissions_answers_multiple_choice_answers" USING btree ("_parent_id");
  CREATE INDEX "quiz_submissions_answers_order_idx" ON "quiz_submissions_answers" USING btree ("_order");
  CREATE INDEX "quiz_submissions_answers_parent_id_idx" ON "quiz_submissions_answers" USING btree ("_parent_id");
  CREATE INDEX "quiz_submissions_activity_module_idx" ON "quiz_submissions" USING btree ("activity_module_id");
  CREATE INDEX "quiz_submissions_student_idx" ON "quiz_submissions" USING btree ("student_id");
  CREATE INDEX "quiz_submissions_enrollment_idx" ON "quiz_submissions" USING btree ("enrollment_id");
  CREATE INDEX "quiz_submissions_updated_at_idx" ON "quiz_submissions" USING btree ("updated_at");
  CREATE INDEX "quiz_submissions_created_at_idx" ON "quiz_submissions" USING btree ("created_at");
  CREATE INDEX "activityModule_1_idx" ON "quiz_submissions" USING btree ("activity_module_id");
  CREATE INDEX "student_1_idx" ON "quiz_submissions" USING btree ("student_id");
  CREATE INDEX "enrollment_1_idx" ON "quiz_submissions" USING btree ("enrollment_id");
  CREATE UNIQUE INDEX "activityModule_student_attemptNumber_1_idx" ON "quiz_submissions" USING btree ("activity_module_id","student_id","attempt_number");
  CREATE INDEX "status_2_idx" ON "quiz_submissions" USING btree ("status");
  CREATE INDEX "submittedAt_1_idx" ON "quiz_submissions" USING btree ("submitted_at");
  CREATE INDEX "totalScore_idx" ON "quiz_submissions" USING btree ("total_score");
  CREATE INDEX "discussion_submissions_attachments_order_idx" ON "discussion_submissions_attachments" USING btree ("_order");
  CREATE INDEX "discussion_submissions_attachments_parent_id_idx" ON "discussion_submissions_attachments" USING btree ("_parent_id");
  CREATE INDEX "discussion_submissions_attachments_file_idx" ON "discussion_submissions_attachments" USING btree ("file_id");
  CREATE INDEX "discussion_submissions_likes_order_idx" ON "discussion_submissions_likes" USING btree ("_order");
  CREATE INDEX "discussion_submissions_likes_parent_id_idx" ON "discussion_submissions_likes" USING btree ("_parent_id");
  CREATE INDEX "discussion_submissions_likes_user_idx" ON "discussion_submissions_likes" USING btree ("user_id");
  CREATE INDEX "discussion_submissions_activity_module_idx" ON "discussion_submissions" USING btree ("activity_module_id");
  CREATE INDEX "discussion_submissions_student_idx" ON "discussion_submissions" USING btree ("student_id");
  CREATE INDEX "discussion_submissions_enrollment_idx" ON "discussion_submissions" USING btree ("enrollment_id");
  CREATE INDEX "discussion_submissions_parent_post_idx" ON "discussion_submissions" USING btree ("parent_post_id");
  CREATE INDEX "discussion_submissions_updated_at_idx" ON "discussion_submissions" USING btree ("updated_at");
  CREATE INDEX "discussion_submissions_created_at_idx" ON "discussion_submissions" USING btree ("created_at");
  CREATE INDEX "activityModule_2_idx" ON "discussion_submissions" USING btree ("activity_module_id");
  CREATE INDEX "student_2_idx" ON "discussion_submissions" USING btree ("student_id");
  CREATE INDEX "enrollment_2_idx" ON "discussion_submissions" USING btree ("enrollment_id");
  CREATE INDEX "parentPost_idx" ON "discussion_submissions" USING btree ("parent_post_id");
  CREATE INDEX "postType_idx" ON "discussion_submissions" USING btree ("post_type");
  CREATE INDEX "status_3_idx" ON "discussion_submissions" USING btree ("status");
  CREATE INDEX "publishedAt_idx" ON "discussion_submissions" USING btree ("published_at");
  CREATE INDEX "isPinned_idx" ON "discussion_submissions" USING btree ("is_pinned");
  CREATE INDEX "likeCount_idx" ON "discussion_submissions" USING btree ("like_count");
  CREATE INDEX "replyCount_idx" ON "discussion_submissions" USING btree ("reply_count");
  CREATE INDEX "course_grade_tables_grade_letters_order_idx" ON "course_grade_tables_grade_letters" USING btree ("_order");
  CREATE INDEX "course_grade_tables_grade_letters_parent_id_idx" ON "course_grade_tables_grade_letters" USING btree ("_parent_id");
  CREATE INDEX "course_grade_tables_course_idx" ON "course_grade_tables" USING btree ("course_id");
  CREATE INDEX "course_grade_tables_updated_at_idx" ON "course_grade_tables" USING btree ("updated_at");
  CREATE INDEX "course_grade_tables_created_at_idx" ON "course_grade_tables" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_1_idx" ON "course_grade_tables" USING btree ("course_id");
  CREATE INDEX "user_grades_adjustments_order_idx" ON "user_grades_adjustments" USING btree ("_order");
  CREATE INDEX "user_grades_adjustments_parent_id_idx" ON "user_grades_adjustments" USING btree ("_parent_id");
  CREATE INDEX "user_grades_adjustments_applied_by_idx" ON "user_grades_adjustments" USING btree ("applied_by_id");
  CREATE INDEX "user_grades_rels_order_idx" ON "user_grades_rels" USING btree ("order");
  CREATE INDEX "user_grades_rels_parent_idx" ON "user_grades_rels" USING btree ("parent_id");
  CREATE INDEX "user_grades_rels_path_idx" ON "user_grades_rels" USING btree ("path");
  CREATE INDEX "user_grades_rels_assignment_submissions_id_idx" ON "user_grades_rels" USING btree ("assignment_submissions_id");
  CREATE INDEX "user_grades_rels_quiz_submissions_id_idx" ON "user_grades_rels" USING btree ("quiz_submissions_id");
  CREATE INDEX "user_grades_rels_discussion_submissions_id_idx" ON "user_grades_rels" USING btree ("discussion_submissions_id");
  CREATE INDEX "system_grade_table_grade_letters_order_idx" ON "system_grade_table_grade_letters" USING btree ("_order");
  CREATE INDEX "system_grade_table_grade_letters_parent_id_idx" ON "system_grade_table_grade_letters" USING btree ("_parent_id");
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_overridden_by_id_users_id_fk" FOREIGN KEY ("overridden_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_assignment_submissions_fk" FOREIGN KEY ("assignment_submissions_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quiz_submissions_fk" FOREIGN KEY ("quiz_submissions_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discussion_submissions_fk" FOREIGN KEY ("discussion_submissions_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_grade_tables_fk" FOREIGN KEY ("course_grade_tables_id") REFERENCES "public"."course_grade_tables"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "createdBy_idx" ON "activity_modules" USING btree ("created_by_id");
  CREATE INDEX "type_idx" ON "activity_modules" USING btree ("type");
  CREATE INDEX "status_idx" ON "activity_modules" USING btree ("status");
  CREATE INDEX "user_grades_overridden_by_idx" ON "user_grades" USING btree ("overridden_by_id");
  CREATE INDEX "enrollment_3_idx" ON "user_grades" USING btree ("enrollment_id");
  CREATE INDEX "payload_locked_documents_rels_assignment_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("assignment_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_quiz_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("quiz_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_discussion_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("discussion_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_course_grade_tables_id_idx" ON "payload_locked_documents_rels" USING btree ("course_grade_tables_id");
  ALTER TABLE "user_grades" DROP COLUMN "grade";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "assignment_submissions_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assignment_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quiz_submissions_answers_multiple_choice_answers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quiz_submissions_answers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quiz_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussion_submissions_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussion_submissions_likes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussion_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "course_grade_tables_grade_letters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "course_grade_tables" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_grades_adjustments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_grades_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "system_grade_table_grade_letters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "system_grade_table" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "assignment_submissions_attachments" CASCADE;
  DROP TABLE "assignment_submissions" CASCADE;
  DROP TABLE "quiz_submissions_answers_multiple_choice_answers" CASCADE;
  DROP TABLE "quiz_submissions_answers" CASCADE;
  DROP TABLE "quiz_submissions" CASCADE;
  DROP TABLE "discussion_submissions_attachments" CASCADE;
  DROP TABLE "discussion_submissions_likes" CASCADE;
  DROP TABLE "discussion_submissions" CASCADE;
  DROP TABLE "course_grade_tables_grade_letters" CASCADE;
  DROP TABLE "course_grade_tables" CASCADE;
  DROP TABLE "user_grades_adjustments" CASCADE;
  DROP TABLE "user_grades_rels" CASCADE;
  DROP TABLE "system_grade_table_grade_letters" CASCADE;
  DROP TABLE "system_grade_table" CASCADE;
  ALTER TABLE "user_grades" DROP CONSTRAINT "user_grades_overridden_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_assignment_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quiz_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_discussion_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_grade_tables_fk";
  
  DROP INDEX "createdBy_idx";
  DROP INDEX "type_idx";
  DROP INDEX "status_idx";
  DROP INDEX "user_grades_overridden_by_idx";
  DROP INDEX "enrollment_3_idx";
  DROP INDEX "payload_locked_documents_rels_assignment_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_quiz_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_discussion_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_course_grade_tables_id_idx";
  ALTER TABLE "user_grades" ADD COLUMN "grade" numeric;
  CREATE INDEX "enrollment_idx" ON "user_grades" USING btree ("enrollment_id");
  ALTER TABLE "activity_modules" DROP COLUMN "due_date";
  ALTER TABLE "activity_modules" DROP COLUMN "max_attempts";
  ALTER TABLE "activity_modules" DROP COLUMN "allow_late_submissions";
  ALTER TABLE "activity_modules" DROP COLUMN "instructions";
  ALTER TABLE "activity_modules" DROP COLUMN "points";
  ALTER TABLE "activity_modules" DROP COLUMN "grading_type";
  ALTER TABLE "activity_modules" DROP COLUMN "time_limit";
  ALTER TABLE "activity_modules" DROP COLUMN "show_correct_answers";
  ALTER TABLE "activity_modules" DROP COLUMN "allow_multiple_attempts";
  ALTER TABLE "activity_modules" DROP COLUMN "shuffle_questions";
  ALTER TABLE "activity_modules" DROP COLUMN "shuffle_answers";
  ALTER TABLE "activity_modules" DROP COLUMN "show_one_question_at_a_time";
  ALTER TABLE "activity_modules" DROP COLUMN "require_password";
  ALTER TABLE "activity_modules" DROP COLUMN "access_password";
  ALTER TABLE "user_grades" DROP COLUMN "submission_type";
  ALTER TABLE "user_grades" DROP COLUMN "base_grade";
  ALTER TABLE "user_grades" DROP COLUMN "base_grade_source";
  ALTER TABLE "user_grades" DROP COLUMN "is_overridden";
  ALTER TABLE "user_grades" DROP COLUMN "override_grade";
  ALTER TABLE "user_grades" DROP COLUMN "override_reason";
  ALTER TABLE "user_grades" DROP COLUMN "overridden_by_id";
  ALTER TABLE "user_grades" DROP COLUMN "overridden_at";
  ALTER TABLE "user_grades" DROP COLUMN "status";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "assignment_submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quiz_submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "discussion_submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_grade_tables_id";
  DROP TYPE "public"."enum_activity_modules_grading_type";
  DROP TYPE "public"."enum_assignment_submissions_status";
  DROP TYPE "public"."enum_quiz_submissions_answers_question_type";
  DROP TYPE "public"."enum_quiz_submissions_status";
  DROP TYPE "public"."enum_discussion_submissions_post_type";
  DROP TYPE "public"."enum_discussion_submissions_status";
  DROP TYPE "public"."enum_user_grades_adjustments_type";
  DROP TYPE "public"."enum_user_grades_submission_type";
  DROP TYPE "public"."enum_user_grades_base_grade_source";
  DROP TYPE "public"."enum_user_grades_status";`)
}
