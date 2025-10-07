import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('student', 'instructor', 'admin');
  CREATE TYPE "public"."enum_courses_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_enrollments_role" AS ENUM('student', 'teacher', 'ta', 'manager');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('active', 'inactive', 'completed', 'dropped');
  CREATE TYPE "public"."enum_activity_modules_type" AS ENUM('page', 'whiteboard', 'assignment', 'quiz', 'discussion');
  CREATE TYPE "public"."enum_activity_modules_status" AS ENUM('draft', 'published', 'archived');
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
  
  CREATE TABLE "user_grades" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"gradebook_item_id" integer NOT NULL,
  	"grade" numeric,
  	"feedback" varchar,
  	"graded_by_id" integer,
  	"graded_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "search" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"priority" numeric,
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
  	"course_activity_module_links_id" integer,
  	"media_id" integer,
  	"notes_id" integer,
  	"gradebooks_id" integer,
  	"gradebook_categories_id" integer,
  	"gradebook_items_id" integer,
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
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_tags" ADD CONSTRAINT "courses_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebooks" ADD CONSTRAINT "gradebooks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_categories" ADD CONSTRAINT "gradebook_categories_gradebook_id_gradebooks_id_fk" FOREIGN KEY ("gradebook_id") REFERENCES "public"."gradebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_categories" ADD CONSTRAINT "gradebook_categories_parent_id_gradebook_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_gradebook_id_gradebooks_id_fk" FOREIGN KEY ("gradebook_id") REFERENCES "public"."gradebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_category_id_gradebook_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_activity_module_id_course_activity_module_links_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."course_activity_module_links"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_gradebook_item_id_gradebook_items_id_fk" FOREIGN KEY ("gradebook_item_id") REFERENCES "public"."gradebook_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_graded_by_id_users_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_modules_fk" FOREIGN KEY ("activity_modules_id") REFERENCES "public"."activity_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_activity_module_links_fk" FOREIGN KEY ("course_activity_module_links_id") REFERENCES "public"."course_activity_module_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notes_fk" FOREIGN KEY ("notes_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebooks_fk" FOREIGN KEY ("gradebooks_id") REFERENCES "public"."gradebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebook_categories_fk" FOREIGN KEY ("gradebook_categories_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebook_items_fk" FOREIGN KEY ("gradebook_items_id") REFERENCES "public"."gradebook_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_grades_fk" FOREIGN KEY ("user_grades_id") REFERENCES "public"."user_grades"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
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
  CREATE INDEX "enrollments_user_idx" ON "enrollments" USING btree ("user_id");
  CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_course_idx" ON "enrollments" USING btree ("user_id","course_id");
  CREATE INDEX "activity_modules_created_by_idx" ON "activity_modules" USING btree ("created_by_id");
  CREATE INDEX "activity_modules_updated_at_idx" ON "activity_modules" USING btree ("updated_at");
  CREATE INDEX "activity_modules_created_at_idx" ON "activity_modules" USING btree ("created_at");
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
  CREATE INDEX "user_grades_enrollment_idx" ON "user_grades" USING btree ("enrollment_id");
  CREATE INDEX "user_grades_gradebook_item_idx" ON "user_grades" USING btree ("gradebook_item_id");
  CREATE INDEX "user_grades_graded_by_idx" ON "user_grades" USING btree ("graded_by_id");
  CREATE INDEX "user_grades_updated_at_idx" ON "user_grades" USING btree ("updated_at");
  CREATE INDEX "user_grades_created_at_idx" ON "user_grades" USING btree ("created_at");
  CREATE UNIQUE INDEX "enrollment_gradebookItem_idx" ON "user_grades" USING btree ("enrollment_id","gradebook_item_id");
  CREATE INDEX "gradebookItem_idx" ON "user_grades" USING btree ("gradebook_item_id");
  CREATE INDEX "enrollment_idx" ON "user_grades" USING btree ("enrollment_id");
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
  CREATE INDEX "payload_locked_documents_rels_course_activity_module_lin_idx" ON "payload_locked_documents_rels" USING btree ("course_activity_module_links_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("notes_id");
  CREATE INDEX "payload_locked_documents_rels_gradebooks_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebooks_id");
  CREATE INDEX "payload_locked_documents_rels_gradebook_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebook_categories_id");
  CREATE INDEX "payload_locked_documents_rels_gradebook_items_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebook_items_id");
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
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "courses_tags" CASCADE;
  DROP TABLE "courses" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  DROP TABLE "activity_modules" CASCADE;
  DROP TABLE "course_activity_module_links" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "notes" CASCADE;
  DROP TABLE "gradebooks" CASCADE;
  DROP TABLE "gradebook_categories" CASCADE;
  DROP TABLE "gradebook_items" CASCADE;
  DROP TABLE "user_grades" CASCADE;
  DROP TABLE "search" CASCADE;
  DROP TABLE "search_rels" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_courses_status";
  DROP TYPE "public"."enum_enrollments_role";
  DROP TYPE "public"."enum_enrollments_status";
  DROP TYPE "public"."enum_activity_modules_type";
  DROP TYPE "public"."enum_activity_modules_status";`)
}
