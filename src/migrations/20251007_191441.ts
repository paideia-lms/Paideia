import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_assignments_grading_type" AS ENUM('manual', 'peer_review');
  CREATE TYPE "public"."enum_quizzes_questions_question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank', 'matching', 'ordering');
  CREATE TYPE "public"."enum_quizzes_grading_type" AS ENUM('automatic', 'manual');
  CREATE TYPE "public"."enum_discussions_grading_type" AS ENUM('participation', 'quality', 'quantity', 'manual');
  CREATE TYPE "public"."enum_discussions_discussion_type" AS ENUM('general', 'qa', 'debate', 'case_study', 'reflection');
  CREATE TABLE "assignments_allowed_file_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"extension" varchar NOT NULL,
  	"mime_type" varchar NOT NULL
  );
  
  CREATE TABLE "assignments_rubric_levels" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"level" varchar NOT NULL,
  	"description" varchar,
  	"points" numeric NOT NULL
  );
  
  CREATE TABLE "assignments_rubric" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"criterion" varchar NOT NULL,
  	"description" varchar,
  	"points" numeric NOT NULL
  );
  
  CREATE TABLE "assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"instructions" varchar,
  	"due_date" timestamp(3) with time zone,
  	"max_attempts" numeric DEFAULT 1,
  	"allow_late_submissions" boolean DEFAULT false,
  	"points" numeric DEFAULT 100,
  	"grading_type" "enum_assignments_grading_type" DEFAULT 'manual',
  	"max_file_size" numeric DEFAULT 10,
  	"max_files" numeric DEFAULT 1,
  	"require_text_submission" boolean DEFAULT false,
  	"require_file_submission" boolean DEFAULT false,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quizzes_questions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"is_correct" boolean DEFAULT false,
  	"feedback" varchar
  );
  
  CREATE TABLE "quizzes_questions_hints" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hint" varchar NOT NULL
  );
  
  CREATE TABLE "quizzes_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question_text" varchar NOT NULL,
  	"question_type" "enum_quizzes_questions_question_type" NOT NULL,
  	"points" numeric NOT NULL,
  	"correct_answer" varchar,
  	"explanation" varchar
  );
  
  CREATE TABLE "quizzes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"instructions" varchar,
  	"due_date" timestamp(3) with time zone,
  	"max_attempts" numeric DEFAULT 1,
  	"allow_late_submissions" boolean DEFAULT false,
  	"points" numeric DEFAULT 100,
  	"grading_type" "enum_quizzes_grading_type" DEFAULT 'automatic',
  	"time_limit" numeric,
  	"show_correct_answers" boolean DEFAULT false,
  	"allow_multiple_attempts" boolean DEFAULT false,
  	"shuffle_questions" boolean DEFAULT false,
  	"shuffle_answers" boolean DEFAULT false,
  	"show_one_question_at_a_time" boolean DEFAULT false,
  	"require_password" boolean DEFAULT false,
  	"access_password" varchar,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "discussions_rubric_levels" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"level" varchar NOT NULL,
  	"description" varchar,
  	"points" numeric NOT NULL
  );
  
  CREATE TABLE "discussions_rubric" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"criterion" varchar NOT NULL,
  	"description" varchar,
  	"points" numeric NOT NULL
  );
  
  CREATE TABLE "discussions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"instructions" varchar,
  	"due_date" timestamp(3) with time zone,
  	"points" numeric DEFAULT 10,
  	"grading_type" "enum_discussions_grading_type" DEFAULT 'participation',
  	"discussion_type" "enum_discussions_discussion_type" DEFAULT 'general',
  	"require_initial_post" boolean DEFAULT true,
  	"require_replies" boolean DEFAULT true,
  	"min_replies" numeric DEFAULT 2,
  	"min_words_per_post" numeric DEFAULT 50,
  	"allow_attachments" boolean DEFAULT true,
  	"allow_likes" boolean DEFAULT true,
  	"allow_editing" boolean DEFAULT true,
  	"allow_deletion" boolean DEFAULT false,
  	"moderation_required" boolean DEFAULT false,
  	"anonymous_posting" boolean DEFAULT false,
  	"group_discussion" boolean DEFAULT false,
  	"max_group_size" numeric,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "activity_modules" ADD COLUMN "assignment_id" integer;
  ALTER TABLE "activity_modules" ADD COLUMN "quiz_id" integer;
  ALTER TABLE "activity_modules" ADD COLUMN "discussion_id" integer;
  ALTER TABLE "assignment_submissions" ADD COLUMN "assignment_id" integer NOT NULL;
  ALTER TABLE "quiz_submissions" ADD COLUMN "quiz_id" integer NOT NULL;
  ALTER TABLE "discussion_submissions" ADD COLUMN "discussion_id" integer NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "assignments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quizzes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "discussions_id" integer;
  ALTER TABLE "assignments_allowed_file_types" ADD CONSTRAINT "assignments_allowed_file_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignments_rubric_levels" ADD CONSTRAINT "assignments_rubric_levels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."assignments_rubric"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignments_rubric" ADD CONSTRAINT "assignments_rubric_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quizzes_questions_options" ADD CONSTRAINT "quizzes_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes_questions_hints" ADD CONSTRAINT "quizzes_questions_hints_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes_questions" ADD CONSTRAINT "quizzes_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussions_rubric_levels" ADD CONSTRAINT "discussions_rubric_levels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discussions_rubric"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rubric" ADD CONSTRAINT "discussions_rubric_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions" ADD CONSTRAINT "discussions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "assignments_allowed_file_types_order_idx" ON "assignments_allowed_file_types" USING btree ("_order");
  CREATE INDEX "assignments_allowed_file_types_parent_id_idx" ON "assignments_allowed_file_types" USING btree ("_parent_id");
  CREATE INDEX "assignments_rubric_levels_order_idx" ON "assignments_rubric_levels" USING btree ("_order");
  CREATE INDEX "assignments_rubric_levels_parent_id_idx" ON "assignments_rubric_levels" USING btree ("_parent_id");
  CREATE INDEX "assignments_rubric_order_idx" ON "assignments_rubric" USING btree ("_order");
  CREATE INDEX "assignments_rubric_parent_id_idx" ON "assignments_rubric" USING btree ("_parent_id");
  CREATE INDEX "assignments_created_by_idx" ON "assignments" USING btree ("created_by_id");
  CREATE INDEX "assignments_updated_at_idx" ON "assignments" USING btree ("updated_at");
  CREATE INDEX "assignments_created_at_idx" ON "assignments" USING btree ("created_at");
  CREATE INDEX "createdBy_1_idx" ON "assignments" USING btree ("created_by_id");
  CREATE INDEX "dueDate_idx" ON "assignments" USING btree ("due_date");
  CREATE INDEX "quizzes_questions_options_order_idx" ON "quizzes_questions_options" USING btree ("_order");
  CREATE INDEX "quizzes_questions_options_parent_id_idx" ON "quizzes_questions_options" USING btree ("_parent_id");
  CREATE INDEX "quizzes_questions_hints_order_idx" ON "quizzes_questions_hints" USING btree ("_order");
  CREATE INDEX "quizzes_questions_hints_parent_id_idx" ON "quizzes_questions_hints" USING btree ("_parent_id");
  CREATE INDEX "quizzes_questions_order_idx" ON "quizzes_questions" USING btree ("_order");
  CREATE INDEX "quizzes_questions_parent_id_idx" ON "quizzes_questions" USING btree ("_parent_id");
  CREATE INDEX "quizzes_created_by_idx" ON "quizzes" USING btree ("created_by_id");
  CREATE INDEX "quizzes_updated_at_idx" ON "quizzes" USING btree ("updated_at");
  CREATE INDEX "quizzes_created_at_idx" ON "quizzes" USING btree ("created_at");
  CREATE INDEX "createdBy_2_idx" ON "quizzes" USING btree ("created_by_id");
  CREATE INDEX "dueDate_1_idx" ON "quizzes" USING btree ("due_date");
  CREATE INDEX "discussions_rubric_levels_order_idx" ON "discussions_rubric_levels" USING btree ("_order");
  CREATE INDEX "discussions_rubric_levels_parent_id_idx" ON "discussions_rubric_levels" USING btree ("_parent_id");
  CREATE INDEX "discussions_rubric_order_idx" ON "discussions_rubric" USING btree ("_order");
  CREATE INDEX "discussions_rubric_parent_id_idx" ON "discussions_rubric" USING btree ("_parent_id");
  CREATE INDEX "discussions_created_by_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "discussions_updated_at_idx" ON "discussions" USING btree ("updated_at");
  CREATE INDEX "discussions_created_at_idx" ON "discussions" USING btree ("created_at");
  CREATE INDEX "createdBy_3_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "dueDate_2_idx" ON "discussions" USING btree ("due_date");
  CREATE INDEX "discussionType_idx" ON "discussions" USING btree ("discussion_type");
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_assignments_fk" FOREIGN KEY ("assignments_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quizzes_fk" FOREIGN KEY ("quizzes_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discussions_fk" FOREIGN KEY ("discussions_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activity_modules_assignment_idx" ON "activity_modules" USING btree ("assignment_id");
  CREATE INDEX "activity_modules_quiz_idx" ON "activity_modules" USING btree ("quiz_id");
  CREATE INDEX "activity_modules_discussion_idx" ON "activity_modules" USING btree ("discussion_id");
  CREATE INDEX "assignment_idx" ON "activity_modules" USING btree ("assignment_id");
  CREATE INDEX "quiz_idx" ON "activity_modules" USING btree ("quiz_id");
  CREATE INDEX "discussion_idx" ON "activity_modules" USING btree ("discussion_id");
  CREATE INDEX "assignment_submissions_assignment_idx" ON "assignment_submissions" USING btree ("assignment_id");
  CREATE INDEX "quiz_submissions_quiz_idx" ON "quiz_submissions" USING btree ("quiz_id");
  CREATE INDEX "discussion_submissions_discussion_idx" ON "discussion_submissions" USING btree ("discussion_id");
  CREATE INDEX "payload_locked_documents_rels_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("assignments_id");
  CREATE INDEX "payload_locked_documents_rels_quizzes_id_idx" ON "payload_locked_documents_rels" USING btree ("quizzes_id");
  CREATE INDEX "payload_locked_documents_rels_discussions_id_idx" ON "payload_locked_documents_rels" USING btree ("discussions_id");
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
  DROP TYPE "public"."enum_activity_modules_grading_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_modules_grading_type" AS ENUM('manual', 'automatic', 'peer_review');
  ALTER TABLE "assignments_allowed_file_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assignments_rubric_levels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assignments_rubric" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assignments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quizzes_questions_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quizzes_questions_hints" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quizzes_questions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quizzes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussions_rubric_levels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussions_rubric" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "assignments_allowed_file_types" CASCADE;
  DROP TABLE "assignments_rubric_levels" CASCADE;
  DROP TABLE "assignments_rubric" CASCADE;
  DROP TABLE "assignments" CASCADE;
  DROP TABLE "quizzes_questions_options" CASCADE;
  DROP TABLE "quizzes_questions_hints" CASCADE;
  DROP TABLE "quizzes_questions" CASCADE;
  DROP TABLE "quizzes" CASCADE;
  DROP TABLE "discussions_rubric_levels" CASCADE;
  DROP TABLE "discussions_rubric" CASCADE;
  DROP TABLE "discussions" CASCADE;
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_assignment_id_assignments_id_fk";
  
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_quiz_id_quizzes_id_fk";
  
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_discussion_id_discussions_id_fk";
  
  ALTER TABLE "assignment_submissions" DROP CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk";
  
  ALTER TABLE "quiz_submissions" DROP CONSTRAINT "quiz_submissions_quiz_id_quizzes_id_fk";
  
  ALTER TABLE "discussion_submissions" DROP CONSTRAINT "discussion_submissions_discussion_id_discussions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_assignments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quizzes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_discussions_fk";
  
  DROP INDEX "activity_modules_assignment_idx";
  DROP INDEX "activity_modules_quiz_idx";
  DROP INDEX "activity_modules_discussion_idx";
  DROP INDEX "assignment_idx";
  DROP INDEX "quiz_idx";
  DROP INDEX "discussion_idx";
  DROP INDEX "assignment_submissions_assignment_idx";
  DROP INDEX "quiz_submissions_quiz_idx";
  DROP INDEX "discussion_submissions_discussion_idx";
  DROP INDEX "payload_locked_documents_rels_assignments_id_idx";
  DROP INDEX "payload_locked_documents_rels_quizzes_id_idx";
  DROP INDEX "payload_locked_documents_rels_discussions_id_idx";
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
  ALTER TABLE "activity_modules" DROP COLUMN "assignment_id";
  ALTER TABLE "activity_modules" DROP COLUMN "quiz_id";
  ALTER TABLE "activity_modules" DROP COLUMN "discussion_id";
  ALTER TABLE "assignment_submissions" DROP COLUMN "assignment_id";
  ALTER TABLE "quiz_submissions" DROP COLUMN "quiz_id";
  ALTER TABLE "discussion_submissions" DROP COLUMN "discussion_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "assignments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quizzes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "discussions_id";
  DROP TYPE "public"."enum_assignments_grading_type";
  DROP TYPE "public"."enum_quizzes_questions_question_type";
  DROP TYPE "public"."enum_quizzes_grading_type";
  DROP TYPE "public"."enum_discussions_grading_type";
  DROP TYPE "public"."enum_discussions_discussion_type";`)
}
