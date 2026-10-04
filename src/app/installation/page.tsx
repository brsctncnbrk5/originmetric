import Link from "next/link";
export default function Guide() {
  return (
    <main>
      <Link href="/dashboard">Your projects</Link>
      <h1>Connect a visit to a paying customer</h1>
      <ol>
        <li>
          Create a project with your actual website hostname (no protocol or port). Copy its tracker
          code into your HTML. Allow the tracker script and ingestion endpoint in your CSP.
        </li>
        <li>
          For strict CSP, put the optional queue stub in your allowed application bundle or apply
          your existing nonce. Permit the OriginMetric host in script-src and connect-src. Connect
          your existing consent controls: call <code>{"originmetric('consent', true)"}</code> only
          after analytics permission, and <code>{"originmetric('consent', false)"}</code> on
          withdrawal. The snippet queues calls while loading. GPC suppresses tracking.
        </li>
        <li>
          Open a fresh browser visit with{" "}
          <code>?utm_source=demo&amp;utm_medium=cpc&amp;utm_campaign=setup</code>. Wait for “Tracker
          data: received” in the project setup checks.
        </li>
        <li>
          At signup, read the visitor ID and send it to your own signup server. The server must
          choose the customer ID from its authenticated account, validate the visitor as a UUID or
          null, and save the pair. Missing consent or blocked storage can return null; never
          generate a replacement visitor.
        </li>
      </ol>
      <pre>{`const visitorId = window.originmetric?.getVisitorId() ?? null;
// Add visitorId to your existing signup request to YOUR server.
// Your server saves it against the newly created opaque customer ID.`}</pre>
      <p>
        Use the saved visitor with the first server-side payment. One Revenue API call creates both
        the trusted link and test payment. Alternatively, call <code>POST /api/v1/identify</code>{" "}
        from your server at signup with the same customer and visitor; later payments can omit the
        visitor. For cross-domain checkout, keep the saved pair in your backend or verified checkout
        metadata. The webhook must resolve the customer from a verified payment, never arbitrary
        browser customer/amount input.
      </p>
      <h2>Runnable server test</h2>
      <p>
        Download{" "}
        <a href="/examples/revenue.mjs" download>
          revenue.mjs
        </a>
        . Node.js 22+ and built-in fetch are sufficient. Set <code>OM_URL</code> and{" "}
        <code>OM_SERVER_KEY</code> in your server private environment. Create the key in the project
        Server API keys section; it is shown once. Never use a NEXT_PUBLIC variable or put the
        server key in HTML.
      </p>
      <p>
        In a disposable staging project, save <code>payment.json</code> using the actual visitor
        saved at signup and a fresh synthetic customer. Replace the timestamp with the actual
        payment time in RFC 3339 UTC. This example always sends test: true and USD 2900 minor units
        ($29).
      </p>
      <pre>{`{
  "eventId": "test_invoice_001",
  "customerId": "test_customer_001",
  "visitorId": "REPLACE_WITH_SAVED_VISITOR_UUID_OR_NULL",
  "occurredAt": "REPLACE_WITH_CURRENT_RFC3339_TIME"
}
node revenue.mjs payment.json`}</pre>
      <p>
        Reuse the exact saved file on retries: same event ID and payload returns duplicate; changing
        an existing event returns HTTP 409. HTTP 401 means missing, wrong or revoked server key;
        HTTP 422 means an invalid field. Do not log keys or customer IDs.
      </p>
      <p>
        Wait for test revenue receipt and source match in the project page. The latest test payment
        shows amount, currency, source and campaign. Test receipts are labelled separately and must
        be excluded from live reporting; these checks are not a live revenue dashboard.
      </p>
      <h2>When the source does not match</h2>
      <p>
        Unattributed means revenue exists without an eligible linked visit; it is different from
        Direct. Check the project/site/server key pair, allowed website domain, consent, blockers,
        saved visitor and customer. The visit must precede acquisition (the earlier of trusted
        identify or first payment) within 90 days. A new visit after acquisition cannot repair an
        old payment. If the original visitor was saved, server-side identify can repair its missing
        link; otherwise fix setup and repeat with a fresh synthetic customer and event.
      </p>
      <p>
        “Direct visit” means a real linked visit without a credited campaign. Repeat with a fresh
        UTM visit for the campaign test. A null visitor under denied consent is expected.
        Cross-device signup and missing consent limit coverage. Never override consent to make
        checks green.
      </p>
      <p>
        Use only synthetic data in an isolated environment for this experiment. Fifteen minutes to
        first match is a test target; independent customer setup time has not been validated.
      </p>
    </main>
  );
}
