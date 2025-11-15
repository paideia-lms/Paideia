import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create analytics settings tables
  // Note: Payload will automatically create the initial analytics_settings row on first access.
  // The code handles missing data gracefully by defaulting to empty arrays.
  await db.execute(sql`
   CREATE TABLE "analytics_settings_additional_js_scripts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"src" varchar NOT NULL,
  	"defer" boolean DEFAULT false,
  	"async" boolean DEFAULT false,
  	"data_website_id" varchar,
  	"data_domain" varchar,
  	"data_site" varchar,
  	"data_measurement_id" varchar
  );
  
  CREATE TABLE "analytics_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  -- Add grading fields to assignment_submissions
  -- All columns are nullable, so no data backfilling is needed.
  -- Existing submissions will have NULL values for these fields, which is expected.
  ALTER TABLE "assignment_submissions" ADD COLUMN "grade" numeric;
  ALTER TABLE "assignment_submissions" ADD COLUMN "feedback" varchar;
  ALTER TABLE "assignment_submissions" ADD COLUMN "graded_by_id" integer;
  ALTER TABLE "assignment_submissions" ADD COLUMN "graded_at" timestamp(3) with time zone;
  ALTER TABLE "analytics_settings_additional_js_scripts" ADD CONSTRAINT "analytics_settings_additional_js_scripts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "analytics_settings_additional_js_scripts_order_idx" ON "analytics_settings_additional_js_scripts" USING btree ("_order");
  CREATE INDEX "analytics_settings_additional_js_scripts_parent_id_idx" ON "analytics_settings_additional_js_scripts" USING btree ("_parent_id");
  ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_id_users_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "assignment_submissions_graded_by_idx" ON "assignment_submissions" USING btree ("graded_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "analytics_settings_additional_js_scripts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "analytics_settings_additional_js_scripts" CASCADE;
  DROP TABLE "analytics_settings" CASCADE;
  ALTER TABLE "assignment_submissions" DROP CONSTRAINT "assignment_submissions_graded_by_id_users_id_fk";
  
  DROP INDEX "assignment_submissions_graded_by_idx";
  ALTER TABLE "assignment_submissions" DROP COLUMN "grade";
  ALTER TABLE "assignment_submissions" DROP COLUMN "feedback";
  ALTER TABLE "assignment_submissions" DROP COLUMN "graded_by_id";
  ALTER TABLE "assignment_submissions" DROP COLUMN "graded_at";`)
}
