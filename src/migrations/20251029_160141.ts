import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "assignments" ALTER COLUMN "require_text_submission" SET DEFAULT true;
  ALTER TABLE "assignments" ALTER COLUMN "require_file_submission" SET DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "assignments" ALTER COLUMN "require_text_submission" SET DEFAULT false;
  ALTER TABLE "assignments" ALTER COLUMN "require_file_submission" SET DEFAULT false;`)
}
