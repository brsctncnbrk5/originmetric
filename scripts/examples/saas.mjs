// Disposable loopback sample SaaS. No accounts/payment providers/customer PII.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { sendTestPayment } from "../../public/examples/revenue.mjs";
export async function startSaas({ snippet, env }) {
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(env.OM_URL).hostname))
    throw new Error("Fixture only accepts loopback OriginMetric");
  const accounts = new Map();
  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (req.method === "GET" && req.url?.startsWith("/")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html lang="en"><title>Sample SaaS</title>${snippet}
        <button id="allow" onclick="originmetric('consent', true)">Allow analytics</button>
        <button id="signup">Create synthetic account</button><button id="pay">Test payment</button><pre id="result"></pre>
        <script>
          let account;
          signup.onclick = async () => {
            const response = await fetch('/signup', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({visitorId:window.originmetric?.getVisitorId() ?? null})});
            account = (await response.json()).account; result.textContent = 'Synthetic account created';
          };
          pay.onclick = async () => {
            const response = await fetch('/payment', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({account})});
            result.textContent = JSON.stringify(await response.json());
          };
        </script></html>`);
      return;
    }
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 2048) throw new Error();
      }
      const input = JSON.parse(raw);
      if (req.url === "/signup") {
        const visitorId = input.visitorId;
        if (
          visitorId !== null &&
          !(
            typeof visitorId === "string" &&
            /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(visitorId)
          )
        )
          return json(400, { message: "Invalid visitor" });
        const account = randomUUID();
        accounts.set(account, {
          eventId: `test_${randomUUID()}`,
          customerId: `test_${randomUUID()}`,
          visitorId,
          occurredAt: null,
        });
        return json(201, { account });
      }
      if (req.url === "/payment") {
        const payment = accounts.get(input.account);
        if (!payment) return json(401, { message: "Create a synthetic account first" });
        payment.occurredAt ??= new Date().toISOString();
        return json(200, await sendTestPayment(payment, env));
      }
      json(404, { message: "Not found" });
    } catch {
      json(502, { message: "Test request failed; check server configuration" });
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
