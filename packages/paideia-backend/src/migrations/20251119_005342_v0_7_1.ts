import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_appearance_settings_color" AS ENUM('blue', 'pink', 'indigo', 'green', 'orange', 'gray', 'grape', 'cyan', 'lime', 'red', 'violet', 'teal', 'yellow');
  CREATE TYPE "public"."enum_appearance_settings_radius" AS ENUM('xs', 'sm', 'md', 'lg', 'xl');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'autoSubmitQuiz';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'autoSubmitQuiz';
  ALTER TABLE "appearance_settings" ADD COLUMN "color" "enum_appearance_settings_color" DEFAULT 'blue';
  ALTER TABLE "appearance_settings" ADD COLUMN "radius" "enum_appearance_settings_radius" DEFAULT 'sm';
  -- Note: time_limit field was never actually used in the application.
  -- Time limits are stored in rawQuizConfig.globalTimer (in seconds) instead.
  -- No data migration needed as the field was never populated.
  ALTER TABLE "quizzes" DROP COLUMN "time_limit";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sandboxReset');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sandboxReset');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "quizzes" ADD COLUMN "time_limit" numeric;
  ALTER TABLE "appearance_settings" DROP COLUMN "color";
  ALTER TABLE "appearance_settings" DROP COLUMN "radius";
  DROP TYPE "public"."enum_appearance_settings_color";
  DROP TYPE "public"."enum_appearance_settings_radius";`)
}
