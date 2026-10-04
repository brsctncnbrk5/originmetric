# Installation ease — separate MVP work package

2026-10-04. **Isolated technical experiment PASS; independent installation time
UNMEASURED.** Entry head `eb3fad8` (Better Auth implementation), assigned branch
`codex/originmetric-p2-vps-preparation`. Working tree was clean: no uncommitted
Better Auth work was overwritten. Basis: CLAUDE, STATUS, locked canonical plan (especially §§3–7, 19, 26–28,
33), latest P3 reports and P2 evidence. The canonical plan file,
phase numbering and exit criteria are unchanged. D-012 records this explicitly
authorized work package. P2/G1 and P3 acceptance remain OPEN; **P4 is not DONE**.

## What installation requires today

On prepared OriginMetric infrastructure, six integration steps remain:

1. Sign in/create an account, create a project and register the SaaS hostname.
2. Copy the project-specific public tracker into the site and permit its script /
   ingestion host in CSP when applicable.
3. Wire existing analytics permission/withdrawal controls. Required consent and
   default GPC handling are preserved, not a newly selected production U7 policy.
4. Read `getVisitorId()` at signup, send it to the SaaS server and store it against
   a server-chosen opaque customer ID. Null under refused consent is expected.
5. Create a secret server key, put it in private server env, and send the saved pair
   with a server-side test payment. Keep a stable event ID/time/payload for retries.
6. Inspect persisted tracker, test revenue and source match in the project page;
   check expected source, campaign and minor-unit amount/currency.

This is a developer integration: HTML/JavaScript, consent callbacks, signup/backend
state, REST/JSON/Bearer auth, private env, UUID/null handling, idempotency, UTC times
and integer minor-unit money are still necessary. It is not no-code. Cross-domain
checkout needs saved backend identity or verified metadata; different devices,
blocked storage and missing consent still limit coverage.

For an existing SaaS these are usually **four integration surfaces** (HTML/layout,
consent UI, signup server, verified payment handler), plus a server helper and
private env. They are not universally six files: a framework can combine/split them.
Actual file/LOC evidence below is for the controlled sample only. A self-hosting
customer additionally needs Node/Docker/PostgreSQL, HTTPS, migrations, auth/env,
backup and deployment setup. No total self-host provisioning time was measured.
The current public production still runs the earlier closed-ingestion deployment:
this source improvement is **not yet deployed or usable as public onboarding**.
Better Auth actual email delivery and authorized rollout remain open. Remaining
canonical P4 items (framework tabs, other-language identify snippets, detailed
rejection/error health metrics, test-data deletion, U7 and timed acceptance) are
not completed or waived by this narrower work package.

## Applied experiment and measurements

`npm run installation:demo` creates a fresh loopback PostgreSQL 18.6 database and
Next production-build instance, then a **separate** Node sample SaaS on an ephemeral
loopback port. No new dependency, SDK, account or payment provider. It copies the
actual project's generated snippet from the authenticated UI. A fresh browser
visits Google/CPC/installation UTM, grants consent, creates an in-memory synthetic
SaaS account, and clicks simulated payment. The SaaS server chooses customer/event
IDs and calls the existing `/api/v1/revenue-events` with `visitor_id`, USD 2900 and
`test: true`. Actual stored data yields `google / installation / attributed`.
The downloaded `revenue.mjs` is also run directly as a Node CLI and yields another
matching test payment. The same original saved payment retries as `duplicate`.
A new customer after withdrawal has no visitor and yields `unattributed`, replacing
the checklist's previous source-match success. All fixture payment facts are test
facts, never money transferred. Browser receipt is tested independently of HTTP 202.

