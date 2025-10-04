import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "origins" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "origins" ADD COLUMN "description" varchar;
  ALTER TABLE "activity_modules" DROP COLUMN "title";
  ALTER TABLE "activity_modules" DROP COLUMN "description";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_modules" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "activity_modules" ADD COLUMN "description" varchar;
  ALTER TABLE "origins" DROP COLUMN "title";
  ALTER TABLE "origins" DROP COLUMN "description";`)
}
