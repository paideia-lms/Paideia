import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_modules_type" AS ENUM('page', 'whiteboard', 'assignment', 'quiz', 'discussion');
  CREATE TYPE "public"."enum_activity_modules_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_tags_tag_type" AS ENUM('release', 'milestone', 'snapshot');
  CREATE TABLE "activity_modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"branch" varchar DEFAULT 'main' NOT NULL,
  	"origin_id" integer,
  	"type" "enum_activity_modules_type" NOT NULL,
  	"status" "enum_activity_modules_status" DEFAULT 'draft',
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hash" varchar NOT NULL,
  	"activity_module_id" integer,
  	"message" varchar NOT NULL,
  	"author_id" integer NOT NULL,
  	"parent_commit_id" integer,
  	"commit_date" timestamp(3) with time zone NOT NULL,
  	"content" jsonb NOT NULL,
  	"content_hash" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"commit_id" integer NOT NULL,
  	"tag_type" "enum_tags_tag_type" DEFAULT 'snapshot',
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_modules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commits_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tags_id" integer;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_origin_id_activity_modules_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commits" ADD CONSTRAINT "commits_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commits" ADD CONSTRAINT "commits_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commits" ADD CONSTRAINT "commits_parent_commit_id_commits_id_fk" FOREIGN KEY ("parent_commit_id") REFERENCES "public"."commits"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_commit_id_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."commits"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_modules_origin_idx" ON "activity_modules" USING btree ("origin_id");
  CREATE INDEX "activity_modules_created_by_idx" ON "activity_modules" USING btree ("created_by_id");
  CREATE INDEX "activity_modules_updated_at_idx" ON "activity_modules" USING btree ("updated_at");
  CREATE INDEX "activity_modules_created_at_idx" ON "activity_modules" USING btree ("created_at");
  CREATE UNIQUE INDEX "commits_hash_idx" ON "commits" USING btree ("hash");
  CREATE INDEX "commits_activity_module_idx" ON "commits" USING btree ("activity_module_id");
  CREATE INDEX "commits_author_idx" ON "commits" USING btree ("author_id");
  CREATE INDEX "commits_parent_commit_idx" ON "commits" USING btree ("parent_commit_id");
  CREATE INDEX "commits_updated_at_idx" ON "commits" USING btree ("updated_at");
  CREATE INDEX "commits_created_at_idx" ON "commits" USING btree ("created_at");
  CREATE UNIQUE INDEX "activityModule_hash_idx" ON "commits" USING btree ("activity_module_id","hash");
  CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");
  CREATE INDEX "tags_commit_idx" ON "tags" USING btree ("commit_id");
  CREATE INDEX "tags_created_by_idx" ON "tags" USING btree ("created_by_id");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_modules_fk" FOREIGN KEY ("activity_modules_id") REFERENCES "public"."activity_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commits_fk" FOREIGN KEY ("commits_id") REFERENCES "public"."commits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activity_modules_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_modules_id");
  CREATE INDEX "payload_locked_documents_rels_commits_id_idx" ON "payload_locked_documents_rels" USING btree ("commits_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_modules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "commits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tags" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "activity_modules" CASCADE;
  DROP TABLE "commits" CASCADE;
  DROP TABLE "tags" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activity_modules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commits_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tags_fk";
  
  DROP INDEX "payload_locked_documents_rels_activity_modules_id_idx";
  DROP INDEX "payload_locked_documents_rels_commits_id_idx";
  DROP INDEX "payload_locked_documents_rels_tags_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activity_modules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commits_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tags_id";
  DROP TYPE "public"."enum_activity_modules_type";
  DROP TYPE "public"."enum_activity_modules_status";
  DROP TYPE "public"."enum_tags_tag_type";`)
}
