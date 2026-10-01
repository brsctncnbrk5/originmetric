const MODES = new Set(["basic", "required", "withdrawal", "gpc", "csp", "storage", "blocked"]);
const SITE_KEY = /^pk_[0-9A-Za-z]{22}$/;

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ mode: string }> },
): Promise<Response> {
  const { mode } = await context.params;
  if (!MODES.has(mode)) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const rawSite = url.searchParams.get("site") ?? "";
  const site = SITE_KEY.test(rawSite) ? rawSite : "";
  const required = mode === "required" ? ' data-consent="required"' : "";
  const ignoreGpc = url.searchParams.get("gpc") === "ignore" ? ' data-gpc="ignore"' : "";
  const body = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>OriginMetric fixture</title></head>
<body>
  <main id="fixture" data-mode="${htmlEscape(mode)}">
    <h1>OriginMetric P1b fixture</h1>
    <button id="consent-yes" type="button">Consent yes</button>
    <button id="consent-no" type="button">Consent no</button>
    <button id="identify" type="button">Browser identify (must be ignored)</button>
    <button id="work" type="button">Host page action</button>
    <output id="work-count">0</output>
  </main>
  <script defer src="/js/v1/om.js" data-site="${htmlEscape(site)}"${required}${ignoreGpc}></script>
  <script defer src="/fixtures/helper.js"></script>
</body>
</html>`;

  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  if (mode === "csp") {
    headers.set(
      "content-security-policy",
      "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'",
    );
  }
  return new Response(body, { status: 200, headers });
}
