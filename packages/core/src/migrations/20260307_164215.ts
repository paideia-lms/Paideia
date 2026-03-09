import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'content-manager', 'analytics-viewer', 'instructor', 'student');
  CREATE TYPE "public"."enum_users_theme" AS ENUM('light', 'dark');
  CREATE TYPE "public"."enum_users_direction" AS ENUM('ltr', 'rtl');
  CREATE TYPE "public"."enum_courses_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_discussions_thread_sorting" AS ENUM('recent', 'upvoted', 'active', 'alphabetical');
  CREATE TYPE "public"."enum_enrollments_role" AS ENUM('student', 'teacher', 'ta', 'manager');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('active', 'inactive', 'completed', 'dropped');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sandboxReset', 'autoSubmitQuiz');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sandboxReset', 'autoSubmitQuiz');
  CREATE TYPE "public"."enum_appearance_settings_color" AS ENUM('blue', 'pink', 'indigo', 'green', 'orange', 'gray', 'grape', 'cyan', 'lime', 'red', 'violet', 'teal', 'yellow');
  CREATE TYPE "public"."enum_appearance_settings_radius" AS ENUM('xs', 'sm', 'md', 'lg', 'xl');
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
  	"theme" "enum_users_theme" DEFAULT 'light' NOT NULL,
  	"direction" "enum_users_direction" DEFAULT 'ltr' NOT NULL,
  	"avatar_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
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
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" varchar,
  	"created_by_id" integer NOT NULL,
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
  	"focal_y" numeric
  );
  
  CREATE TABLE "notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"content" varchar NOT NULL,
  	"is_public" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"created_by_id" integer NOT NULL,
  	"content" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
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
  	"status" "enum_courses_status" DEFAULT 'draft' NOT NULL,
  	"thumbnail_id" integer,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "courses_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "course_sections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"parent_section_id" integer,
  	"content_order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "course_activity_module_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer NOT NULL,
  	"section_id" integer NOT NULL,
  	"content_order" numeric DEFAULT 0 NOT NULL,
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
  
  CREATE TABLE "whiteboards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"content" varchar,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "whiteboards_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
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
  
  CREATE TABLE "enrollments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"groups_id" integer
  );
  
  CREATE TABLE "groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"course_id" integer NOT NULL,
  	"parent_id" integer,
  	"path" varchar NOT NULL,
  	"description" varchar,
  	"color" varchar,
  	"max_members" numeric,
  	"is_active" boolean DEFAULT true,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  	"courses_id" integer,
  	"discussions_id" integer
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  	"media_id" integer,
  	"notes_id" integer,
  	"pages_id" integer,
  	"courses_id" integer,
  	"course_sections_id" integer,
  	"course_activity_module_links_id" integer,
  	"course_grade_tables_id" integer,
  	"whiteboards_id" integer,
  	"files_id" integer,
  	"discussions_id" integer,
  	"enrollments_id" integer,
  	"groups_id" integer,
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
  	"max_category_depth" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "registration_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"disable_registration" boolean DEFAULT false,
  	"show_registration_button" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "maintenance_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"maintenance_mode" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_policies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_media_storage_total" numeric DEFAULT 10737418240,
  	"site_upload_limit" numeric DEFAULT 20971520,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "appearance_settings_additional_css_stylesheets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "appearance_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"color" "enum_appearance_settings_color" DEFAULT 'blue',
  	"radius" "enum_appearance_settings_radius" DEFAULT 'sm',
  	"logo_light_id" integer,
  	"logo_dark_id" integer,
  	"compact_logo_light_id" integer,
  	"compact_logo_dark_id" integer,
  	"favicon_light_id" integer,
  	"favicon_dark_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "analytics_settings_additional_js_scripts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"src" varchar NOT NULL,
  	"defer" boolean DEFAULT false,
  	"async" boolean DEFAULT false,
  	"data_website_id" varchar,
  	"data_domain" varchar,
  	"data_site" varchar,
  	"data_measurement_id" varchar
  );
  
  CREATE TABLE "analytics_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notes_rels" ADD CONSTRAINT "notes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notes_rels" ADD CONSTRAINT "notes_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_recurring_schedules_days_of_week" ADD CONSTRAINT "courses_recurring_schedules_days_of_week_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_recurring_schedules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_recurring_schedules" ADD CONSTRAINT "courses_recurring_schedules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_specific_dates" ADD CONSTRAINT "courses_specific_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_tags" ADD CONSTRAINT "courses_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_parent_section_id_course_sections_id_fk" FOREIGN KEY ("parent_section_id") REFERENCES "public"."course_sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_section_id_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_grade_tables_grade_letters" ADD CONSTRAINT "course_grade_tables_grade_letters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."course_grade_tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_grade_tables" ADD CONSTRAINT "course_grade_tables_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whiteboards_rels" ADD CONSTRAINT "whiteboards_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."whiteboards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "whiteboards_rels" ADD CONSTRAINT "whiteboards_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "files" ADD CONSTRAINT "files_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "files_rels" ADD CONSTRAINT "files_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "files_rels" ADD CONSTRAINT "files_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions" ADD CONSTRAINT "discussions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments_rels" ADD CONSTRAINT "enrollments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enrollments_rels" ADD CONSTRAINT "enrollments_rels_groups_fk" FOREIGN KEY ("groups_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "groups" ADD CONSTRAINT "groups_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_id_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_discussions_fk" FOREIGN KEY ("discussions_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notes_fk" FOREIGN KEY ("notes_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_sections_fk" FOREIGN KEY ("course_sections_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_activity_module_link_fk" FOREIGN KEY ("course_activity_module_links_id") REFERENCES "public"."course_activity_module_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_grade_tables_fk" FOREIGN KEY ("course_grade_tables_id") REFERENCES "public"."course_grade_tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whiteboards_fk" FOREIGN KEY ("whiteboards_id") REFERENCES "public"."whiteboards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discussions_fk" FOREIGN KEY ("discussions_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_groups_fk" FOREIGN KEY ("groups_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "system_grade_table_grade_letters" ADD CONSTRAINT "system_grade_table_grade_letters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."system_grade_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "appearance_settings_additional_css_stylesheets" ADD CONSTRAINT "appearance_settings_additional_css_stylesheets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."appearance_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_logo_light_id_media_id_fk" FOREIGN KEY ("logo_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_logo_dark_id_media_id_fk" FOREIGN KEY ("logo_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_compact_logo_light_id_media_id_fk" FOREIGN KEY ("compact_logo_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_compact_logo_dark_id_media_id_fk" FOREIGN KEY ("compact_logo_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_favicon_light_id_media_id_fk" FOREIGN KEY ("favicon_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_favicon_dark_id_media_id_fk" FOREIGN KEY ("favicon_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "analytics_settings_additional_js_scripts" ADD CONSTRAINT "analytics_settings_additional_js_scripts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_created_by_idx" ON "media" USING btree ("created_by_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "createdBy_idx" ON "media" USING btree ("created_by_id");
  CREATE INDEX "notes_created_by_idx" ON "notes" USING btree ("created_by_id");
  CREATE INDEX "notes_updated_at_idx" ON "notes" USING btree ("updated_at");
  CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");
  CREATE INDEX "notes_rels_order_idx" ON "notes_rels" USING btree ("order");
  CREATE INDEX "notes_rels_parent_idx" ON "notes_rels" USING btree ("parent_id");
  CREATE INDEX "notes_rels_path_idx" ON "notes_rels" USING btree ("path");
  CREATE INDEX "notes_rels_media_id_idx" ON "notes_rels" USING btree ("media_id");
  CREATE INDEX "pages_created_by_idx" ON "pages" USING btree ("created_by_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "createdBy_1_idx" ON "pages" USING btree ("created_by_id");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_media_id_idx" ON "pages_rels" USING btree ("media_id");
  CREATE INDEX "courses_recurring_schedules_days_of_week_order_idx" ON "courses_recurring_schedules_days_of_week" USING btree ("_order");
  CREATE INDEX "courses_recurring_schedules_days_of_week_parent_id_idx" ON "courses_recurring_schedules_days_of_week" USING btree ("_parent_id");
  CREATE INDEX "courses_recurring_schedules_order_idx" ON "courses_recurring_schedules" USING btree ("_order");
  CREATE INDEX "courses_recurring_schedules_parent_id_idx" ON "courses_recurring_schedules" USING btree ("_parent_id");
  CREATE INDEX "courses_specific_dates_order_idx" ON "courses_specific_dates" USING btree ("_order");
  CREATE INDEX "courses_specific_dates_parent_id_idx" ON "courses_specific_dates" USING btree ("_parent_id");
  CREATE INDEX "courses_tags_order_idx" ON "courses_tags" USING btree ("_order");
  CREATE INDEX "courses_tags_parent_id_idx" ON "courses_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
  CREATE INDEX "courses_thumbnail_idx" ON "courses" USING btree ("thumbnail_id");
  CREATE INDEX "courses_created_by_idx" ON "courses" USING btree ("created_by_id");
  CREATE INDEX "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "courses" USING btree ("created_at");
  CREATE INDEX "courses_rels_order_idx" ON "courses_rels" USING btree ("order");
  CREATE INDEX "courses_rels_parent_idx" ON "courses_rels" USING btree ("parent_id");
  CREATE INDEX "courses_rels_path_idx" ON "courses_rels" USING btree ("path");
  CREATE INDEX "courses_rels_media_id_idx" ON "courses_rels" USING btree ("media_id");
  CREATE INDEX "course_sections_course_idx" ON "course_sections" USING btree ("course_id");
  CREATE INDEX "course_sections_parent_section_idx" ON "course_sections" USING btree ("parent_section_id");
  CREATE INDEX "course_sections_updated_at_idx" ON "course_sections" USING btree ("updated_at");
  CREATE INDEX "course_sections_created_at_idx" ON "course_sections" USING btree ("created_at");
  CREATE INDEX "course_activity_module_links_course_idx" ON "course_activity_module_links" USING btree ("course_id");
  CREATE INDEX "course_activity_module_links_section_idx" ON "course_activity_module_links" USING btree ("section_id");
  CREATE INDEX "course_activity_module_links_updated_at_idx" ON "course_activity_module_links" USING btree ("updated_at");
  CREATE INDEX "course_activity_module_links_created_at_idx" ON "course_activity_module_links" USING btree ("created_at");
  CREATE INDEX "course_grade_tables_grade_letters_order_idx" ON "course_grade_tables_grade_letters" USING btree ("_order");
  CREATE INDEX "course_grade_tables_grade_letters_parent_id_idx" ON "course_grade_tables_grade_letters" USING btree ("_parent_id");
  CREATE INDEX "course_grade_tables_course_idx" ON "course_grade_tables" USING btree ("course_id");
  CREATE INDEX "course_grade_tables_updated_at_idx" ON "course_grade_tables" USING btree ("updated_at");
  CREATE INDEX "course_grade_tables_created_at_idx" ON "course_grade_tables" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_idx" ON "course_grade_tables" USING btree ("course_id");
  CREATE INDEX "whiteboards_created_by_idx" ON "whiteboards" USING btree ("created_by_id");
  CREATE INDEX "whiteboards_updated_at_idx" ON "whiteboards" USING btree ("updated_at");
  CREATE INDEX "whiteboards_created_at_idx" ON "whiteboards" USING btree ("created_at");
  CREATE INDEX "createdBy_2_idx" ON "whiteboards" USING btree ("created_by_id");
  CREATE INDEX "whiteboards_rels_order_idx" ON "whiteboards_rels" USING btree ("order");
  CREATE INDEX "whiteboards_rels_parent_idx" ON "whiteboards_rels" USING btree ("parent_id");
  CREATE INDEX "whiteboards_rels_path_idx" ON "whiteboards_rels" USING btree ("path");
  CREATE INDEX "whiteboards_rels_media_id_idx" ON "whiteboards_rels" USING btree ("media_id");
  CREATE INDEX "files_created_by_idx" ON "files" USING btree ("created_by_id");
  CREATE INDEX "files_updated_at_idx" ON "files" USING btree ("updated_at");
  CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");
  CREATE INDEX "createdBy_3_idx" ON "files" USING btree ("created_by_id");
  CREATE INDEX "files_rels_order_idx" ON "files_rels" USING btree ("order");
  CREATE INDEX "files_rels_parent_idx" ON "files_rels" USING btree ("parent_id");
  CREATE INDEX "files_rels_path_idx" ON "files_rels" USING btree ("path");
  CREATE INDEX "files_rels_media_id_idx" ON "files_rels" USING btree ("media_id");
  CREATE INDEX "discussions_created_by_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "discussions_updated_at_idx" ON "discussions" USING btree ("updated_at");
  CREATE INDEX "discussions_created_at_idx" ON "discussions" USING btree ("created_at");
  CREATE INDEX "createdBy_4_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "dueDate_idx" ON "discussions" USING btree ("due_date");
  CREATE INDEX "threadSorting_idx" ON "discussions" USING btree ("thread_sorting");
  CREATE INDEX "enrollments_user_idx" ON "enrollments" USING btree ("user_id");
  CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_course_idx" ON "enrollments" USING btree ("user_id","course_id");
  CREATE INDEX "enrollments_rels_order_idx" ON "enrollments_rels" USING btree ("order");
  CREATE INDEX "enrollments_rels_parent_idx" ON "enrollments_rels" USING btree ("parent_id");
  CREATE INDEX "enrollments_rels_path_idx" ON "enrollments_rels" USING btree ("path");
  CREATE INDEX "enrollments_rels_groups_id_idx" ON "enrollments_rels" USING btree ("groups_id");
  CREATE INDEX "groups_course_idx" ON "groups" USING btree ("course_id");
  CREATE INDEX "groups_parent_idx" ON "groups" USING btree ("parent_id");
  CREATE UNIQUE INDEX "groups_path_idx" ON "groups" USING btree ("path");
  CREATE INDEX "groups_updated_at_idx" ON "groups" USING btree ("updated_at");
  CREATE INDEX "groups_created_at_idx" ON "groups" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_path_idx" ON "groups" USING btree ("course_id","path");
  CREATE INDEX "search_updated_at_idx" ON "search" USING btree ("updated_at");
  CREATE INDEX "search_created_at_idx" ON "search" USING btree ("created_at");
  CREATE INDEX "search_rels_order_idx" ON "search_rels" USING btree ("order");
  CREATE INDEX "search_rels_parent_idx" ON "search_rels" USING btree ("parent_id");
  CREATE INDEX "search_rels_path_idx" ON "search_rels" USING btree ("path");
  CREATE INDEX "search_rels_users_id_idx" ON "search_rels" USING btree ("users_id");
  CREATE INDEX "search_rels_courses_id_idx" ON "search_rels" USING btree ("courses_id");
  CREATE INDEX "search_rels_discussions_id_idx" ON "search_rels" USING btree ("discussions_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("notes_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_course_sections_id_idx" ON "payload_locked_documents_rels" USING btree ("course_sections_id");
  CREATE INDEX "payload_locked_documents_rels_course_activity_module_lin_idx" ON "payload_locked_documents_rels" USING btree ("course_activity_module_links_id");
  CREATE INDEX "payload_locked_documents_rels_course_grade_tables_id_idx" ON "payload_locked_documents_rels" USING btree ("course_grade_tables_id");
  CREATE INDEX "payload_locked_documents_rels_whiteboards_id_idx" ON "payload_locked_documents_rels" USING btree ("whiteboards_id");
  CREATE INDEX "payload_locked_documents_rels_files_id_idx" ON "payload_locked_documents_rels" USING btree ("files_id");
  CREATE INDEX "payload_locked_documents_rels_discussions_id_idx" ON "payload_locked_documents_rels" USING btree ("discussions_id");
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("groups_id");
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
  CREATE INDEX "system_grade_table_grade_letters_parent_id_idx" ON "system_grade_table_grade_letters" USING btree ("_parent_id");
  CREATE INDEX "appearance_settings_additional_css_stylesheets_order_idx" ON "appearance_settings_additional_css_stylesheets" USING btree ("_order");
  CREATE INDEX "appearance_settings_additional_css_stylesheets_parent_id_idx" ON "appearance_settings_additional_css_stylesheets" USING btree ("_parent_id");
  CREATE INDEX "appearance_settings_logo_light_idx" ON "appearance_settings" USING btree ("logo_light_id");
  CREATE INDEX "appearance_settings_logo_dark_idx" ON "appearance_settings" USING btree ("logo_dark_id");
  CREATE INDEX "appearance_settings_compact_logo_light_idx" ON "appearance_settings" USING btree ("compact_logo_light_id");
  CREATE INDEX "appearance_settings_compact_logo_dark_idx" ON "appearance_settings" USING btree ("compact_logo_dark_id");
  CREATE INDEX "appearance_settings_favicon_light_idx" ON "appearance_settings" USING btree ("favicon_light_id");
  CREATE INDEX "appearance_settings_favicon_dark_idx" ON "appearance_settings" USING btree ("favicon_dark_id");
  CREATE INDEX "analytics_settings_additional_js_scripts_order_idx" ON "analytics_settings_additional_js_scripts" USING btree ("_order");
  CREATE INDEX "analytics_settings_additional_js_scripts_parent_id_idx" ON "analytics_settings_additional_js_scripts" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "notes" CASCADE;
  DROP TABLE "notes_rels" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "courses_recurring_schedules_days_of_week" CASCADE;
  DROP TABLE "courses_recurring_schedules" CASCADE;
  DROP TABLE "courses_specific_dates" CASCADE;
  DROP TABLE "courses_tags" CASCADE;
  DROP TABLE "courses" CASCADE;
  DROP TABLE "courses_rels" CASCADE;
  DROP TABLE "course_sections" CASCADE;
  DROP TABLE "course_activity_module_links" CASCADE;
  DROP TABLE "course_grade_tables_grade_letters" CASCADE;
  DROP TABLE "course_grade_tables" CASCADE;
  DROP TABLE "whiteboards" CASCADE;
  DROP TABLE "whiteboards_rels" CASCADE;
  DROP TABLE "files" CASCADE;
  DROP TABLE "files_rels" CASCADE;
  DROP TABLE "discussions" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  DROP TABLE "enrollments_rels" CASCADE;
  DROP TABLE "groups" CASCADE;
  DROP TABLE "search" CASCADE;
  DROP TABLE "search_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "system_grade_table_grade_letters" CASCADE;
  DROP TABLE "system_grade_table" CASCADE;
  DROP TABLE "registration_settings" CASCADE;
  DROP TABLE "maintenance_settings" CASCADE;
  DROP TABLE "site_policies" CASCADE;
  DROP TABLE "appearance_settings_additional_css_stylesheets" CASCADE;
  DROP TABLE "appearance_settings" CASCADE;
  DROP TABLE "analytics_settings_additional_js_scripts" CASCADE;
  DROP TABLE "analytics_settings" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_theme";
  DROP TYPE "public"."enum_users_direction";
  DROP TYPE "public"."enum_courses_status";
  DROP TYPE "public"."enum_discussions_thread_sorting";
  DROP TYPE "public"."enum_enrollments_role";
  DROP TYPE "public"."enum_enrollments_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_appearance_settings_color";
  DROP TYPE "public"."enum_appearance_settings_radius";`)
}
