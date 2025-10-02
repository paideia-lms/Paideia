import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "origins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_origin_id_activity_modules_id_fk";
  
  ALTER TABLE "activity_modules" ALTER COLUMN "origin_id" SET NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "origins_id" integer;
  ALTER TABLE "origins" ADD CONSTRAINT "origins_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "origins_created_by_idx" ON "origins" USING btree ("created_by_id");
  CREATE INDEX "origins_updated_at_idx" ON "origins" USING btree ("updated_at");
  CREATE INDEX "origins_created_at_idx" ON "origins" USING btree ("created_at");
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_origin_id_origins_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."origins"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_origins_fk" FOREIGN KEY ("origins_id") REFERENCES "public"."origins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "branch_origin_idx" ON "activity_modules" USING btree ("branch","origin_id");
  CREATE INDEX "payload_locked_documents_rels_origins_id_idx" ON "payload_locked_documents_rels" USING btree ("origins_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "origins" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "origins" CASCADE;
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_origin_id_origins_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_origins_fk";
  
  DROP INDEX "branch_origin_idx";
  DROP INDEX "payload_locked_documents_rels_origins_id_idx";
  ALTER TABLE "activity_modules" ALTER COLUMN "origin_id" DROP NOT NULL;
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_origin_id_activity_modules_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "origins_id";`)
}
