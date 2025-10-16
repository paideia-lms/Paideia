import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "course_sections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"parent_section_id" integer,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "course_activity_module_links" ADD COLUMN "section_id" integer NOT NULL;
  ALTER TABLE "course_activity_module_links" ADD COLUMN "order" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_sections_id" integer;
  ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_parent_section_id_course_sections_id_fk" FOREIGN KEY ("parent_section_id") REFERENCES "public"."course_sections"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "course_sections_course_idx" ON "course_sections" USING btree ("course_id");
  CREATE INDEX "course_sections_parent_section_idx" ON "course_sections" USING btree ("parent_section_id");
  CREATE INDEX "course_sections_updated_at_idx" ON "course_sections" USING btree ("updated_at");
  CREATE INDEX "course_sections_created_at_idx" ON "course_sections" USING btree ("created_at");
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_section_id_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_sections_fk" FOREIGN KEY ("course_sections_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "course_activity_module_links_section_idx" ON "course_activity_module_links" USING btree ("section_id");
  CREATE INDEX "payload_locked_documents_rels_course_sections_id_idx" ON "payload_locked_documents_rels" USING btree ("course_sections_id");
  ALTER TABLE "courses" DROP COLUMN "structure";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_sections" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "course_sections" CASCADE;
  ALTER TABLE "course_activity_module_links" DROP CONSTRAINT "course_activity_module_links_section_id_course_sections_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_sections_fk";
  
  DROP INDEX "course_activity_module_links_section_idx";
  DROP INDEX "payload_locked_documents_rels_course_sections_id_idx";
  ALTER TABLE "courses" ADD COLUMN "structure" jsonb NOT NULL;
  ALTER TABLE "course_activity_module_links" DROP COLUMN "section_id";
  ALTER TABLE "course_activity_module_links" DROP COLUMN "order";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_sections_id";`)
}
