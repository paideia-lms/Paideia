import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "enrollments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"groups_id" integer
  );
  
  CREATE TABLE "groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"course_id" integer NOT NULL,
  	"parent_id" integer,
  	"path" varchar NOT NULL,
  	"description" varchar,
  	"color" varchar,
  	"max_members" numeric,
  	"is_active" boolean DEFAULT true,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "enrollments_groups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "enrollments_groups" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "groups_id" integer;
  ALTER TABLE "enrollments_rels" ADD CONSTRAINT "enrollments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enrollments_rels" ADD CONSTRAINT "enrollments_rels_groups_fk" FOREIGN KEY ("groups_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "groups" ADD CONSTRAINT "groups_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_id_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "enrollments_rels_order_idx" ON "enrollments_rels" USING btree ("order");
  CREATE INDEX "enrollments_rels_parent_idx" ON "enrollments_rels" USING btree ("parent_id");
  CREATE INDEX "enrollments_rels_path_idx" ON "enrollments_rels" USING btree ("path");
  CREATE INDEX "enrollments_rels_groups_id_idx" ON "enrollments_rels" USING btree ("groups_id");
  CREATE INDEX "groups_course_idx" ON "groups" USING btree ("course_id");
  CREATE INDEX "groups_parent_idx" ON "groups" USING btree ("parent_id");
  CREATE UNIQUE INDEX "groups_path_idx" ON "groups" USING btree ("path");
  CREATE INDEX "groups_updated_at_idx" ON "groups" USING btree ("updated_at");
  CREATE INDEX "groups_created_at_idx" ON "groups" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_path_idx" ON "groups" USING btree ("course_id","path");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_groups_fk" FOREIGN KEY ("groups_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("groups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "enrollments_groups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"group_path" varchar NOT NULL
  );
  
  ALTER TABLE "enrollments_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "groups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "enrollments_rels" CASCADE;
  DROP TABLE "groups" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_groups_fk";
  
  DROP INDEX "payload_locked_documents_rels_groups_id_idx";
  ALTER TABLE "enrollments_groups" ADD CONSTRAINT "enrollments_groups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "enrollments_groups_order_idx" ON "enrollments_groups" USING btree ("_order");
  CREATE INDEX "enrollments_groups_parent_id_idx" ON "enrollments_groups" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "groups_id";`)
}
