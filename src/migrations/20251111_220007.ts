import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "appearance_settings_additional_css_stylesheets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "appearance_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "appearance_settings_additional_css_stylesheets" ADD CONSTRAINT "appearance_settings_additional_css_stylesheets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."appearance_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "appearance_settings_additional_css_stylesheets_order_idx" ON "appearance_settings_additional_css_stylesheets" USING btree ("_order");
  CREATE INDEX "appearance_settings_additional_css_stylesheets_parent_id_idx" ON "appearance_settings_additional_css_stylesheets" USING btree ("_parent_id");`)

  // Create initial appearance_settings global record with empty stylesheets array
  // This ensures the global exists when the system tries to read it
  await payload.updateGlobal({
    slug: 'appearance-settings',
    data: {
      additionalCssStylesheets: [],
    },
    req,
    overrideAccess: true,
  })
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "appearance_settings_additional_css_stylesheets" CASCADE;
  DROP TABLE "appearance_settings" CASCADE;`)
}
