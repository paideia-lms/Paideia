import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "createdBy_idx";
  DROP INDEX "createdBy_1_idx";
  DROP INDEX "createdBy_2_idx";
  DROP INDEX "createdBy_3_idx";
  DROP INDEX "createdBy_4_idx";
  DROP INDEX "createdBy_5_idx";
  DROP INDEX "createdBy_6_idx";
  CREATE INDEX "createdBy_1_idx" ON "activity_modules" USING btree ("created_by_id");
  CREATE INDEX "createdBy_2_idx" ON "pages" USING btree ("created_by_id");
  CREATE INDEX "createdBy_3_idx" ON "whiteboards" USING btree ("created_by_id");
  CREATE INDEX "createdBy_4_idx" ON "assignments" USING btree ("created_by_id");
  CREATE INDEX "createdBy_5_idx" ON "quizzes" USING btree ("created_by_id");
  CREATE INDEX "createdBy_6_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "createdBy_idx" ON "media" USING btree ("created_by_id");
  ALTER TABLE "course_activity_module_links" DROP COLUMN "settings";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "createdBy_idx";
  DROP INDEX "createdBy_1_idx";
  DROP INDEX "createdBy_2_idx";
  DROP INDEX "createdBy_3_idx";
  DROP INDEX "createdBy_4_idx";
  DROP INDEX "createdBy_5_idx";
  DROP INDEX "createdBy_6_idx";
  ALTER TABLE "course_activity_module_links" ADD COLUMN "settings" jsonb;
  CREATE INDEX "createdBy_6_idx" ON "media" USING btree ("created_by_id");
  CREATE INDEX "createdBy_idx" ON "activity_modules" USING btree ("created_by_id");
  CREATE INDEX "createdBy_1_idx" ON "pages" USING btree ("created_by_id");
  CREATE INDEX "createdBy_2_idx" ON "whiteboards" USING btree ("created_by_id");
  CREATE INDEX "createdBy_3_idx" ON "assignments" USING btree ("created_by_id");
  CREATE INDEX "createdBy_4_idx" ON "quizzes" USING btree ("created_by_id");
  CREATE INDEX "createdBy_5_idx" ON "discussions" USING btree ("created_by_id");`)
}
