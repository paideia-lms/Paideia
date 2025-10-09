import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_category_role_assignments_role" AS ENUM('category-admin', 'category-coordinator', 'category-reviewer');
  CREATE TABLE "category_role_assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"category_id" integer NOT NULL,
  	"role" "enum_category_role_assignments_role" NOT NULL,
  	"assigned_by_id" integer NOT NULL,
  	"assigned_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "category_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "category_role_assignments_id" integer;
  ALTER TABLE "category_role_assignments" ADD CONSTRAINT "category_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "category_role_assignments" ADD CONSTRAINT "category_role_assignments_category_id_course_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."course_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "category_role_assignments" ADD CONSTRAINT "category_role_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "category_role_assignments_user_idx" ON "category_role_assignments" USING btree ("user_id");
  CREATE INDEX "category_role_assignments_category_idx" ON "category_role_assignments" USING btree ("category_id");
  CREATE INDEX "category_role_assignments_assigned_by_idx" ON "category_role_assignments" USING btree ("assigned_by_id");
  CREATE INDEX "category_role_assignments_updated_at_idx" ON "category_role_assignments" USING btree ("updated_at");
  CREATE INDEX "category_role_assignments_created_at_idx" ON "category_role_assignments" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_category_idx" ON "category_role_assignments" USING btree ("user_id","category_id");
  CREATE INDEX "category_idx" ON "category_role_assignments" USING btree ("category_id");
  CREATE INDEX "user_idx" ON "category_role_assignments" USING btree ("user_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_category_role_assignments_fk" FOREIGN KEY ("category_role_assignments_id") REFERENCES "public"."category_role_assignments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "category_1_idx" ON "gradebook_items" USING btree ("category_id");
  CREATE INDEX "payload_locked_documents_rels_category_role_assignments__idx" ON "payload_locked_documents_rels" USING btree ("category_role_assignments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "category_role_assignments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "category_role_assignments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_category_role_assignments_fk";
  
  DROP INDEX "category_1_idx";
  DROP INDEX "payload_locked_documents_rels_category_role_assignments__idx";
  CREATE INDEX "category_idx" ON "gradebook_items" USING btree ("category_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "category_role_assignments_id";
  DROP TYPE "public"."enum_category_role_assignments_role";`)
}
