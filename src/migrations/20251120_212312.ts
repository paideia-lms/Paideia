import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "gradebook_categories" ALTER COLUMN "weight" DROP DEFAULT;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" DROP DEFAULT;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "gradebook_categories" ALTER COLUMN "weight" SET DEFAULT 0;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" SET DEFAULT 0;
  ALTER TABLE "gradebook_items" ALTER COLUMN "weight" SET NOT NULL;`)
}
