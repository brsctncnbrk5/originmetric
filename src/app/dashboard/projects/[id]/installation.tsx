"use client";
import { useEffect, useState } from "react";

type Status = {
  trackerReceivedAt: string | null;
  revenueReceivedAt: string | null;
  sourceMatched: boolean;
  reason: string;
  payment: {
    eventId: string;
    amount: string;
    currency: string;
    source: string | null;
    campaign: string | null;
    status: string | null;
  } | null;
};
const help: Record<string, string> = {
  no_test_payment: "Send a server-side payment with test: true using this project's server key.",
  missing_visitor_link:
    "Payment received without a visitor link. Save getVisitorId() at signup and send it from your server with the payment, or call /api/v1/identify for the same customer. Never invent a visitor ID.",
  no_eligible_session:
    "A visitor link exists, but no retained eligible session proves the source. Check the site key, allowed domain, consent, blockers and the visitor saved at signup. The visit must precede acquisition (first identify or payment) within the 90-day lookback. After fixing the setup, use a fresh test customer and event.",
  direct_visit:
    "The matched visit is Direct. For the campaign test, open a fresh UTM URL before signup and use a fresh test customer.",
  matched:
    "The latest test payment's customer is linked to its credited visitor session. Source match verified.",
};
export function Installation({
  id,
  snippet,
  initial,
}: {
  id: string;
  snippet: string | null;
  initial: Status;
}) {
  const [status, setStatus] = useState<Status | null>(initial);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/account/projects/${id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!controller.signal.aborted) {
          setStatus(data.installation);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus(null);
          setError("Setup checks unavailable. Sign in again or reload to retry.");
        }
      }
    }
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [id]);
  return (
    <section aria-label="Installation">
      <h2>Install OriginMetric</h2>
      <p>
        Copy into your site HTML. Connect your consent UI to{" "}
        <code>{"originmetric('consent', true)"}</code> after permission and{" "}
        <code>{"originmetric('consent', false)"}</code> on withdrawal. GPC is honoured. No events
        are sent before consent.
      </p>
      {snippet ? (
        <>
          <textarea aria-label="Project tracker code" readOnly rows={8} cols={95} value={snippet} />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(snippet);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy tracker code"}
          </button>
        </>
      ) : (
        <p>Tracker URL unavailable. Configure the canonical application URL first.</p>
      )}
      <p>
        <a href="/installation">Visitor-to-customer guide and runnable server example</a>
      </p>
      <h3>Setup checks</h3>
      <p>
        Retained project data; latest test payment only. Refreshes every 5 seconds. These checks
        show receipt, not a production health guarantee.
      </p>
      {error && <p role="alert">{error}</p>}
      {status && (
        <div data-testid="installation-status">
          <p>
            Tracker data:{" "}
            {status.trackerReceivedAt
              ? `received (${status.trackerReceivedAt})`
              : "waiting — check the snippet, allowed domain, consent and blockers. HTTP 202 alone does not prove storage."}
          </p>
          <p>
            Test revenue event:{" "}
            {status.revenueReceivedAt ? `received (${status.revenueReceivedAt})` : "waiting"}
          </p>
          <p>Source match: {status.sourceMatched ? "verified" : "waiting"}</p>
          <p>{help[status.reason]}</p>
          {status.payment && (
            <p>
              Latest test payment: {status.payment.eventId} — {status.payment.amount} minor units{" "}
              {status.payment.currency} — source {status.payment.source ?? "Unattributed"} —
              campaign {status.payment.campaign ?? "none"} (test only)
            </p>
          )}
        </div>
      )}
    </section>
  );
}
