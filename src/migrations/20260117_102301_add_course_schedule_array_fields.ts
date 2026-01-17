import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "courses_recurring_schedules_days_of_week" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" numeric NOT NULL
  );
  
  CREATE TABLE "courses_recurring_schedules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone
  );
  
  CREATE TABLE "courses_specific_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL
  );
  
  ALTER TABLE "courses_recurring_schedules_days_of_week" ADD CONSTRAINT "courses_recurring_schedules_days_of_week_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_recurring_schedules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_recurring_schedules" ADD CONSTRAINT "courses_recurring_schedules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_specific_dates" ADD CONSTRAINT "courses_specific_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_recurring_schedules_days_of_week_order_idx" ON "courses_recurring_schedules_days_of_week" USING btree ("_order");
  CREATE INDEX "courses_recurring_schedules_days_of_week_parent_id_idx" ON "courses_recurring_schedules_days_of_week" USING btree ("_parent_id");
  CREATE INDEX "courses_recurring_schedules_order_idx" ON "courses_recurring_schedules" USING btree ("_order");
  CREATE INDEX "courses_recurring_schedules_parent_id_idx" ON "courses_recurring_schedules" USING btree ("_parent_id");
  CREATE INDEX "courses_specific_dates_order_idx" ON "courses_specific_dates" USING btree ("_order");
  CREATE INDEX "courses_specific_dates_parent_id_idx" ON "courses_specific_dates" USING btree ("_parent_id");
  ALTER TABLE "courses" DROP COLUMN "schedule";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "courses_recurring_schedules_days_of_week" CASCADE;
  DROP TABLE "courses_recurring_schedules" CASCADE;
  DROP TABLE "courses_specific_dates" CASCADE;
  ALTER TABLE "courses" ADD COLUMN "schedule" jsonb;`)
}
