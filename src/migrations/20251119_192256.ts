import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_direction" AS ENUM('ltr', 'rtl');
  ALTER TABLE "users" ADD COLUMN "direction" "enum_users_direction" DEFAULT 'ltr' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "direction";
  DROP TYPE "public"."enum_users_direction";`)
}
