import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "files_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "files_id" integer;
  ALTER TABLE "files" ADD CONSTRAINT "files_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "files_rels" ADD CONSTRAINT "files_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "files_rels" ADD CONSTRAINT "files_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "files_created_by_idx" ON "files" USING btree ("created_by_id");
  CREATE INDEX "files_updated_at_idx" ON "files" USING btree ("updated_at");
  CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");
  CREATE INDEX "createdBy_7_idx" ON "files" USING btree ("created_by_id");
  CREATE INDEX "files_rels_order_idx" ON "files_rels" USING btree ("order");
  CREATE INDEX "files_rels_parent_idx" ON "files_rels" USING btree ("parent_id");
  CREATE INDEX "files_rels_path_idx" ON "files_rels" USING btree ("path");
  CREATE INDEX "files_rels_media_id_idx" ON "files_rels" USING btree ("media_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_files_id_idx" ON "payload_locked_documents_rels" USING btree ("files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "files_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "files" CASCADE;
  DROP TABLE "files_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_files_fk";
  
  DROP INDEX "payload_locked_documents_rels_files_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "files_id";`)
}
