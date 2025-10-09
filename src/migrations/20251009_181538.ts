import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "course_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "courses" ADD COLUMN "category_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_categories_id" integer;
  ALTER TABLE "system_grade_table" ADD COLUMN "max_category_depth" numeric;
  ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_parent_id_course_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."course_categories"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "course_categories_parent_idx" ON "course_categories" USING btree ("parent_id");
  CREATE INDEX "course_categories_updated_at_idx" ON "course_categories" USING btree ("updated_at");
  CREATE INDEX "course_categories_created_at_idx" ON "course_categories" USING btree ("created_at");
  ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_course_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."course_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_categories_fk" FOREIGN KEY ("course_categories_id") REFERENCES "public"."course_categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_category_idx" ON "courses" USING btree ("category_id");
  CREATE INDEX "payload_locked_documents_rels_course_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("course_categories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_categories" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "course_categories" CASCADE;
  ALTER TABLE "courses" DROP CONSTRAINT "courses_category_id_course_categories_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_categories_fk";
  
  DROP INDEX "courses_category_idx";
  DROP INDEX "payload_locked_documents_rels_course_categories_id_idx";
  ALTER TABLE "courses" DROP COLUMN "category_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_categories_id";
  ALTER TABLE "system_grade_table" DROP COLUMN "max_category_depth";`)
}
