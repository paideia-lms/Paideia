import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "course_activity_module_commit_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer,
  	"commit_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_activity_module_commit_links_id" integer;
  ALTER TABLE "course_activity_module_commit_links" ADD CONSTRAINT "course_activity_module_commit_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_activity_module_commit_links" ADD CONSTRAINT "course_activity_module_commit_links_commit_id_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."commits"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "course_activity_module_commit_links_course_idx" ON "course_activity_module_commit_links" USING btree ("course_id");
  CREATE INDEX "course_activity_module_commit_links_commit_idx" ON "course_activity_module_commit_links" USING btree ("commit_id");
  CREATE INDEX "course_activity_module_commit_links_updated_at_idx" ON "course_activity_module_commit_links" USING btree ("updated_at");
  CREATE INDEX "course_activity_module_commit_links_created_at_idx" ON "course_activity_module_commit_links" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_activity_module_commit_links_fk" FOREIGN KEY ("course_activity_module_commit_links_id") REFERENCES "public"."course_activity_module_commit_links"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_course_activity_module_com_idx" ON "payload_locked_documents_rels" USING btree ("course_activity_module_commit_links_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_activity_module_commit_links" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "course_activity_module_commit_links" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_activity_module_commit_links_fk";
  
  DROP INDEX "payload_locked_documents_rels_course_activity_module_com_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_activity_module_commit_links_id";`)
}
