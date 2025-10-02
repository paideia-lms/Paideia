import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_merge_requests_status" AS ENUM('open', 'merged', 'rejected', 'closed');
  CREATE TABLE "merge_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"from_id" integer NOT NULL,
  	"to_id" integer NOT NULL,
  	"status" "enum_merge_requests_status" DEFAULT 'open',
  	"rejected_at" timestamp(3) with time zone,
  	"rejected_by_id" integer,
  	"merged_at" timestamp(3) with time zone,
  	"merged_by_id" integer,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "merge_request_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"comment" varchar NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"merge_request_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merge_requests_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "merge_request_comments_id" integer;
  ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_from_id_activity_modules_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_to_id_activity_modules_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_merged_by_id_users_id_fk" FOREIGN KEY ("merged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "merge_request_comments" ADD CONSTRAINT "merge_request_comments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "merge_request_comments" ADD CONSTRAINT "merge_request_comments_merge_request_id_merge_requests_id_fk" FOREIGN KEY ("merge_request_id") REFERENCES "public"."merge_requests"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "merge_requests_from_idx" ON "merge_requests" USING btree ("from_id");
  CREATE INDEX "merge_requests_to_idx" ON "merge_requests" USING btree ("to_id");
  CREATE INDEX "merge_requests_rejected_by_idx" ON "merge_requests" USING btree ("rejected_by_id");
  CREATE INDEX "merge_requests_merged_by_idx" ON "merge_requests" USING btree ("merged_by_id");
  CREATE INDEX "merge_requests_created_by_idx" ON "merge_requests" USING btree ("created_by_id");
  CREATE INDEX "merge_requests_updated_at_idx" ON "merge_requests" USING btree ("updated_at");
  CREATE INDEX "merge_requests_created_at_idx" ON "merge_requests" USING btree ("created_at");
  CREATE UNIQUE INDEX "from_to_idx" ON "merge_requests" USING btree ("from_id","to_id");
  CREATE INDEX "merge_request_comments_created_by_idx" ON "merge_request_comments" USING btree ("created_by_id");
  CREATE INDEX "merge_request_comments_merge_request_idx" ON "merge_request_comments" USING btree ("merge_request_id");
  CREATE INDEX "merge_request_comments_updated_at_idx" ON "merge_request_comments" USING btree ("updated_at");
  CREATE INDEX "merge_request_comments_created_at_idx" ON "merge_request_comments" USING btree ("created_at");
  CREATE UNIQUE INDEX "mergeRequest_idx" ON "merge_request_comments" USING btree ("merge_request_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_merge_requests_fk" FOREIGN KEY ("merge_requests_id") REFERENCES "public"."merge_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_merge_request_comments_fk" FOREIGN KEY ("merge_request_comments_id") REFERENCES "public"."merge_request_comments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_merge_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("merge_requests_id");
  CREATE INDEX "payload_locked_documents_rels_merge_request_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("merge_request_comments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "merge_requests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "merge_request_comments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "merge_requests" CASCADE;
  DROP TABLE "merge_request_comments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_merge_requests_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_merge_request_comments_fk";
  
  DROP INDEX "payload_locked_documents_rels_merge_requests_id_idx";
  DROP INDEX "payload_locked_documents_rels_merge_request_comments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "merge_requests_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "merge_request_comments_id";
  DROP TYPE "public"."enum_merge_requests_status";`)
}
