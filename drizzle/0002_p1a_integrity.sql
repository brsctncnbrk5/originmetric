-- P1a integrity rules that Drizzle's schema DSL cannot express (custom, hand-written, reviewed).
--
-- 1. Immutability of facts (plan §12/§13): revenue_events, customer_visitors and events rows can
--    be inserted and deleted (retention/deletion workflows) but never updated. Sessions may only
--    update their counters (last_seen_at, pageviews); entry-source fields are immutable.
-- 2. customer_attribution's session pointers reference sessions(project_id, id) and are set to
--    NULL (only the pointer column, never project_id) when a session is purged. The copied
--    source strings stay, so reporting survives session retention.

CREATE FUNCTION "om_forbid_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "revenue_events_immutable" BEFORE UPDATE ON "revenue_events"
  FOR EACH ROW EXECUTE FUNCTION "om_forbid_update"();
--> statement-breakpoint
CREATE TRIGGER "customer_visitors_immutable" BEFORE UPDATE ON "customer_visitors"
  FOR EACH ROW EXECUTE FUNCTION "om_forbid_update"();
--> statement-breakpoint
CREATE TRIGGER "events_immutable" BEFORE UPDATE ON "events"
  FOR EACH ROW EXECUTE FUNCTION "om_forbid_update"();
--> statement-breakpoint
CREATE FUNCTION "om_sessions_entry_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.project_id, NEW.id, NEW.visitor_id, NEW.started_at, NEW.source, NEW.medium,
      NEW.campaign, NEW.content, NEW.term, NEW.referrer_host, NEW.landing_path)
     IS DISTINCT FROM
     (OLD.project_id, OLD.id, OLD.visitor_id, OLD.started_at, OLD.source, OLD.medium,
      OLD.campaign, OLD.content, OLD.term, OLD.referrer_host, OLD.landing_path) THEN
    RAISE EXCEPTION 'sessions entry-source fields are immutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "sessions_entry_immutable" BEFORE UPDATE ON "sessions"
  FOR EACH ROW EXECUTE FUNCTION "om_sessions_entry_immutable"();
--> statement-breakpoint
ALTER TABLE "customer_attribution" ADD CONSTRAINT "customer_attribution_credited_session_fk"
  FOREIGN KEY ("project_id", "credited_session_id") REFERENCES "sessions" ("project_id", "id")
  ON DELETE SET NULL ("credited_session_id");
--> statement-breakpoint
ALTER TABLE "customer_attribution" ADD CONSTRAINT "customer_attribution_first_touch_session_fk"
  FOREIGN KEY ("project_id", "first_touch_session_id") REFERENCES "sessions" ("project_id", "id")
  ON DELETE SET NULL ("first_touch_session_id");
