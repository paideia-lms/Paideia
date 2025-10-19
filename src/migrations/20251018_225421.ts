import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" varchar,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "whiteboards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" varchar,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "createdBy_1_idx";
  DROP INDEX "createdBy_2_idx";
  DROP INDEX "createdBy_3_idx";
  ALTER TABLE "activity_modules" ADD COLUMN "page_id" integer;
  ALTER TABLE "activity_modules" ADD COLUMN "whiteboard_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "whiteboards_id" integer;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_created_by_idx" ON "pages" USING btree ("created_by_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "createdBy_1_idx" ON "pages" USING btree ("created_by_id");
  CREATE INDEX "whiteboards_created_by_idx" ON "whiteboards" USING btree ("created_by_id");
  CREATE INDEX "whiteboards_updated_at_idx" ON "whiteboards" USING btree ("updated_at");
  CREATE INDEX "whiteboards_created_at_idx" ON "whiteboards" USING btree ("created_at");
  CREATE INDEX "createdBy_2_idx" ON "whiteboards" USING btree ("created_by_id");
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_whiteboard_id_whiteboards_id_fk" FOREIGN KEY ("whiteboard_id") REFERENCES "public"."whiteboards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whiteboards_fk" FOREIGN KEY ("whiteboards_id") REFERENCES "public"."whiteboards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activity_modules_page_idx" ON "activity_modules" USING btree ("page_id");
  CREATE INDEX "activity_modules_whiteboard_idx" ON "activity_modules" USING btree ("whiteboard_id");
  CREATE INDEX "page_idx" ON "activity_modules" USING btree ("page_id");
  CREATE INDEX "whiteboard_idx" ON "activity_modules" USING btree ("whiteboard_id");
  CREATE INDEX "createdBy_3_idx" ON "assignments" USING btree ("created_by_id");
  CREATE INDEX "createdBy_4_idx" ON "quizzes" USING btree ("created_by_id");
  CREATE INDEX "createdBy_5_idx" ON "discussions" USING btree ("created_by_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_whiteboards_id_idx" ON "payload_locked_documents_rels" USING btree ("whiteboards_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "whiteboards" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "whiteboards" CASCADE;
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_page_id_pages_id_fk";
  
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_whiteboard_id_whiteboards_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_whiteboards_fk";
  
  DROP INDEX "activity_modules_page_idx";
  DROP INDEX "activity_modules_whiteboard_idx";
  DROP INDEX "page_idx";
  DROP INDEX "whiteboard_idx";
  DROP INDEX "createdBy_3_idx";
  DROP INDEX "createdBy_4_idx";
  DROP INDEX "createdBy_5_idx";
  DROP INDEX "payload_locked_documents_rels_pages_id_idx";
  DROP INDEX "payload_locked_documents_rels_whiteboards_id_idx";
  CREATE INDEX "createdBy_1_idx" ON "assignments" USING btree ("created_by_id");
  CREATE INDEX "createdBy_2_idx" ON "quizzes" USING btree ("created_by_id");
  CREATE INDEX "createdBy_3_idx" ON "discussions" USING btree ("created_by_id");
  ALTER TABLE "activity_modules" DROP COLUMN "page_id";
  ALTER TABLE "activity_modules" DROP COLUMN "whiteboard_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "whiteboards_id";`)
}