| Measure | Sample evidence / interpretation |
|---|---|
| Customer integration steps | Six above; infrastructure readiness is a separate prerequisite |
| Sample application source files | 2: `scripts/examples/saas.mjs` (74 physical lines) and `public/examples/revenue.mjs` (44 physical lines), 118 total including comments/formatting; QA/runner/product UI code excluded |
| Copied tracker | 6 generated HTML/JS lines, public project key and configured canonical host filled automatically |
| Browser bridge | One visitor-read expression plus a field in the existing signup request; storage/link handling remains server work |
| Server request | One existing Revenue API call carries test payment and trusted visitor link; separate identify call is optional |
| Config values | SaaS hostname, public site key (prefilled), private `OM_URL`, private `OM_SERVER_KEY`; event/customer/visitor/time are actual saved synthetic facts |
| Consent → stored tracker visible in authenticated read | **199.64 ms** |
| Signup completed → payment response visible | **205.26 ms**, includes automated click/browser response observation |
| Consent → stored source match observed | **643.00 ms**, includes signup, payment and authenticated read |
| UTM page navigation → checklist source visible | **4848.64 ms**, includes fixed pre-consent negative check, actions and up-to-five-second UI polling |

Timing source: successful fresh `installation:demo`, measurement attachment and
private `.runtime/installation-ease/demo.log`. One machine/browser, warm installed
dependencies, automated actions and polling; no network/cloud variability study.
The earlier full-suite fixture run measured 90.71 / 312.19 / 758.19 / 5174.63 ms
respectively; run variance is visible. Neither run is a first-time customer's
installation duration. **Implementer development/debug/build time is not reported
as customer setup time.** Competitor install times and comparative speed are not
measured. There is no measured before/after customer duration or universal LOC saving.

## Concrete simplifications and failure feedback

Before this package, the project page showed its public key/settings/server keys;
README walkthroughs required reconstructing browser-to-server identity and manual
identify/revenue/internal-token proof. The existing API already supported combined
payment/visitor linking; this package exposes that simpler supported route rather
than claiming to have invented it.

- Project-specific copy button and selectable textarea: canonical tracker
  origin and public project key prefilled, consent queue handles calls before script
  load. No full server key in the snippet or guide.
- Downloadable/runnable **Node 22 built-in fetch** server example, also tested as a
  CLI. Two private env vars, a saved test payload, stable retries, explicit non-2xx
  failure, timeout. Always test USD 2900; deliberately not a provider adapter/SDK.
- English `/installation`: signup visitor → trusted server customer → saved payment
  mapping, optional server identify, consent/CSP, cross-domain and retry instructions.
- Authenticated project checks poll every five seconds, query persisted events and
  the **latest retained test payment**, join its customer attribution, credited
  session and trusted visitor link with project constraints on every join. Separate
  tracker and revenue timestamps, source/campaign/amount labelled test-only. An old
  matched customer cannot make a newer unmatched test payment green. Live payments
  cannot satisfy test-revenue receipt. Read grants recheck active membership/project;
  ingress-only grants cannot read this data. Foreign/missing access is 404.
- Poll failures remove displayed success and show “checks unavailable”; timestamps
  and retained-data wording prevent treating old receipts as current uptime.

| Wrong/missing setup | User-visible result and correction |
|---|---|
| No consent, GPC, blocked storage/script/network | Tracker waiting, possibly null visitor; consent suppression is expected. Verify lawful permission/CSP/storage, never override consent to pass |
| Wrong/missing site key or unregistered hostname | May receive HTTP 202/drop, but stored tracker check stays waiting; correct project key/domain |
| Missing/wrong/revoked server key | Revenue sample reports HTTP 401; no test receipt. Configure this project's server key privately |
| Invalid visitor/amount/time or changed duplicate payload | HTTP 422 or 409; fix original fields, retry exact payload or use a fresh event for a genuinely new test payment |
| Payment with no saved visitor/trusted link | Revenue received, source waiting, “Payment received without a visitor link”; send original saved visitor through server identify for same customer if available |
| Trusted visitor with no eligible retained session | “No retained eligible session”; inspect project, saved visitor, consent and timing. Visit must precede acquisition (earliest trusted identify/payment) within 90 days; use fresh test customer after setup fix |
| Eligible Direct visit | Direct explanation and fresh UTM test instruction; never relabel Direct as campaign revenue |
| Unrelated older successful payment | Latest unsuccessful test replaces green; no false setup completion |
| Foreign tenant, deleted project or revoked membership | Same protected 404 policy; no foreign receipt/source/key disclosure |

