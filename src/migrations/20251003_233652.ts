import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"content" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "courses" DROP CONSTRAINT "courses_instructor_id_users_id_fk";
  
  DROP INDEX "courses_instructor_idx";
  ALTER TABLE "courses" ADD COLUMN "slug" varchar NOT NULL;
  ALTER TABLE "courses" ADD COLUMN "structure" jsonb NOT NULL;
  ALTER TABLE "courses" ADD COLUMN "created_by_id" integer NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notes_id" integer;
  ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notes_created_by_idx" ON "notes" USING btree ("created_by_id");
  CREATE INDEX "notes_updated_at_idx" ON "notes" USING btree ("updated_at");
  CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");
  ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notes_fk" FOREIGN KEY ("notes_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
  CREATE INDEX "courses_created_by_idx" ON "courses" USING btree ("created_by_id");
  CREATE INDEX "payload_locked_documents_rels_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("notes_id");
  ALTER TABLE "courses" DROP COLUMN "instructor_id";
  ALTER TABLE "courses" DROP COLUMN "difficulty";
  ALTER TABLE "courses" DROP COLUMN "duration";
  DROP TYPE "public"."enum_courses_difficulty";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');
  ALTER TABLE "notes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "notes" CASCADE;
  ALTER TABLE "courses" DROP CONSTRAINT "courses_created_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notes_fk";
  
  DROP INDEX "courses_slug_idx";
  DROP INDEX "courses_created_by_idx";
  DROP INDEX "payload_locked_documents_rels_notes_id_idx";
  ALTER TABLE "courses" ADD COLUMN "instructor_id" integer NOT NULL;
  ALTER TABLE "courses" ADD COLUMN "difficulty" "enum_courses_difficulty" DEFAULT 'beginner';
  ALTER TABLE "courses" ADD COLUMN "duration" numeric;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "courses_instructor_idx" ON "courses" USING btree ("instructor_id");
  ALTER TABLE "courses" DROP COLUMN "slug";
  ALTER TABLE "courses" DROP COLUMN "structure";
  ALTER TABLE "courses" DROP COLUMN "created_by_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notes_id";`)
}
