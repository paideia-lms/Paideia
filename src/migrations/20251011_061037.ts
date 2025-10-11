import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'content-manager', 'analytics-viewer', 'instructor', 'student');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'content-manager', 'analytics-viewer', 'user');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";`)
}
