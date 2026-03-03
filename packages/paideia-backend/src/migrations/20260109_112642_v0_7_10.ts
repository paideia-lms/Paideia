import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quizzes_questions_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quizzes_questions_hints" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quizzes_questions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "quizzes_questions_options" CASCADE;
  DROP TABLE "quizzes_questions_hints" CASCADE;
  DROP TABLE "quizzes_questions" CASCADE;
  ALTER TABLE "quizzes" ALTER COLUMN "raw_quiz_config" SET NOT NULL;
  ALTER TABLE "quizzes" DROP COLUMN "points";
  ALTER TABLE "quizzes" DROP COLUMN "grading_type";
  ALTER TABLE "quizzes" DROP COLUMN "show_correct_answers";
  ALTER TABLE "quizzes" DROP COLUMN "allow_multiple_attempts";
  ALTER TABLE "quizzes" DROP COLUMN "shuffle_questions";
  ALTER TABLE "quizzes" DROP COLUMN "shuffle_answers";
  ALTER TABLE "quizzes" DROP COLUMN "show_one_question_at_a_time";
  DROP TYPE "public"."enum_quizzes_questions_question_type";
  DROP TYPE "public"."enum_quizzes_grading_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quizzes_questions_question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank', 'matching', 'ordering');
  CREATE TYPE "public"."enum_quizzes_grading_type" AS ENUM('automatic', 'manual');
  CREATE TABLE "quizzes_questions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"is_correct" boolean DEFAULT false,
  	"feedback" varchar
  );
  
  CREATE TABLE "quizzes_questions_hints" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hint" varchar NOT NULL
  );
  
  CREATE TABLE "quizzes_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question_text" varchar NOT NULL,
  	"question_type" "enum_quizzes_questions_question_type" NOT NULL,
  	"points" numeric NOT NULL,
  	"correct_answer" varchar,
  	"explanation" varchar
  );
  
  ALTER TABLE "quizzes" ALTER COLUMN "raw_quiz_config" DROP NOT NULL;
  ALTER TABLE "quizzes" ADD COLUMN "points" numeric DEFAULT 100;
  ALTER TABLE "quizzes" ADD COLUMN "grading_type" "enum_quizzes_grading_type" DEFAULT 'automatic';
  ALTER TABLE "quizzes" ADD COLUMN "show_correct_answers" boolean DEFAULT false;
  ALTER TABLE "quizzes" ADD COLUMN "allow_multiple_attempts" boolean DEFAULT false;
  ALTER TABLE "quizzes" ADD COLUMN "shuffle_questions" boolean DEFAULT false;
  ALTER TABLE "quizzes" ADD COLUMN "shuffle_answers" boolean DEFAULT false;
  ALTER TABLE "quizzes" ADD COLUMN "show_one_question_at_a_time" boolean DEFAULT false;
  ALTER TABLE "quizzes_questions_options" ADD CONSTRAINT "quizzes_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes_questions_hints" ADD CONSTRAINT "quizzes_questions_hints_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quizzes_questions" ADD CONSTRAINT "quizzes_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quizzes_questions_options_order_idx" ON "quizzes_questions_options" USING btree ("_order");
  CREATE INDEX "quizzes_questions_options_parent_id_idx" ON "quizzes_questions_options" USING btree ("_parent_id");
  CREATE INDEX "quizzes_questions_hints_order_idx" ON "quizzes_questions_hints" USING btree ("_order");
  CREATE INDEX "quizzes_questions_hints_parent_id_idx" ON "quizzes_questions_hints" USING btree ("_parent_id");
  CREATE INDEX "quizzes_questions_order_idx" ON "quizzes_questions" USING btree ("_order");
  CREATE INDEX "quizzes_questions_parent_id_idx" ON "quizzes_questions" USING btree ("_parent_id");`)
}
