import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "activity_module_grants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"activity_module_id" integer NOT NULL,
  	"granted_to_id" integer NOT NULL,
  	"granted_by_id" integer NOT NULL,
  	"granted_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "activityModule_idx";
  DROP INDEX "activityModule_1_idx";
  DROP INDEX "activityModule_2_idx";
  ALTER TABLE "activity_modules" ADD COLUMN "owner_id" integer NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_module_grants_id" integer;
  ALTER TABLE "activity_module_grants" ADD CONSTRAINT "activity_module_grants_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "activity_module_grants" ADD CONSTRAINT "activity_module_grants_granted_to_id_users_id_fk" FOREIGN KEY ("granted_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_module_grants" ADD CONSTRAINT "activity_module_grants_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_module_grants_activity_module_idx" ON "activity_module_grants" USING btree ("activity_module_id");
  CREATE INDEX "activity_module_grants_granted_to_idx" ON "activity_module_grants" USING btree ("granted_to_id");
  CREATE INDEX "activity_module_grants_granted_by_idx" ON "activity_module_grants" USING btree ("granted_by_id");
  CREATE INDEX "activity_module_grants_updated_at_idx" ON "activity_module_grants" USING btree ("updated_at");
  CREATE INDEX "activity_module_grants_created_at_idx" ON "activity_module_grants" USING btree ("created_at");
  CREATE UNIQUE INDEX "activityModule_grantedTo_idx" ON "activity_module_grants" USING btree ("activity_module_id","granted_to_id");
  CREATE INDEX "activityModule_idx" ON "activity_module_grants" USING btree ("activity_module_id");
  CREATE INDEX "grantedTo_idx" ON "activity_module_grants" USING btree ("granted_to_id");
  ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_module_grants_fk" FOREIGN KEY ("activity_module_grants_id") REFERENCES "public"."activity_module_grants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activity_modules_owner_idx" ON "activity_modules" USING btree ("owner_id");
  CREATE INDEX "owner_idx" ON "activity_modules" USING btree ("owner_id");
  CREATE INDEX "activityModule_1_idx" ON "assignment_submissions" USING btree ("activity_module_id");
  CREATE INDEX "activityModule_2_idx" ON "quiz_submissions" USING btree ("activity_module_id");
  CREATE INDEX "activityModule_3_idx" ON "discussion_submissions" USING btree ("activity_module_id");
  CREATE INDEX "payload_locked_documents_rels_activity_module_grants_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_module_grants_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_module_grants" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "activity_module_grants" CASCADE;
  ALTER TABLE "activity_modules" DROP CONSTRAINT "activity_modules_owner_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activity_module_grants_fk";
  
  DROP INDEX "activity_modules_owner_idx";
  DROP INDEX "owner_idx";
  DROP INDEX "activityModule_1_idx";
  DROP INDEX "activityModule_2_idx";
  DROP INDEX "activityModule_3_idx";
  DROP INDEX "payload_locked_documents_rels_activity_module_grants_id_idx";
  CREATE INDEX "activityModule_idx" ON "assignment_submissions" USING btree ("activity_module_id");
  CREATE INDEX "activityModule_1_idx" ON "quiz_submissions" USING btree ("activity_module_id");
  CREATE INDEX "activityModule_2_idx" ON "discussion_submissions" USING btree ("activity_module_id");
  ALTER TABLE "activity_modules" DROP COLUMN "owner_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activity_module_grants_id";`)
}
