import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tags" ADD COLUMN "origin_id" integer NOT NULL;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_origin_id_origins_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."origins"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tags_origin_idx" ON "tags" USING btree ("origin_id");
  CREATE UNIQUE INDEX "name_origin_idx" ON "tags" USING btree ("name","origin_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tags" DROP CONSTRAINT "tags_origin_id_origins_id_fk";
  
  DROP INDEX "tags_origin_idx";
  DROP INDEX "name_origin_idx";
  ALTER TABLE "tags" DROP COLUMN "origin_id";`)
}
