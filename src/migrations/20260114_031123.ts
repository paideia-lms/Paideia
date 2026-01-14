import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quiz_submissions_completed_nested_quizzes" ADD COLUMN "nested_quiz_id" varchar NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quiz_submissions_completed_nested_quizzes" DROP COLUMN "nested_quiz_id";`)
}
