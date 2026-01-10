import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "quiz_submissions_flagged_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question_id" varchar
  );
  
  ALTER TABLE "quiz_submissions_flagged_questions" ADD CONSTRAINT "quiz_submissions_flagged_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quiz_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quiz_submissions_flagged_questions_order_idx" ON "quiz_submissions_flagged_questions" USING btree ("_order");
  CREATE INDEX "quiz_submissions_flagged_questions_parent_id_idx" ON "quiz_submissions_flagged_questions" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "quiz_submissions_flagged_questions" CASCADE;`)
}
