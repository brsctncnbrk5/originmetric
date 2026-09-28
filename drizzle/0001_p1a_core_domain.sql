CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text,
	"prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"scope" text DEFAULT 'server:write' NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix"),
	CONSTRAINT "api_keys_prefix_format" CHECK ("api_keys"."prefix" ~ '^[0-9A-Za-z]{8}$'),
	CONSTRAINT "api_keys_secret_hash_format" CHECK ("api_keys"."secret_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "api_keys_scope" CHECK ("api_keys"."scope" = 'server:write'),
	CONSTRAINT "api_keys_name_len" CHECK ("api_keys"."name" is null or char_length("api_keys"."name") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "customer_attribution" (
	"project_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"rules_version" integer NOT NULL,
	"status" text NOT NULL,
	"acquired_at" timestamp with time zone,
	"credited_session_id" uuid,
	"credited_source" text,
	"credited_medium" text,
	"credited_campaign" text,
	"first_touch_session_id" uuid,
	"first_touch_source" text,
	"computed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customer_attribution_pkey" PRIMARY KEY("project_id","customer_id"),
	CONSTRAINT "customer_attribution_status" CHECK ("customer_attribution"."status" in ('attributed', 'direct', 'unattributed')),
	CONSTRAINT "customer_attribution_credit_consistency" CHECK (("customer_attribution"."status" = 'unattributed' and "customer_attribution"."credited_source" is null and "customer_attribution"."first_touch_source" is null)
        or ("customer_attribution"."status" <> 'unattributed' and "customer_attribution"."credited_source" is not null and "customer_attribution"."first_touch_source" is not null and "customer_attribution"."acquired_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "customer_visitors" (
	"project_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"linked_at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	CONSTRAINT "customer_visitors_pkey" PRIMARY KEY("project_id","customer_id","visitor_id"),
	CONSTRAINT "customer_visitors_method" CHECK ("customer_visitors"."method" in ('server_identify', 'revenue_api'))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"project_id" uuid NOT NULL,
	"id" uuid DEFAULT uuidv7() NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "customers_pkey" PRIMARY KEY("project_id","id"),
	CONSTRAINT "customers_project_external_id_unique" UNIQUE("project_id","external_id"),
	CONSTRAINT "customers_external_id_len" CHECK ("customers"."external_id" is null or char_length("customers"."external_id") between 1 and 128)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"project_id" uuid NOT NULL,
	"id" uuid DEFAULT uuidv7() NOT NULL,
	"event_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"path" text NOT NULL,
	"referrer_host" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"screen_class" text,
	CONSTRAINT "events_pkey" PRIMARY KEY("project_id","id"),
	CONSTRAINT "events_project_event_id_unique" UNIQUE("project_id","event_id"),
	CONSTRAINT "events_screen_class" CHECK ("events"."screen_class" is null or "events"."screen_class" in ('mobile', 'tablet', 'desktop'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"site_key" text NOT NULL,
	"allowed_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"timezone" text NOT NULL,
	"primary_currency" char(3) NOT NULL,
	"excluded_referrers" text[] DEFAULT '{}'::text[] NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_site_key_unique" UNIQUE("site_key"),
	CONSTRAINT "projects_name_len" CHECK (char_length("projects"."name") between 1 and 200),
	CONSTRAINT "projects_site_key_format" CHECK ("projects"."site_key" ~ '^pk_[0-9A-Za-z]{22}$'),
	CONSTRAINT "projects_primary_currency_format" CHECK ("projects"."primary_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"project_id" uuid NOT NULL,
	"id" uuid DEFAULT uuidv7() NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"refund_of_id" uuid,
	"billing_interval" text,
	"subscription_id" text,
	"test" boolean DEFAULT false NOT NULL,
	"payload_hash" text NOT NULL,
	CONSTRAINT "revenue_events_pkey" PRIMARY KEY("project_id","id"),
	CONSTRAINT "revenue_events_project_event_id_unique" UNIQUE("project_id","event_id"),
	CONSTRAINT "revenue_events_type" CHECK ("revenue_events"."type" in ('payment', 'refund')),
	CONSTRAINT "revenue_events_amount_positive" CHECK ("revenue_events"."amount_minor" > 0),
	CONSTRAINT "revenue_events_currency_format" CHECK ("revenue_events"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "revenue_events_event_id_format" CHECK ("revenue_events"."event_id" ~ '^[A-Za-z0-9_.:-]{1,128}$'),
	CONSTRAINT "revenue_events_refund_of_only_refunds" CHECK ("revenue_events"."refund_of_id" is null or "revenue_events"."type" = 'refund'),
	CONSTRAINT "revenue_events_billing_interval" CHECK ("revenue_events"."billing_interval" is null or "revenue_events"."billing_interval" in ('one_time', 'month', 'year')),
	CONSTRAINT "revenue_events_subscription_id_len" CHECK ("revenue_events"."subscription_id" is null or char_length("revenue_events"."subscription_id") between 1 and 128),
	CONSTRAINT "revenue_events_payload_hash_format" CHECK ("revenue_events"."payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"project_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"pageviews" integer DEFAULT 1 NOT NULL,
	"source" text NOT NULL,
	"medium" text,
	"campaign" text,
	"content" text,
	"term" text,
	"referrer_host" text,
	"landing_path" text NOT NULL,
	CONSTRAINT "sessions_pkey" PRIMARY KEY("project_id","id"),
	CONSTRAINT "sessions_pageviews_positive" CHECK ("sessions"."pageviews" >= 1),
	CONSTRAINT "sessions_last_seen_after_start" CHECK ("sessions"."last_seen_at" >= "sessions"."started_at"),
	CONSTRAINT "sessions_source_nonempty" CHECK (char_length("sessions"."source") >= 1)
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_name_len" CHECK (char_length("workspaces"."name") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_attribution" ADD CONSTRAINT "customer_attribution_customer_fk" FOREIGN KEY ("project_id","customer_id") REFERENCES "public"."customers"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_visitors" ADD CONSTRAINT "customer_visitors_customer_fk" FOREIGN KEY ("project_id","customer_id") REFERENCES "public"."customers"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_fk" FOREIGN KEY ("project_id","session_id") REFERENCES "public"."sessions"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_customer_fk" FOREIGN KEY ("project_id","customer_id") REFERENCES "public"."customers"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_refund_of_fk" FOREIGN KEY ("project_id","refund_of_id") REFERENCES "public"."revenue_events"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_attribution_project_source_idx" ON "customer_attribution" USING btree ("project_id","credited_source");--> statement-breakpoint
CREATE INDEX "customer_visitors_project_visitor_idx" ON "customer_visitors" USING btree ("project_id","visitor_id");--> statement-breakpoint
CREATE INDEX "events_project_received_idx" ON "events" USING btree ("project_id","received_at");--> statement-breakpoint
CREATE INDEX "revenue_events_project_occurred_idx" ON "revenue_events" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "revenue_events_project_customer_idx" ON "revenue_events" USING btree ("project_id","customer_id");--> statement-breakpoint
CREATE INDEX "sessions_project_visitor_started_idx" ON "sessions" USING btree ("project_id","visitor_id","started_at");--> statement-breakpoint
CREATE INDEX "sessions_project_started_idx" ON "sessions" USING btree ("project_id","started_at");