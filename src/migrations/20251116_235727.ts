import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_appearance_settings_color" AS ENUM('blue', 'pink', 'indigo', 'green', 'orange', 'gray', 'grape', 'cyan', 'lime', 'red', 'violet', 'teal', 'yellow');
  CREATE TYPE "public"."enum_appearance_settings_radius" AS ENUM('xs', 'sm', 'md', 'lg', 'xl');
  ALTER TABLE "appearance_settings" ADD COLUMN "color" "enum_appearance_settings_color" DEFAULT 'blue';
  ALTER TABLE "appearance_settings" ADD COLUMN "radius" "enum_appearance_settings_radius" DEFAULT 'sm';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "appearance_settings" DROP COLUMN "color";
  ALTER TABLE "appearance_settings" DROP COLUMN "radius";
  DROP TYPE "public"."enum_appearance_settings_color";
  DROP TYPE "public"."enum_appearance_settings_radius";`)
}
