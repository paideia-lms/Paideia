import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "quiz_submissions_completed_nested_quizzes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "quiz_submissions_completed_nested_quizzes" ADD CONSTRAINT "quiz_submissions_completed_nested_quizzes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quiz_submissions_completed_nested_quizzes_order_idx" ON "quiz_submissions_completed_nested_quizzes" USING btree ("_order");
  CREATE INDEX "quiz_submissions_completed_nested_quizzes_parent_id_idx" ON "quiz_submissions_completed_nested_quizzes" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "quiz_submissions_completed_nested_quizzes" CASCADE;`)
}
