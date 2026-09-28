// Drizzle schema: the P1a core domain (plan §12).
//
// Rules applied throughout:
// - Internal IDs are PostgreSQL 18 native `uuidv7()`.
// - Every analytics/domain child table carries `project_id`; its keys and indexes lead with it.
// - Cross-project references are impossible at the DB level: child rows reference
//   `(project_id, <id>)` through composite foreign keys, never a bare id.
// - Timestamps are `timestamptz` (UTC semantics). Money is BIGINT minor units + ISO currency.
// - No JSON/JSONB for core fields.
//
// Not expressible in Drizzle and therefore kept in the custom migration
// `drizzle/0002_p1a_integrity.sql`: immutability triggers (events, sessions entry fields,
// customer_visitors, revenue_events) and the SET NULL (column) foreign keys from
// customer_attribution's session pointers to sessions.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const uuidv7 = sql`uuidv7()`;
const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const emptyTextArray = sql`'{}'::text[]`;

// ---------------------------------------------------------------------------------------------
// Tenancy (minimal P1a shape: no users, members, plans or billing fields yet)
// ---------------------------------------------------------------------------------------------

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().default(uuidv7),
    name: text("name").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [check("workspaces_name_len", sql`char_length(${t.name}) between 1 and 200`)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().default(uuidv7),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Public, non-secret project identifier used by the browser tracker (P1b). */
    siteKey: text("site_key").notNull().unique("projects_site_key_unique"),
    allowedDomains: text("allowed_domains").array().notNull().default(emptyTextArray),
    /** IANA timezone name (validated in the application). */
    timezone: text("timezone").notNull(),
    primaryCurrency: char("primary_currency", { length: 3 }).notNull(),
    excludedReferrers: text("excluded_referrers").array().notNull().default(emptyTextArray),
    deletedAt: tstz("deleted_at"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("projects_name_len", sql`char_length(${t.name}) between 1 and 200`),
    check("projects_site_key_format", sql`${t.siteKey} ~ '^pk_[0-9A-Za-z]{22}$'`),
    check("projects_primary_currency_format", sql`${t.primaryCurrency} ~ '^[A-Z]{3}$'`),
  ],
);

export const API_KEY_SCOPE = "server:write" as const;

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().default(uuidv7),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name"),
    /** Public 8-character prefix (`om_sk_<prefix>_…`). */
    prefix: text("prefix").notNull().unique("api_keys_prefix_unique"),
    /** Lowercase hex SHA-256 of the secret part. The full key is never stored. */
    secretHash: text("secret_hash").notNull(),
    scope: text("scope").notNull().default(API_KEY_SCOPE),
    revokedAt: tstz("revoked_at"),
    lastUsedAt: tstz("last_used_at"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("api_keys_prefix_format", sql`${t.prefix} ~ '^[0-9A-Za-z]{8}$'`),
    check("api_keys_secret_hash_format", sql`${t.secretHash} ~ '^[0-9a-f]{64}$'`),
    check("api_keys_scope", sql`${t.scope} = 'server:write'`),
    check("api_keys_name_len", sql`${t.name} is null or char_length(${t.name}) between 1 and 100`),
  ],
);

// ---------------------------------------------------------------------------------------------
// Browser facts (tables only; ingestion is P1b)
// ---------------------------------------------------------------------------------------------

/** Sessions = attribution touches. Entry-source fields are immutable (trigger in 0002). */
export const sessions = pgTable(
  "sessions",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Tracker-generated session UUID; unique only within a project. */
    id: uuid("id").notNull(),
    visitorId: uuid("visitor_id").notNull(),
    startedAt: tstz("started_at").notNull(),
    lastSeenAt: tstz("last_seen_at").notNull(),
    pageviews: integer("pageviews").notNull().default(1),
    /** Normalized source (`direct` for direct/self-referral touches). */
    source: text("source").notNull(),
    medium: text("medium"),
    campaign: text("campaign"),
    content: text("content"),
    term: text("term"),
    referrerHost: text("referrer_host"),
    landingPath: text("landing_path").notNull(),
  },
  (t) => [
    primaryKey({ name: "sessions_pkey", columns: [t.projectId, t.id] }),
    index("sessions_project_visitor_started_idx").on(t.projectId, t.visitorId, t.startedAt),
    index("sessions_project_started_idx").on(t.projectId, t.startedAt),
    check("sessions_pageviews_positive", sql`${t.pageviews} >= 1`),
    check("sessions_last_seen_after_start", sql`${t.lastSeenAt} >= ${t.startedAt}`),
    check("sessions_source_nonempty", sql`char_length(${t.source}) >= 1`),
  ],
);

