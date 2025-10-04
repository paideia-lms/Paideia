import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_user_grades_status" AS ENUM('not_graded', 'graded', 'excused', 'missing');
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
  	"user_id" integer NOT NULL,
  	"gradebook_item_id" integer NOT NULL,
  	"grade" numeric,
  	"feedback" varchar,
  	"status" "enum_user_grades_status" DEFAULT 'not_graded',
  	"graded_by_id" integer,
  	"graded_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "course_activity_module_commit_links" ALTER COLUMN "course_id" SET NOT NULL;
  ALTER TABLE "course_activity_module_commit_links" ALTER COLUMN "commit_id" SET NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gradebooks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gradebook_categories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gradebook_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "user_grades_id" integer;
  ALTER TABLE "gradebooks" ADD CONSTRAINT "gradebooks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_categories" ADD CONSTRAINT "gradebook_categories_gradebook_id_gradebooks_id_fk" FOREIGN KEY ("gradebook_id") REFERENCES "public"."gradebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_categories" ADD CONSTRAINT "gradebook_categories_parent_id_gradebook_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_gradebook_id_gradebooks_id_fk" FOREIGN KEY ("gradebook_id") REFERENCES "public"."gradebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_category_id_gradebook_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gradebook_items" ADD CONSTRAINT "gradebook_items_activity_module_id_course_activity_module_commit_links_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."course_activity_module_commit_links"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_gradebook_item_id_gradebook_items_id_fk" FOREIGN KEY ("gradebook_item_id") REFERENCES "public"."gradebook_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_graded_by_id_users_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
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
  CREATE INDEX "user_grades_user_idx" ON "user_grades" USING btree ("user_id");
  CREATE INDEX "user_grades_gradebook_item_idx" ON "user_grades" USING btree ("gradebook_item_id");
  CREATE INDEX "user_grades_graded_by_idx" ON "user_grades" USING btree ("graded_by_id");
  CREATE INDEX "user_grades_updated_at_idx" ON "user_grades" USING btree ("updated_at");
  CREATE INDEX "user_grades_created_at_idx" ON "user_grades" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_gradebookItem_idx" ON "user_grades" USING btree ("user_id","gradebook_item_id");
  CREATE INDEX "gradebookItem_idx" ON "user_grades" USING btree ("gradebook_item_id");
  CREATE INDEX "user_idx" ON "user_grades" USING btree ("user_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebooks_fk" FOREIGN KEY ("gradebooks_id") REFERENCES "public"."gradebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebook_categories_fk" FOREIGN KEY ("gradebook_categories_id") REFERENCES "public"."gradebook_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gradebook_items_fk" FOREIGN KEY ("gradebook_items_id") REFERENCES "public"."gradebook_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_grades_fk" FOREIGN KEY ("user_grades_id") REFERENCES "public"."user_grades"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_gradebooks_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebooks_id");
  CREATE INDEX "payload_locked_documents_rels_gradebook_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebook_categories_id");
  CREATE INDEX "payload_locked_documents_rels_gradebook_items_id_idx" ON "payload_locked_documents_rels" USING btree ("gradebook_items_id");
  CREATE INDEX "payload_locked_documents_rels_user_grades_id_idx" ON "payload_locked_documents_rels" USING btree ("user_grades_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "gradebooks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "gradebook_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "gradebook_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_grades" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "gradebooks" CASCADE;
  DROP TABLE "gradebook_categories" CASCADE;
  DROP TABLE "gradebook_items" CASCADE;
  DROP TABLE "user_grades" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gradebooks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gradebook_categories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gradebook_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_user_grades_fk";
  
  DROP INDEX "payload_locked_documents_rels_gradebooks_id_idx";
  DROP INDEX "payload_locked_documents_rels_gradebook_categories_id_idx";
  DROP INDEX "payload_locked_documents_rels_gradebook_items_id_idx";
  DROP INDEX "payload_locked_documents_rels_user_grades_id_idx";
  ALTER TABLE "course_activity_module_commit_links" ALTER COLUMN "course_id" DROP NOT NULL;
  ALTER TABLE "course_activity_module_commit_links" ALTER COLUMN "commit_id" DROP NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gradebooks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gradebook_categories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gradebook_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "user_grades_id";
  DROP TYPE "public"."enum_user_grades_status";`)
}
