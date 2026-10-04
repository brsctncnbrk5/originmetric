# Independent installation test (English)

Purpose: test the hypothesis **first revenue match within 15 minutes**. It is not
an established promise. Use only a fresh synthetic customer and `test: true` on an
isolated staging OriginMetric and sample SaaS. Do not use originmetric.app's live
DB or open its ingress gates. This test does not accept P2, P3 or P4.

## Prepare before the participant arrives

The facilitator provides a migrated, running **isolated** OriginMetric with auth
configured, an editable fresh staging SaaS with signup and an existing server
handler for simulated payment, Node.js 22+, browser and private server-env access.
No payment provider, real card, real customer, new external account or paid service
is needed. Record these prepared prerequisites and any provisioning time separately.
Do not install the tracker, create the project or configure a key for the participant.
The participant should be a developer unfamiliar with this integration. Owner and
implementer timings are labelled separately from independent participant timings.

Read only the in-app `/installation` guide and project setup instructions. The
facilitator can provide infrastructure credentials securely; never paste keys into
chat, recordings, terminal commands/history or browser code. Existing consent UI
must be wired by the participant; do not preload that work.

## Run without assistance

1. Start the clock when the participant opens the guide and the prepared project.
   Include account sign-in/signup, project creation, domain configuration and key
   creation in total integration time. Record guide-reading time too.
2. Create a fresh OriginMetric project for the SaaS hostname, copy its snippet,
   connect consent grant/withdrawal and configure server-only env.
3. On a fresh UTM visit, allow analytics. Read the saved visitor at signup and send
   it to the participant's existing signup server. Save the pair against a server
   chosen synthetic customer ID.
4. Adapt/download the Node example; from the simulated-payment server use the
   saved visitor and customer with a unique saved event ID/time and `test: true`.
5. Stop the clock when the project checks confirm the latest test payment's
   source and show its expected amount/currency/campaign. Save measurements,
   touched files, added/changed nonblank LOC, errors, help requests and corrections.
6. Retry the exact payment; it must be duplicate. Use a NEW synthetic customer
   with no visitor: it must be Unattributed with actionable help, not green because
   an older payment matched. Check denied consent and withdrawal send no events.
7. Tear down the disposable fixtures. Use a fresh project for another trial; no
   production writes or destructive live cleanup.

Record timestamps for guide start, project ready, snippet installed, consent,
tracker receipt, signup visitor saved, payment submission, revenue receipt and
source visible. Distinguish total elapsed time, active time, infrastructure waits,
API latency and checklist polling. Do not subtract mistakes or guide reading from
the primary elapsed measure. Assistance is logged, and the run then ceases to be
“unassisted”. Report incomplete runs and timeouts rather than dropping them.

## Success criteria and interpretation

- Functional: expected synthetic customer's USD 2900 payment is attributed to the
  intended UTM source/campaign; all three stored-data checks agree. No browser
  secret, duplicate revenue, cross-tenant disclosure or pre-consent tracking.
- Experience: completes without implementer help; can explain which ID connects
  the visit to the customer and can fix the missing-visitor case using the guide.
- Timing hypothesis: total guide-open → first verified source ≤15 minutes **on the
  prepared infrastructure**, with steps and file/LOC counts recorded.
- First collect one unfamiliar developer's run. Then repeat with at least five
  relevant developers on fresh sites, report completion rate, median, range and
  every >15-minute failure. This is an experimental sample, not statistical proof
  of a universal marketing promise. Competitor speed claims require the same
  participants/tasks/prerequisites and actual GA4/PostHog runs.

## Automated engineering reproduction (not the independent test)

From this repo with Node.js 22+, installed dependencies, Docker and Chromium:

```sh
npm run installation:demo
# If Chromium is already installed elsewhere, set only its executable path:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome npm run installation:demo
```

The command creates an ephemeral loopback PostgreSQL 18 fixture, generates private
fixture credentials, migrates/builds, chooses an unused loopback app port, runs
`tests/e2e/installation.spec.ts` and removes its own container including volumes
on normal completion/failure. It never inherits the production DB URL or auth secret
for the running app. An interrupted process may leave only its named
`om-installation-*` fixture: inspect ownership and remove that exact container,
never prune Docker. Playwright's report and measurement attachment contain no keys.
The sample SaaS lives in `scripts/examples/saas.mjs`; its in-memory accounts and
simulated payments are fixture-only and are not production auth/payment code.
