import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activity_modules_type" ADD VALUE 'file' BEFORE 'assignment';
  ALTER TABLE "activity_modules" ADD COLUMN "file_id" integer;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_modules_file_idx" ON "activity_modules" USING btree ("file_id");
  CREATE INDEX "file_idx" ON "activity_modules" USING btree ("file_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_file_id_files_id_fk";
  
  ALTER TABLE "activity_modules" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_activity_modules_type";
  CREATE TYPE "public"."enum_activity_modules_type" AS ENUM('page', 'whiteboard', 'assignment', 'quiz', 'discussion');
  ALTER TABLE "activity_modules" ALTER COLUMN "type" SET DATA TYPE "public"."enum_activity_modules_type" USING "type"::"public"."enum_activity_modules_type";
  DROP INDEX "activity_modules_file_idx";
  DROP INDEX "file_idx";
  ALTER TABLE "activity_modules" DROP COLUMN "file_id";`)
}
