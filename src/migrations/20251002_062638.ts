import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "commits_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"activity_modules_id" integer
  );
  
  ALTER TABLE "commits" DROP CONSTRAINT "commits_activity_module_id_activity_modules_id_fk";
  
  DROP INDEX "commits_activity_module_idx";
  DROP INDEX "activityModule_hash_idx";
  ALTER TABLE "commits_rels" ADD CONSTRAINT "commits_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."commits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "commits_rels" ADD CONSTRAINT "commits_rels_activity_modules_fk" FOREIGN KEY ("activity_modules_id") REFERENCES "public"."activity_modules"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "commits_rels_order_idx" ON "commits_rels" USING btree ("order");
  CREATE INDEX "commits_rels_parent_idx" ON "commits_rels" USING btree ("parent_id");
  CREATE INDEX "commits_rels_path_idx" ON "commits_rels" USING btree ("path");
  CREATE INDEX "commits_rels_activity_modules_id_idx" ON "commits_rels" USING btree ("activity_modules_id");
  ALTER TABLE "commits" DROP COLUMN "activity_module_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "commits_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "commits_rels" CASCADE;
  ALTER TABLE "commits" ADD COLUMN "activity_module_id" integer;
  ALTER TABLE "commits" ADD CONSTRAINT "commits_activity_module_id_activity_modules_id_fk" FOREIGN KEY ("activity_module_id") REFERENCES "public"."activity_modules"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "commits_activity_module_idx" ON "commits" USING btree ("activity_module_id");
  CREATE UNIQUE INDEX "activityModule_hash_idx" ON "commits" USING btree ("activity_module_id","hash");`)
}
