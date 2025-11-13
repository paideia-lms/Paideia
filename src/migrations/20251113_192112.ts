import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
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
  
  ALTER TABLE "analytics_settings_additional_js_scripts" ADD CONSTRAINT "analytics_settings_additional_js_scripts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "analytics_settings_additional_js_scripts_order_idx" ON "analytics_settings_additional_js_scripts" USING btree ("_order");
  CREATE INDEX "analytics_settings_additional_js_scripts_parent_id_idx" ON "analytics_settings_additional_js_scripts" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "analytics_settings_additional_js_scripts" CASCADE;
  DROP TABLE "analytics_settings" CASCADE;`)
}
