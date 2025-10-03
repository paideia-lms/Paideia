import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "commits_updated_at_idx";
  DROP INDEX "commits_created_at_idx";
  DROP INDEX "from_to_idx";
  ALTER TABLE "merge_requests" ADD COLUMN "closed_at" timestamp(3) with time zone;
  ALTER TABLE "merge_requests" ADD COLUMN "closed_by_id" integer;
  ALTER TABLE "merge_requests" ADD COLUMN "allow_comments" boolean DEFAULT true;
  ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "merge_requests_closed_by_idx" ON "merge_requests" USING btree ("closed_by_id");
  ALTER TABLE "commits" DROP COLUMN "updated_at";
  ALTER TABLE "commits" DROP COLUMN "created_at";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "merge_requests" DROP CONSTRAINT "merge_requests_closed_by_id_users_id_fk";
  
  DROP INDEX "merge_requests_closed_by_idx";
  ALTER TABLE "commits" ADD COLUMN "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL;
  ALTER TABLE "commits" ADD COLUMN "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL;
  CREATE INDEX "commits_updated_at_idx" ON "commits" USING btree ("updated_at");
  CREATE INDEX "commits_created_at_idx" ON "commits" USING btree ("created_at");
  CREATE UNIQUE INDEX "from_to_idx" ON "merge_requests" USING btree ("from_id","to_id");
  ALTER TABLE "merge_requests" DROP COLUMN "closed_at";
  ALTER TABLE "merge_requests" DROP COLUMN "closed_by_id";
  ALTER TABLE "merge_requests" DROP COLUMN "allow_comments";`)
}