/** Raw browser events (page views). Immutable facts (trigger in 0002). */
export const events = pgTable(
  "events",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    id: uuid("id").notNull().default(uuidv7),
    /** Tracker-generated event UUID (dedup key). */
    eventId: uuid("event_id").notNull(),
    visitorId: uuid("visitor_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    /** Server receive time: authoritative (plan §11). */
    receivedAt: tstz("received_at").notNull(),
    path: text("path").notNull(),
    referrerHost: text("referrer_host"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    screenClass: text("screen_class"),
  },
  (t) => [
    primaryKey({ name: "events_pkey", columns: [t.projectId, t.id] }),
    unique("events_project_event_id_unique").on(t.projectId, t.eventId),
    index("events_project_received_idx").on(t.projectId, t.receivedAt),
    foreignKey({
      name: "events_session_fk",
      columns: [t.projectId, t.sessionId],
      foreignColumns: [sessions.projectId, sessions.id],
    }).onDelete("cascade"),
    check(
      "events_screen_class",
      sql`${t.screenClass} is null or ${t.screenClass} in ('mobile', 'tablet', 'desktop')`,
    ),
  ],
);

// ---------------------------------------------------------------------------------------------
// Identity (trusted server-side facts only)
// ---------------------------------------------------------------------------------------------

export const customers = pgTable(
  "customers",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    id: uuid("id").notNull().default(uuidv7),
    /** Founder's opaque, non-PII customer ID. Nulled on deletion (tombstone). */
    externalId: text("external_id"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    deletedAt: tstz("deleted_at"),
  },
  (t) => [
    primaryKey({ name: "customers_pkey", columns: [t.projectId, t.id] }),
    unique("customers_project_external_id_unique").on(t.projectId, t.externalId),
    check(
      "customers_external_id_len",
      sql`${t.externalId} is null or char_length(${t.externalId}) between 1 and 128`,
    ),
  ],
);

export const LINK_METHODS = ["server_identify", "revenue_api"] as const;
export type LinkMethod = (typeof LINK_METHODS)[number];

/** Trusted visitor ↔ customer links. Created only by secret-key calls. Immutable. */
export const customerVisitors = pgTable(
  "customer_visitors",
  {
    projectId: uuid("project_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    visitorId: uuid("visitor_id").notNull(),
    linkedAt: tstz("linked_at").notNull(),
    method: text("method").$type<LinkMethod>().notNull(),
  },
  (t) => [
    primaryKey({
      name: "customer_visitors_pkey",
      columns: [t.projectId, t.customerId, t.visitorId],
    }),
    foreignKey({
      name: "customer_visitors_customer_fk",
      columns: [t.projectId, t.customerId],
      foreignColumns: [customers.projectId, customers.id],
    }).onDelete("cascade"),
    index("customer_visitors_project_visitor_idx").on(t.projectId, t.visitorId),
    check("customer_visitors_method", sql`${t.method} in ('server_identify', 'revenue_api')`),
  ],
);

// ---------------------------------------------------------------------------------------------
// Money (source of truth). Immutable (trigger in 0002).
// ---------------------------------------------------------------------------------------------

export const REVENUE_TYPES = ["payment", "refund"] as const;
export type RevenueType = (typeof REVENUE_TYPES)[number];
export const BILLING_INTERVALS = ["one_time", "month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const revenueEvents = pgTable(
  "revenue_events",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    id: uuid("id").notNull().default(uuidv7),
    /** Founder-side idempotency / dedup key. */
    eventId: text("event_id").notNull(),
    type: text("type").$type<RevenueType>().notNull(),
    customerId: uuid("customer_id").notNull(),
    /** Positive minor units; the event type supplies the sign. */
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    occurredAt: tstz("occurred_at").notNull(),
    receivedAt: tstz("received_at").notNull(),
    refundOfId: uuid("refund_of_id"),
    billingInterval: text("billing_interval").$type<BillingInterval>(),
    subscriptionId: text("subscription_id"),
    test: boolean("test").notNull().default(false),
    /** Lowercase hex SHA-256 of the canonical semantic payload (idempotency). */
    payloadHash: text("payload_hash").notNull(),
  },
  (t) => [
    primaryKey({ name: "revenue_events_pkey", columns: [t.projectId, t.id] }),
    unique("revenue_events_project_event_id_unique").on(t.projectId, t.eventId),
    index("revenue_events_project_occurred_idx").on(t.projectId, t.occurredAt),
    index("revenue_events_project_customer_idx").on(t.projectId, t.customerId),
    foreignKey({
      name: "revenue_events_customer_fk",
      columns: [t.projectId, t.customerId],
      foreignColumns: [customers.projectId, customers.id],
    }),
    foreignKey({
      name: "revenue_events_refund_of_fk",
      columns: [t.projectId, t.refundOfId],
      foreignColumns: [t.projectId, t.id],
    }),
    check("revenue_events_type", sql`${t.type} in ('payment', 'refund')`),
    check("revenue_events_amount_positive", sql`${t.amountMinor} > 0`),
    check("revenue_events_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("revenue_events_event_id_format", sql`${t.eventId} ~ '^[A-Za-z0-9_.:-]{1,128}$'`),
    check(
      "revenue_events_refund_of_only_refunds",
      sql`${t.refundOfId} is null or ${t.type} = 'refund'`,
    ),
    check(
      "revenue_events_billing_interval",
      sql`${t.billingInterval} is null or ${t.billingInterval} in ('one_time', 'month', 'year')`,
    ),
    check(
      "revenue_events_subscription_id_len",
      sql`${t.subscriptionId} is null or char_length(${t.subscriptionId}) between 1 and 128`,
    ),
    check("revenue_events_payload_hash_format", sql`${t.payloadHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

// ---------------------------------------------------------------------------------------------
// Derived, recomputable attribution (one row per customer)
// ---------------------------------------------------------------------------------------------

export const ATTRIBUTION_STATUSES = ["attributed", "direct", "unattributed"] as const;
export type AttributionStatus = (typeof ATTRIBUTION_STATUSES)[number];

export const customerAttribution = pgTable(
  "customer_attribution",
  {
    projectId: uuid("project_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    rulesVersion: integer("rules_version").notNull(),
    status: text("status").$type<AttributionStatus>().notNull(),
    acquiredAt: tstz("acquired_at"),
    /** Soft pointer; set to NULL if the session is purged (FK in 0002). Strings below survive. */
    creditedSessionId: uuid("credited_session_id"),
    creditedSource: text("credited_source"),
    creditedMedium: text("credited_medium"),
    creditedCampaign: text("credited_campaign"),
    firstTouchSessionId: uuid("first_touch_session_id"),
    firstTouchSource: text("first_touch_source"),
    computedAt: tstz("computed_at").notNull(),
  },
  (t) => [
    primaryKey({ name: "customer_attribution_pkey", columns: [t.projectId, t.customerId] }),
    foreignKey({
      name: "customer_attribution_customer_fk",
      columns: [t.projectId, t.customerId],
      foreignColumns: [customers.projectId, customers.id],
    }).onDelete("cascade"),
    index("customer_attribution_project_source_idx").on(t.projectId, t.creditedSource),
    check(
      "customer_attribution_status",
      sql`${t.status} in ('attributed', 'direct', 'unattributed')`,
    ),
    check(
      "customer_attribution_credit_consistency",
      sql`(${t.status} = 'unattributed' and ${t.creditedSource} is null and ${t.firstTouchSource} is null)
        or (${t.status} <> 'unattributed' and ${t.creditedSource} is not null and ${t.firstTouchSource} is not null and ${t.acquiredAt} is not null)`,
    ),
  ],
);