An isolated in-memory sample signup is not production SaaS authentication. Adapting
to a real app still requires its validated login/signup and verified payment webhook
identity/amount. No browser-controlled customer/amount is trusted by this example.
No new dashboard/aggregation module or currency summing was introduced: the source
appears beside the latest test payment, not as a live revenue total.

## Current official-document comparison (2026-10-04)

**Documentation review only for both competitors.** No GA4/PostHog accounts were
created, integrations executed or durations assigned. Step groups below are common
scenario requirements, not equivalent click counts or measured code-size totals.

| Requirement | OriginMetric applied fixture | GA4 official documented path | PostHog official documented path |
|---|---|---|---|
| Start / browser | Account, project, allowed domain, generated consent snippet | Google/Analytics access, property, web stream and Google tag | Cloud account/project, project token/host; snippet or framework JS install |
| Signup identity | Save nullable visitor on server-chosen customer | Preserve client ID and session context; opaque User-ID when applicable | Identify authenticated stable user; align frontend/backend distinct ID |
| Server test revenue | One secret-key REST call with amount minor units, currency, saved visitor, stable event/time and test flag | Measurement Protocol secret + measurement ID, client ID; purchase payload, transaction ID/value/currency and session ID for session attribution | Backend SDK **or HTTP capture API** with project token/distinct ID, chosen revenue event/property/currency |
| Source view | Existing attribution materialization and three stored checks; latest test row | Validate MP payload, then verify collected event/report/session source | Configure revenue-event/property mapping and reporting currency; choose/build insight or SQL/view for source/revenue |
| Scope semantics | Customer acquisition last-non-direct, 90-day lookback; no cross-currency sums | Session attribution has its own session/time requirements, not an identical acquisition model | General analytics/revenue views; chosen property/window/query defines comparison, not automatically OriginMetric's model |
| Accounts / costs | No new external account or paid dependency here; existing VPS operations remain | New Google account/access needed if absent; standard Analytics available free, 360 optional | Cloud account required if absent; free event allowance, usage charging beyond it; no payment-platform account needed for manual event path |
| Timing evidence | Automated latency only; independent customer time unmeasured | Not run / no time estimate | Not run / no time estimate |

