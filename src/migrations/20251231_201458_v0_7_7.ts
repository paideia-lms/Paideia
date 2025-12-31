import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "status_idx";
  DROP INDEX IF EXISTS "status_1_idx";
  DROP INDEX IF EXISTS "status_2_idx";
  DROP INDEX IF EXISTS "status_3_idx";
  CREATE INDEX "status_idx" ON "assignment_submissions" USING btree ("status");
  CREATE INDEX "status_1_idx" ON "quiz_submissions" USING btree ("status");
  CREATE INDEX "status_2_idx" ON "discussion_submissions" USING btree ("status");
  ALTER TABLE "activity_modules" DROP COLUMN IF EXISTS "status";
  DROP TYPE IF EXISTS "public"."enum_activity_modules_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Check if type exists before creating it (PostgreSQL doesn't support IF NOT EXISTS for CREATE TYPE)
  await db.execute(sql`
   DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_activity_modules_status') THEN
      CREATE TYPE "public"."enum_activity_modules_status" AS ENUM('draft', 'published', 'archived');
    END IF;
   END $$;
  DROP INDEX IF EXISTS "status_idx";
  DROP INDEX IF EXISTS "status_1_idx";
  DROP INDEX IF EXISTS "status_2_idx";
  ALTER TABLE "activity_modules" ADD COLUMN IF NOT EXISTS "status" "enum_activity_modules_status" DEFAULT 'draft' NOT NULL;
  CREATE INDEX IF NOT EXISTS "status_idx" ON "activity_modules" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "status_1_idx" ON "assignment_submissions" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "status_2_idx" ON "quiz_submissions" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "status_3_idx" ON "discussion_submissions" USING btree ("status");`)
}
