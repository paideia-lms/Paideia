import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_sections" ADD COLUMN "content_order" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "course_activity_module_links" ADD COLUMN "content_order" numeric DEFAULT 0 NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "course_sections" DROP COLUMN "content_order";
  ALTER TABLE "course_activity_module_links" DROP COLUMN "content_order";`)
}
