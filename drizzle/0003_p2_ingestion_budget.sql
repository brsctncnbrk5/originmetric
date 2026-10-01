CREATE TABLE "ingestion_daily" (
	"project_id" uuid NOT NULL,
	"day" date NOT NULL,
	"accepted" integer NOT NULL,
	CONSTRAINT "ingestion_daily_project_id_day_pk" PRIMARY KEY("project_id","day"),
	CONSTRAINT "ingestion_daily_positive" CHECK ("ingestion_daily"."accepted" > 0)
);
--> statement-breakpoint
ALTER TABLE "ingestion_daily" ADD CONSTRAINT "ingestion_daily_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;