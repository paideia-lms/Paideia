import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_sections" DROP CONSTRAINT "course_sections_course_id_courses_id_fk";
  
  ALTER TABLE "course_activity_module_links" DROP CONSTRAINT "course_activity_module_links_course_id_courses_id_fk";
  
  ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_sections" DROP CONSTRAINT "course_sections_course_id_courses_id_fk";
  
  ALTER TABLE "course_activity_module_links" DROP CONSTRAINT "course_activity_module_links_course_id_courses_id_fk";
  
  ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_activity_module_links" ADD CONSTRAINT "course_activity_module_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;`)
}
