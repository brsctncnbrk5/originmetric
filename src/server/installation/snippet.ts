/** Only the public site key goes into the browser. Origin comes from trusted server config. */
export function trackerSnippet(origin: string, siteKey: string) {
  const url = new URL(origin);
  if (!/^https?:$/.test(url.protocol) || !/^pk_[A-Za-z0-9]{22}$/.test(siteKey))
    throw new Error("Invalid tracker configuration");
  const src = `${url.origin}/js/v1/om.js`.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<script>
  window.originmetric = window.originmetric || function () {
    (window.originmetric.q = window.originmetric.q || []).push(Array.from(arguments));
  };
</script>
<script defer src="${src}" data-site="${siteKey}" data-consent="required"></script>`;
}
