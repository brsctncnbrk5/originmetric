// Node.js 22+, SERVER ONLY. No dependencies. Supply a dedicated test-project key.
export async function sendTestPayment(payment, env = process.env) {
  if (!env.OM_URL || !env.OM_SERVER_KEY)
    throw new Error("Set OM_URL and OM_SERVER_KEY on the server");
  const url = new URL(env.OM_URL);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
  )
    throw new Error("Use HTTPS or loopback HTTP");
  const response = await fetch(new URL("/api/v1/revenue-events", url), {
    method: "POST",
    headers: { authorization: `Bearer ${env.OM_SERVER_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      event_id: payment.eventId,
      type: "payment",
      customer_id: payment.customerId,
      visitor_id: payment.visitorId ?? null,
      amount: 2900,
      currency: "USD",
      occurred_at: payment.occurredAt,
      billing_interval: "one_time",
      test: true,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      `Revenue API HTTP ${response.status}. Check key, payload, or event-ID conflict.`,
    );
  const result = await response.json();
  return { status: result.status, attribution: result.attribution };
}
// Direct execution reads a saved test payload; retries reuse the exact ID/time/visitor.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { readFile } = await import("node:fs/promises");
  try {
    const payment = JSON.parse(await readFile(process.argv[2], "utf8"));
    console.log(JSON.stringify(await sendTestPayment(payment)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Test payment failed");
    process.exitCode = 1;
  }
}
