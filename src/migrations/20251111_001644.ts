import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_policies" ALTER COLUMN "user_media_storage_total" SET DEFAULT 10737418240;
  ALTER TABLE "site_policies" ALTER COLUMN "site_upload_limit" SET DEFAULT 20971520;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_policies" ALTER COLUMN "user_media_storage_total" DROP DEFAULT;
  ALTER TABLE "site_policies" ALTER COLUMN "site_upload_limit" DROP DEFAULT;`)
}
