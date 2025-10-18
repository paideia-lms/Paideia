import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_theme" AS ENUM('light', 'dark');
  ALTER TABLE "users" ADD COLUMN "theme" "enum_users_theme" DEFAULT 'light' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "theme";
  DROP TYPE "public"."enum_users_theme";`)
}
