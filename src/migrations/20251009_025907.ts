import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('student', 'instructor', 'admin');
  CREATE TYPE "public"."enum_courses_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_enrollments_role" AS ENUM('student', 'teacher', 'ta', 'manager');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('active', 'inactive', 'completed', 'dropped');
  CREATE TYPE "public"."enum_activity_modules_type" AS ENUM('page', 'whiteboard', 'assignment', 'quiz', 'discussion');
  CREATE TYPE "public"."enum_activity_modules_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_quizzes_questions_question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank', 'matching', 'ordering');
  CREATE TYPE "public"."enum_quizzes_grading_type" AS ENUM('automatic', 'manual');
  CREATE TYPE "public"."enum_discussions_thread_sorting" AS ENUM('recent', 'upvoted', 'active', 'alphabetical');
  CREATE TYPE "public"."enum_assignment_submissions_status" AS ENUM('draft', 'submitted', 'graded', 'returned');
  CREATE TYPE "public"."enum_quiz_submissions_answers_question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank');
  CREATE TYPE "public"."enum_quiz_submissions_status" AS ENUM('in_progress', 'completed', 'graded', 'returned');
  CREATE TYPE "public"."enum_discussion_submissions_post_type" AS ENUM('thread', 'reply', 'comment');
  CREATE TYPE "public"."enum_discussion_submissions_status" AS ENUM('draft', 'published', 'hidden', 'deleted');
  CREATE TYPE "public"."enum_user_grades_adjustments_type" AS ENUM('bonus', 'penalty', 'late_deduction', 'participation', 'curve', 'other');
  CREATE TYPE "public"."enum_user_grades_submission_type" AS ENUM('assignment', 'quiz', 'discussion', 'manual');
  CREATE TYPE "public"."enum_user_grades_base_grade_source" AS ENUM('submission', 'manual');
  CREATE TYPE "public"."enum_user_grades_status" AS ENUM('draft', 'graded', 'returned');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar,
  	"last_name" varchar,
  	"role" "enum_users_role" DEFAULT 'student',
  	"bio" varchar,
  	"avatar_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"_verified" boolean,
  	"_verificationtoken" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "courses_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"structure" jsonb NOT NULL,
  	"status" "enum_courses_status" DEFAULT 'draft' NOT NULL,
  	"thumbnail_id" integer,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "enrollments_groups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"group_path" varchar NOT NULL
  );
  
  CREATE TABLE "enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"course_id" integer NOT NULL,
  	"role" "enum_enrollments_role" NOT NULL,
  	"status" "enum_enrollments_status" DEFAULT 'active' NOT NULL,
  	"enrolled_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activity_modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"type" "enum_activity_modules_type" NOT NULL,
  	"status" "enum_activity_modules_status" DEFAULT 'draft' NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"require_password" boolean DEFAULT false,
  	"access_password" varchar,
  	"assignment_id" integer,
  	"quiz_id" integer,
  	"discussion_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "assignments_allowed_file_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"extension" varchar NOT NULL,
  	"mime_type" varchar NOT NULL
  );
  
  CREATE TABLE "assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"instructions" varchar,
  	"due_date" timestamp(3) with time zone,
  	"max_attempts" numeric DEFAULT 1,
  	"allow_late_submissions" boolean DEFAULT false,
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
  
  CREATE TABLE "discussions_pinned_threads" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"thread_id" integer NOT NULL,
  	"pinned_at" timestamp(3) with time zone NOT NULL,
  	"pinned_by_id" integer NOT NULL
  );
  
  CREATE TABLE "discussions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"instructions" varchar,
  	"due_date" timestamp(3) with time zone,
  	"require_thread" boolean DEFAULT true,
  	"require_replies" boolean DEFAULT true,
  	"min_replies" numeric DEFAULT 2,
  	"min_words_per_post" numeric DEFAULT 50,
  	"allow_attachments" boolean DEFAULT true,
  	"allow_upvotes" boolean DEFAULT true,
  	"allow_editing" boolean DEFAULT true,
  	"allow_deletion" boolean DEFAULT false,
  	"moderation_required" boolean DEFAULT false,
  	"anonymous_posting" boolean DEFAULT false,
  	"group_discussion" boolean DEFAULT false,
  	"max_group_size" numeric,
  	"thread_sorting" "enum_discussions_thread_sorting" DEFAULT 'recent',
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "course_activity_module_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer NOT NULL,
  	"activity_module_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_tablet_url" varchar,
  	"sizes_tablet_width" numeric,
  	"sizes_tablet_height" numeric,
  	"sizes_tablet_mime_type" varchar,
  	"sizes_tablet_filesize" numeric,
  	"sizes_tablet_filename" varchar
  );
  
  CREATE TABLE "notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"content" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gradebooks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gradebook_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"gradebook_id" integer NOT NULL,
  	"parent_id" integer,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"weight" numeric DEFAULT 0,
  	"sort_order" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gradebook_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"gradebook_id" integer NOT NULL,
  	"category_id" integer,
  	"name" varchar NOT NULL,
  	"sort_order" numeric NOT NULL,
  	"description" varchar,
  	"activity_module_id" integer,
  	"max_grade" numeric DEFAULT 100 NOT NULL,
  	"min_grade" numeric DEFAULT 0 NOT NULL,
  	"weight" numeric DEFAULT 0 NOT NULL,
  	"extra_credit" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
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
  	"assignment_id" integer NOT NULL,
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
  	"quiz_id" integer NOT NULL,
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
  
  CREATE TABLE "discussion_submissions_upvotes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"upvoted_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "discussion_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"activity_module_id" integer NOT NULL,
  	"discussion_id" integer NOT NULL,
  	"student_id" integer NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"parent_thread_id" integer,
  	"post_type" "enum_discussion_submissions_post_type" DEFAULT 'thread' NOT NULL,
  	"title" varchar,
  	"content" varchar NOT NULL,
  	"status" "enum_discussion_submissions_status" DEFAULT 'published' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"edited_at" timestamp(3) with time zone,
  	"is_edited" boolean DEFAULT false,
  	"last_activity_at" timestamp(3) with time zone,
  	"is_pinned" boolean DEFAULT false,
  	"is_locked" boolean DEFAULT false,
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
  
  CREATE TABLE "user_grades" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"gradebook_item_id" integer NOT NULL,
  	"submission_type" "enum_user_grades_submission_type" DEFAULT 'manual',
  	"base_grade" numeric,
  	"base_grade_source" "enum_user_grades_base_grade_source" DEFAULT 'manual',
  	"is_overridden" boolean DEFAULT false,
  	"override_grade" numeric,
  	"override_reason" varchar,
  	"overridden_by_id" integer,
  	"overridden_at" timestamp(3) with time zone,
  	"feedback" varchar,
  	"graded_by_id" integer,
  	"graded_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone,
  	"status" "enum_user_grades_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "search" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"priority" numeric,
  	"meta" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "search_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"courses_id" integer
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"courses_id" integer,
  	"enrollments_id" integer,
  	"activity_modules_id" integer,
  	"assignments_id" integer,
  	"quizzes_id" integer,
  	"discussions_id" integer,
  	"course_activity_module_links_id" integer,
  	"media_id" integer,
  	"notes_id" integer,
  	"gradebooks_id" integer,
  	"gradebook_categories_id" integer,
  	"gradebook_items_id" integer,
  	"assignment_submissions_id" integer,
  	"quiz_submissions_id" integer,
  	"discussion_submissions_id" integer,
  	"course_grade_tables_id" integer,
  	"user_grades_id" integer,
  	"search_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_tags" ADD CONSTRAINT "courses_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments_groups" ADD CONSTRAINT "enrollments_groups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignments_allowed_file_types" ADD CONSTRAINT "assignments_allowed_file_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quizzes_questions_options" ADD CONSTRAINT "quizzes_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes_questions_hints" ADD CONSTRAINT "quizzes_questions_hints_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes_questions" ADD CONSTRAINT "quizzes_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussions_pinned_threads" ADD CONSTRAINT "discussions_pinned_threads_thread_id_discussion_submissions_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussions_pinned_threads" ADD CONSTRAINT "discussions_pinned_threads_pinned_by_id_users_id_fk" FOREIGN KEY ("pinned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussions_pinned_threads" ADD CONSTRAINT "discussions_pinned_threads_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions" ADD CONSTRAINT "discussions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebooks" ADD CONSTRAINT "gradebooks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_categories" ADD CONSTRAINT "gradebook_categories_gradebook_id_gradebooks_id_fk" FOREIGN KEY ("gradebook_id") REFERENCES "public"."gradebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_categories" ADD CONSTRAINT "gradebook_categories_parent_id_gradebook_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_gradebook_id_gradebooks_id_fk" FOREIGN KEY ("gradebook_id") REFERENCES "public"."gradebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_category_id_gradebook_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_activity_module_id_course_activity_module_links_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."course_activity_module_links"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions_attachments" ADD CONSTRAINT "assignment_submissions_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions_attachments" ADD CONSTRAINT "assignment_submissions_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions_answers_multiple_choice_answers" ADD CONSTRAINT "quiz_submissions_answers_multiple_choice_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_submissions_answers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quiz_submissions_answers" ADD CONSTRAINT "quiz_submissions_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions_attachments" ADD CONSTRAINT "discussion_submissions_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions_attachments" ADD CONSTRAINT "discussion_submissions_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussion_submissions_upvotes" ADD CONSTRAINT "discussion_submissions_upvotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions_upvotes" ADD CONSTRAINT "discussion_submissions_upvotes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussion_submissions" ADD CONSTRAINT "discussion_submissions_parent_thread_id_discussion_submissions_id_fk" FOREIGN KEY ("parent_thread_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_grade_tables_grade_letters" ADD CONSTRAINT "course_grade_tables_grade_letters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."course_grade_tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_grade_tables" ADD CONSTRAINT "course_grade_tables_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades_adjustments" ADD CONSTRAINT "user_grades_adjustments_applied_by_id_users_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades_adjustments" ADD CONSTRAINT "user_grades_adjustments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."user_grades"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_gradebook_item_id_gradebook_items_id_fk" FOREIGN KEY ("gradebook_item_id") REFERENCES "public"."gradebook_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_overridden_by_id_users_id_fk" FOREIGN KEY ("overridden_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_graded_by_id_users_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_grades"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_assignment_submissions_fk" FOREIGN KEY ("assignment_submissions_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_quiz_submissions_fk" FOREIGN KEY ("quiz_submissions_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_grades_rels" ADD CONSTRAINT "user_grades_rels_discussion_submissions_fk" FOREIGN KEY ("discussion_submissions_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_modules_fk" FOREIGN KEY ("activity_modules_id") REFERENCES "public"."activity_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_assignments_fk" FOREIGN KEY ("assignments_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quizzes_fk" FOREIGN KEY ("quizzes_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discussions_fk" FOREIGN KEY ("discussions_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_activity_module_links_fk" FOREIGN KEY ("course_activity_module_links_id") REFERENCES "public"."course_activity_module_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notes_fk" FOREIGN KEY ("notes_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebooks_fk" FOREIGN KEY ("gradebooks_id") REFERENCES "public"."gradebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebook_categories_fk" FOREIGN KEY ("gradebook_categories_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebook_items_fk" FOREIGN KEY ("gradebook_items_id") REFERENCES "public"."gradebook_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_assignment_submissions_fk" FOREIGN KEY ("assignment_submissions_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quiz_submissions_fk" FOREIGN KEY ("quiz_submissions_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discussion_submissions_fk" FOREIGN KEY ("discussion_submissions_id") REFERENCES "public"."discussion_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_grade_tables_fk" FOREIGN KEY ("course_grade_tables_id") REFERENCES "public"."course_grade_tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_grades_fk" FOREIGN KEY ("user_grades_id") REFERENCES "public"."user_grades"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "system_grade_table_grade_letters" ADD CONSTRAINT "system_grade_table_grade_letters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."system_grade_table"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "courses_tags_order_idx" ON "courses_tags" USING btree ("_order");
  CREATE INDEX "courses_tags_parent_id_idx" ON "courses_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
  CREATE INDEX "courses_thumbnail_idx" ON "courses" USING btree ("thumbnail_id");
  CREATE INDEX "courses_created_by_idx" ON "courses" USING btree ("created_by_id");
  CREATE INDEX "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "courses" USING btree ("created_at");
  CREATE INDEX "enrollments_groups_order_idx" ON "enrollments_groups" USING btree ("_order");
  CREATE INDEX "enrollments_groups_parent_id_idx" ON "enrollments_groups" USING btree ("_parent_id");
  CREATE INDEX "enrollments_user_idx" ON "enrollments" USING btree ("user_id");
  CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_course_idx" ON "enrollments" USING btree ("user_id","course_id");
  CREATE INDEX "activity_modules_created_by_idx" ON "activity_modules" USING btree ("created_by_id");
  CREATE INDEX "activity_modules_assignment_idx" ON "activity_modules" USING btree ("assignment_id");
  CREATE INDEX "activity_modules_quiz_idx" ON "activity_modules" USING btree ("quiz_id");
  CREATE INDEX "activity_modules_discussion_idx" ON "activity_modules" USING btree ("discussion_id");
  CREATE INDEX "activity_modules_updated_at_idx" ON "activity_modules" USING btree ("updated_at");
  CREATE INDEX "activity_modules_created_at_idx" ON "activity_modules" USING btree ("created_at");
  CREATE INDEX "createdBy_idx" ON "activity_modules" USING btree ("created_by_id");
  CREATE INDEX "type_idx" ON "activity_modules" USING btree ("type");
  CREATE INDEX "status_idx" ON "activity_modules" USING btree ("status");
  CREATE INDEX "assignment_idx" ON "activity_modules" USING btree ("assignment_id");
  CREATE INDEX "quiz_idx" ON "activity_modules" USING btree ("quiz_id");
  CREATE INDEX "discussion_idx" ON "activity_modules" USING btree ("discussion_id");
  CREATE INDEX "assignments_allowed_file_types_order_idx" ON "assignments_allowed_file_types" USING btree ("_order");
  CREATE INDEX "assignments_allowed_file_types_parent_id_idx" ON "assignments_allowed_file_types" USING btree ("_parent_id");
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
  CREATE INDEX "discussions_pinned_threads_order_idx" ON "discussions_pinned_threads" USING btree ("_order");
  CREATE INDEX "discussions_pinned_threads_parent_id_idx" ON "discussions_pinned_threads" USING btree ("_parent_id");
  CREATE INDEX "discussions_pinned_threads_thread_idx" ON "discussions_pinned_threads" USING btree ("thread_id");
  CREATE INDEX "discussions_pinned_threads_pinned_by_idx" ON "discussions_pinned_threads" USING btree ("pinned_by_id");
  CREATE INDEX "discussions_created_by_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "discussions_updated_at_idx" ON "discussions" USING btree ("updated_at");
  CREATE INDEX "discussions_created_at_idx" ON "discussions" USING btree ("created_at");
  CREATE INDEX "createdBy_3_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "dueDate_2_idx" ON "discussions" USING btree ("due_date");
  CREATE INDEX "threadSorting_idx" ON "discussions" USING btree ("thread_sorting");
  CREATE INDEX "course_activity_module_links_course_idx" ON "course_activity_module_links" USING btree ("course_id");
  CREATE INDEX "course_activity_module_links_activity_module_idx" ON "course_activity_module_links" USING btree ("activity_module_id");
  CREATE INDEX "course_activity_module_links_updated_at_idx" ON "course_activity_module_links" USING btree ("updated_at");
  CREATE INDEX "course_activity_module_links_created_at_idx" ON "course_activity_module_links" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_tablet_sizes_tablet_filename_idx" ON "media" USING btree ("sizes_tablet_filename");
  CREATE INDEX "notes_created_by_idx" ON "notes" USING btree ("created_by_id");
  CREATE INDEX "notes_updated_at_idx" ON "notes" USING btree ("updated_at");
  CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");
  CREATE INDEX "gradebooks_course_idx" ON "gradebooks" USING btree ("course_id");
  CREATE INDEX "gradebooks_updated_at_idx" ON "gradebooks" USING btree ("updated_at");
  CREATE INDEX "gradebooks_created_at_idx" ON "gradebooks" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_idx" ON "gradebooks" USING btree ("course_id");
  CREATE INDEX "gradebook_categories_gradebook_idx" ON "gradebook_categories" USING btree ("gradebook_id");
  CREATE INDEX "gradebook_categories_parent_idx" ON "gradebook_categories" USING btree ("parent_id");
  CREATE INDEX "gradebook_categories_updated_at_idx" ON "gradebook_categories" USING btree ("updated_at");
  CREATE INDEX "gradebook_categories_created_at_idx" ON "gradebook_categories" USING btree ("created_at");
  CREATE INDEX "gradebook_idx" ON "gradebook_categories" USING btree ("gradebook_id");
  CREATE INDEX "parent_idx" ON "gradebook_categories" USING btree ("parent_id");
  CREATE INDEX "gradebook_items_gradebook_idx" ON "gradebook_items" USING btree ("gradebook_id");
  CREATE INDEX "gradebook_items_category_idx" ON "gradebook_items" USING btree ("category_id");
  CREATE INDEX "gradebook_items_activity_module_idx" ON "gradebook_items" USING btree ("activity_module_id");
  CREATE INDEX "gradebook_items_updated_at_idx" ON "gradebook_items" USING btree ("updated_at");
  CREATE INDEX "gradebook_items_created_at_idx" ON "gradebook_items" USING btree ("created_at");
  CREATE INDEX "gradebook_1_idx" ON "gradebook_items" USING btree ("gradebook_id");
  CREATE INDEX "category_idx" ON "gradebook_items" USING btree ("category_id");
  CREATE INDEX "assignment_submissions_attachments_order_idx" ON "assignment_submissions_attachments" USING btree ("_order");
  CREATE INDEX "assignment_submissions_attachments_parent_id_idx" ON "assignment_submissions_attachments" USING btree ("_parent_id");
  CREATE INDEX "assignment_submissions_attachments_file_idx" ON "assignment_submissions_attachments" USING btree ("file_id");
  CREATE INDEX "assignment_submissions_activity_module_idx" ON "assignment_submissions" USING btree ("activity_module_id");
  CREATE INDEX "assignment_submissions_assignment_idx" ON "assignment_submissions" USING btree ("assignment_id");
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
  CREATE INDEX "quiz_submissions_quiz_idx" ON "quiz_submissions" USING btree ("quiz_id");
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
  CREATE INDEX "discussion_submissions_upvotes_order_idx" ON "discussion_submissions_upvotes" USING btree ("_order");
  CREATE INDEX "discussion_submissions_upvotes_parent_id_idx" ON "discussion_submissions_upvotes" USING btree ("_parent_id");
  CREATE INDEX "discussion_submissions_upvotes_user_idx" ON "discussion_submissions_upvotes" USING btree ("user_id");
  CREATE INDEX "discussion_submissions_activity_module_idx" ON "discussion_submissions" USING btree ("activity_module_id");
  CREATE INDEX "discussion_submissions_discussion_idx" ON "discussion_submissions" USING btree ("discussion_id");
  CREATE INDEX "discussion_submissions_student_idx" ON "discussion_submissions" USING btree ("student_id");
  CREATE INDEX "discussion_submissions_enrollment_idx" ON "discussion_submissions" USING btree ("enrollment_id");
  CREATE INDEX "discussion_submissions_parent_thread_idx" ON "discussion_submissions" USING btree ("parent_thread_id");
  CREATE INDEX "discussion_submissions_updated_at_idx" ON "discussion_submissions" USING btree ("updated_at");
  CREATE INDEX "discussion_submissions_created_at_idx" ON "discussion_submissions" USING btree ("created_at");
  CREATE INDEX "activityModule_2_idx" ON "discussion_submissions" USING btree ("activity_module_id");
  CREATE INDEX "discussion_1_idx" ON "discussion_submissions" USING btree ("discussion_id");
  CREATE INDEX "student_2_idx" ON "discussion_submissions" USING btree ("student_id");
  CREATE INDEX "enrollment_2_idx" ON "discussion_submissions" USING btree ("enrollment_id");
  CREATE INDEX "parentThread_idx" ON "discussion_submissions" USING btree ("parent_thread_id");
  CREATE INDEX "postType_idx" ON "discussion_submissions" USING btree ("post_type");
  CREATE INDEX "status_3_idx" ON "discussion_submissions" USING btree ("status");
  CREATE INDEX "publishedAt_idx" ON "discussion_submissions" USING btree ("published_at");
  CREATE INDEX "isPinned_idx" ON "discussion_submissions" USING btree ("is_pinned");
  CREATE INDEX "lastActivityAt_idx" ON "discussion_submissions" USING btree ("last_activity_at");
  CREATE INDEX "postType_lastActivityAt_idx" ON "discussion_submissions" USING btree ("post_type","last_activity_at");
  CREATE INDEX "course_grade_tables_grade_letters_order_idx" ON "course_grade_tables_grade_letters" USING btree ("_order");
  CREATE INDEX "course_grade_tables_grade_letters_parent_id_idx" ON "course_grade_tables_grade_letters" USING btree ("_parent_id");
  CREATE INDEX "course_grade_tables_course_idx" ON "course_grade_tables" USING btree ("course_id");
  CREATE INDEX "course_grade_tables_updated_at_idx" ON "course_grade_tables" USING btree ("updated_at");
  CREATE INDEX "course_grade_tables_created_at_idx" ON "course_grade_tables" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_1_idx" ON "course_grade_tables" USING btree ("course_id");
  CREATE INDEX "user_grades_adjustments_order_idx" ON "user_grades_adjustments" USING btree ("_order");
  CREATE INDEX "user_grades_adjustments_parent_id_idx" ON "user_grades_adjustments" USING btree ("_parent_id");
  CREATE INDEX "user_grades_adjustments_applied_by_idx" ON "user_grades_adjustments" USING btree ("applied_by_id");
  CREATE INDEX "user_grades_enrollment_idx" ON "user_grades" USING btree ("enrollment_id");
  CREATE INDEX "user_grades_gradebook_item_idx" ON "user_grades" USING btree ("gradebook_item_id");
  CREATE INDEX "user_grades_overridden_by_idx" ON "user_grades" USING btree ("overridden_by_id");
  CREATE INDEX "user_grades_graded_by_idx" ON "user_grades" USING btree ("graded_by_id");
  CREATE INDEX "user_grades_updated_at_idx" ON "user_grades" USING btree ("updated_at");
  CREATE INDEX "user_grades_created_at_idx" ON "user_grades" USING btree ("created_at");
  CREATE UNIQUE INDEX "enrollment_gradebookItem_idx" ON "user_grades" USING btree ("enrollment_id","gradebook_item_id");
  CREATE INDEX "gradebookItem_idx" ON "user_grades" USING btree ("gradebook_item_id");
  CREATE INDEX "enrollment_3_idx" ON "user_grades" USING btree ("enrollment_id");
  CREATE INDEX "user_grades_rels_order_idx" ON "user_grades_rels" USING btree ("order");
  CREATE INDEX "user_grades_rels_parent_idx" ON "user_grades_rels" USING btree ("parent_id");
  CREATE INDEX "user_grades_rels_path_idx" ON "user_grades_rels" USING btree ("path");
  CREATE INDEX "user_grades_rels_assignment_submissions_id_idx" ON "user_grades_rels" USING btree ("assignment_submissions_id");
  CREATE INDEX "user_grades_rels_quiz_submissions_id_idx" ON "user_grades_rels" USING btree ("quiz_submissions_id");
  CREATE INDEX "user_grades_rels_discussion_submissions_id_idx" ON "user_grades_rels" USING btree ("discussion_submissions_id");
  CREATE INDEX "search_updated_at_idx" ON "search" USING btree ("updated_at");
  CREATE INDEX "search_created_at_idx" ON "search" USING btree ("created_at");
  CREATE INDEX "search_rels_order_idx" ON "search_rels" USING btree ("order");
  CREATE INDEX "search_rels_parent_idx" ON "search_rels" USING btree ("parent_id");
  CREATE INDEX "search_rels_path_idx" ON "search_rels" USING btree ("path");
  CREATE INDEX "search_rels_users_id_idx" ON "search_rels" USING btree ("users_id");
  CREATE INDEX "search_rels_courses_id_idx" ON "search_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_activity_modules_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_modules_id");
  CREATE INDEX "payload_locked_documents_rels_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("assignments_id");
  CREATE INDEX "payload_locked_documents_rels_quizzes_id_idx" ON "payload_locked_documents_rels" USING btree ("quizzes_id");
  CREATE INDEX "payload_locked_documents_rels_discussions_id_idx" ON "payload_locked_documents_rels" USING btree ("discussions_id");
  CREATE INDEX "payload_locked_documents_rels_course_activity_module_lin_idx" ON "payload_locked_documents_rels" USING btree ("course_activity_module_links_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("notes_id");
  CREATE INDEX "payload_locked_documents_rels_gradebooks_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebooks_id");
  CREATE INDEX "payload_locked_documents_rels_gradebook_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebook_categories_id");
  CREATE INDEX "payload_locked_documents_rels_gradebook_items_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebook_items_id");
  CREATE INDEX "payload_locked_documents_rels_assignment_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("assignment_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_quiz_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("quiz_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_discussion_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("discussion_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_course_grade_tables_id_idx" ON "payload_locked_documents_rels" USING btree ("course_grade_tables_id");
  CREATE INDEX "payload_locked_documents_rels_user_grades_id_idx" ON "payload_locked_documents_rels" USING btree ("user_grades_id");
  CREATE INDEX "payload_locked_documents_rels_search_id_idx" ON "payload_locked_documents_rels" USING btree ("search_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "system_grade_table_grade_letters_order_idx" ON "system_grade_table_grade_letters" USING btree ("_order");
  CREATE INDEX "system_grade_table_grade_letters_parent_id_idx" ON "system_grade_table_grade_letters" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "courses_tags" CASCADE;
  DROP TABLE "courses" CASCADE;
  DROP TABLE "enrollments_groups" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  DROP TABLE "activity_modules" CASCADE;
  DROP TABLE "assignments_allowed_file_types" CASCADE;
  DROP TABLE "assignments" CASCADE;
  DROP TABLE "quizzes_questions_options" CASCADE;
  DROP TABLE "quizzes_questions_hints" CASCADE;
  DROP TABLE "quizzes_questions" CASCADE;
  DROP TABLE "quizzes" CASCADE;
  DROP TABLE "discussions_pinned_threads" CASCADE;
  DROP TABLE "discussions" CASCADE;
  DROP TABLE "course_activity_module_links" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "notes" CASCADE;
  DROP TABLE "gradebooks" CASCADE;
  DROP TABLE "gradebook_categories" CASCADE;
  DROP TABLE "gradebook_items" CASCADE;
  DROP TABLE "assignment_submissions_attachments" CASCADE;
  DROP TABLE "assignment_submissions" CASCADE;
  DROP TABLE "quiz_submissions_answers_multiple_choice_answers" CASCADE;
  DROP TABLE "quiz_submissions_answers" CASCADE;
  DROP TABLE "quiz_submissions" CASCADE;
  DROP TABLE "discussion_submissions_attachments" CASCADE;
  DROP TABLE "discussion_submissions_upvotes" CASCADE;
  DROP TABLE "discussion_submissions" CASCADE;
  DROP TABLE "course_grade_tables_grade_letters" CASCADE;
  DROP TABLE "course_grade_tables" CASCADE;
  DROP TABLE "user_grades_adjustments" CASCADE;
  DROP TABLE "user_grades" CASCADE;
  DROP TABLE "user_grades_rels" CASCADE;
  DROP TABLE "search" CASCADE;
  DROP TABLE "search_rels" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "system_grade_table_grade_letters" CASCADE;
  DROP TABLE "system_grade_table" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_courses_status";
  DROP TYPE "public"."enum_enrollments_role";
  DROP TYPE "public"."enum_enrollments_status";
  DROP TYPE "public"."enum_activity_modules_type";
  DROP TYPE "public"."enum_activity_modules_status";
  DROP TYPE "public"."enum_quizzes_questions_question_type";
  DROP TYPE "public"."enum_quizzes_grading_type";
  DROP TYPE "public"."enum_discussions_thread_sorting";
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
