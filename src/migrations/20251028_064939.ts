import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_activity_module_links_fk";
  
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_activity_module_link_fk" FOREIGN KEY ("course_activity_module_links_id") REFERENCES "public"."course_activity_module_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_modules" DROP COLUMN "require_password";
  ALTER TABLE "activity_modules" DROP COLUMN "access_password";
  ALTER TABLE "quizzes" DROP COLUMN "require_password";
  ALTER TABLE "quizzes" DROP COLUMN "access_password";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_activity_module_link_fk";
  
  ALTER TABLE "activity_modules" ADD COLUMN "require_password" boolean DEFAULT false;
  ALTER TABLE "activity_modules" ADD COLUMN "access_password" varchar;
  ALTER TABLE "quizzes" ADD COLUMN "require_password" boolean DEFAULT false;
  ALTER TABLE "quizzes" ADD COLUMN "access_password" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_activity_module_links_fk" FOREIGN KEY ("course_activity_module_links_id") REFERENCES "public"."course_activity_module_links"("id") ON DELETE cascade ON UPDATE no action;`)
}