GA4 setup requires account/property/web-stream/tag access; the base service has a
free option. See [Google setup](https://support.google.com/analytics/answer/9304153?hl=en)
and [free Analytics](https://marketingplatform.google.com/intl/en_uk/about/analytics/).
Server MP uses web measurement ID + API secret + client ID;
[send events](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events).
[Session attribution](https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases)
requires session ID, request within 24 hours of session start, and an overridden
timestamp inside the session. This is a documented configuration difference, not
proof of worse outcomes. [Purchase/ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)
uses transaction/value/currency and relevant item data. MP malformed payloads can
return successful HTTP; use its [validation endpoint](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events),
whose events do not appear in reports and whose checks do not validate API secrets.
A disposable property is needed to verify actual source/report appearance without
mixing production evidence. Paid server-side GTM hosting/BigQuery/360 are not needed
for this basic direct-MP scenario and were not used.

PostHog [Next.js setup](https://posthog.com/docs/libraries/next-js) documents project
host/token, client instrumentation, identification and backend ID alignment;
[HTTP capture](https://posthog.com/docs/api/capture) means a new backend SDK is
**optional**, not a necessary disadvantage. Its capture endpoint uses a public
project token. OriginMetric instead enforces a separate secret-key boundary for
revenue/trusted links; this is an implemented trust-boundary distinction, not a
claim that all PostHog setups are insecure.
[Revenue capture](https://posthog.com/docs/revenue-analytics/capture-revenue-events)
documents explicit event/property selection, revenue minor-unit data and currency
mapping. [Customer mapping](https://posthog.com/docs/revenue-analytics/connect-to-customers)
links revenue events automatically through person identity; native payment data
needs explicit mapping. [Revenue setup](https://posthog.com/docs/revenue-analytics/start-here)
states one million manually captured events/month free and usage charging beyond
allowances. The current [overview](https://posthog.com/docs/revenue-analytics) says
the dedicated revenue dashboard was removed in favour of person/group properties,
insights, SQL and managed views. These are useful capabilities, not inability to
attribute revenue. No native integration or Stripe account is required on the
manual-event route. [Pricing](https://posthog.com/pricing) remains usage-based;
no charge/signup was incurred in this review.

Some PostHog pages returned Markdown unsupported by the browsing tool; their exact
current official URLs were fetched read-only from the VPS instead. HTML/text copies
are private `.runtime/installation-ease/posthog-*` research evidence. No competitor
code was installed. Their event/identity reporting capabilities mean **“competitors
cannot connect revenue to sources” is false**. Neither “fewer total setup steps”,
“faster than free competitors” nor “cheaper overall” has been established.

## Verified differences vs hypotheses

**Verified in OriginMetric:** existing framework/provider-neutral REST with no new
SDK, a prefilled public tracker, one-call first-payment trusted linking, tested
idempotency and three real-data checks with actionable failure states. Official
docs establish that GA4's corresponding session MP path carries client/session
requirements, and PostHog's generic revenue path needs event/property/view setup.
OriginMetric preselects its acquisition semantics and shows this narrow diagnostic
result directly. This is a demonstrated implementation plus documented requirement
comparison, **not measured comparative UX superiority**.

**Still hypotheses:** unfamiliar developers finish in ≤15 minutes; require less
technical knowledge/code/support; prefer this focus enough to pay instead of using
GA4/PostHog free tiers. Independent completion time, real framework adaptation,
real provider webhook/cross-domain recipe, production deployment, long-run latency
and broader negative-setup usability remain unvalidated. No marketing guarantee.

## Verification, safeguards and handoff

- `npm run check`: **378 tests / 28 files PASS**, lint/format/types and tracker
  **2491 B / 2560 B**. Six new real-PG tests cover scoped receipts, unrelated tenant
  success, live/test separation, missing visitor, missing session, Direct, repair,
  ingress capabilities and deleted grants.
- Production build PASS; full Playwright **15/15 PASS**. Repeatable fresh
  `installation:demo` **1/1 PASS**, including downloaded CLI and valid
  wrong-domain drop. Existing Better Auth/account tests retained. Initial extra
  fourth signup exceeded the shared loopback Better Auth endpoint limit; removed
  redundant signup, not security limits. Initial lint/type issues corrected. A new polling-failure assertion was scoped to the
  installation region to avoid Next’s separate route-announcer alert; final polling
  failure/reset checks pass. One lint-guard unit test exceeded its existing 5-second
  timeout during a concurrent build; the final full check was rerun sequentially,
  with no timeout relaxation.
- Migrations consistency PASS; no schema/migration/dependency changes. Candidate
  source/history secret scans and final publication verification recorded privately.
- Production DB remains **1 event / 1 session / 0 customer / 0 link / 0 revenue /
  0 attribution**. Protected production config/env, nginx, plan and backup units
  match prior Better Auth handoff hashes; container identities/start times/restarts
  unchanged. `originmetric-github-backup.timer` stays active/enabled. Existing age
  identity/recipient and recovery credentials untouched; no production rollout,
  ingestion opening, real/test live write, notification or purchase.
- Disposable fixture cleanup and local/remote SHA equality are audited at handoff;
  remote CI success is not inferred from local passes.

Next user test: give one unfamiliar developer the English guide and a prepared
isolated editable SaaS, record the complete unassisted guide-open → first-source-match
run using [the independent test protocol](../runbooks/INSTALLATION_TEST.md). Keep
signup/project/key work and errors in the clock; record host provisioning separately.
Then test at least five relevant developers and report failures as well as median/
range. Compare actual GA4/PostHog runs under equal prerequisites before making a
speed/effort claim. No ready payment integrations/new SDK/paid service are needed
for this next experiment; framework/provider recipes may be proposed later only
if observed participant failures justify them.

### Publication handoff

Implementation/report commit `7b2e58d` pushed to the assigned branch. The first
push returned 403 because the shell's default GitHub account lacked repo write
access; retry used the **existing scoped** `.runtime/github-auth` configuration.
No global account switch or backup credential change. This documentation note
follows in its own commit; final local/remote SHA and clean-tree audit are saved in
`.runtime/installation-ease/publication.json`. Local checks are PASS; remote CI
results have not been claimed. Live deployment remains unchanged.
