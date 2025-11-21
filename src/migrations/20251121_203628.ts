import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "appearance_settings" ADD COLUMN "logo_light_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "logo_dark_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "compact_logo_light_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "compact_logo_dark_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "favicon_light_id" integer;
  ALTER TABLE "appearance_settings" ADD COLUMN "favicon_dark_id" integer;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_logo_light_id_media_id_fk" FOREIGN KEY ("logo_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_logo_dark_id_media_id_fk" FOREIGN KEY ("logo_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_compact_logo_light_id_media_id_fk" FOREIGN KEY ("compact_logo_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_compact_logo_dark_id_media_id_fk" FOREIGN KEY ("compact_logo_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_favicon_light_id_media_id_fk" FOREIGN KEY ("favicon_light_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appearance_settings" ADD CONSTRAINT "appearance_settings_favicon_dark_id_media_id_fk" FOREIGN KEY ("favicon_dark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "appearance_settings_logo_light_idx" ON "appearance_settings" USING btree ("logo_light_id");
  CREATE INDEX "appearance_settings_logo_dark_idx" ON "appearance_settings" USING btree ("logo_dark_id");
  CREATE INDEX "appearance_settings_compact_logo_light_idx" ON "appearance_settings" USING btree ("compact_logo_light_id");
  CREATE INDEX "appearance_settings_compact_logo_dark_idx" ON "appearance_settings" USING btree ("compact_logo_dark_id");
  CREATE INDEX "appearance_settings_favicon_light_idx" ON "appearance_settings" USING btree ("favicon_light_id");
  CREATE INDEX "appearance_settings_favicon_dark_idx" ON "appearance_settings" USING btree ("favicon_dark_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_logo_light_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_logo_dark_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_compact_logo_light_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_compact_logo_dark_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_favicon_light_id_media_id_fk";
  
  ALTER TABLE "appearance_settings" DROP CONSTRAINT "appearance_settings_favicon_dark_id_media_id_fk";
  
  DROP INDEX "appearance_settings_logo_light_idx";
  DROP INDEX "appearance_settings_logo_dark_idx";
  DROP INDEX "appearance_settings_compact_logo_light_idx";
  DROP INDEX "appearance_settings_compact_logo_dark_idx";
  DROP INDEX "appearance_settings_favicon_light_idx";
  DROP INDEX "appearance_settings_favicon_dark_idx";
  ALTER TABLE "appearance_settings" DROP COLUMN "logo_light_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "logo_dark_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "compact_logo_light_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "compact_logo_dark_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "favicon_light_id";
  ALTER TABLE "appearance_settings" DROP COLUMN "favicon_dark_id";`)
}
