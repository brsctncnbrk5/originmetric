const source = `
(() => {
  const byId = (id) => document.getElementById(id);
  byId("consent-yes")?.addEventListener("click", () => {
    try { window.originmetric?.("consent", true); } catch {}
  });
  byId("consent-no")?.addEventListener("click", () => {
    try { window.originmetric?.("consent", false); } catch {}
  });
  byId("identify")?.addEventListener("click", () => {
    try { window.originmetric?.("identify", "victim-customer"); } catch {}
  });
  byId("work")?.addEventListener("click", () => {
    const out = byId("work-count");
    if (out) out.textContent = String(Number(out.textContent || "0") + 1);
  });
  window.fixtureReady = true;
})();
`;

export function GET(): Response {
  return new Response(source, {
    status: 200,
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
