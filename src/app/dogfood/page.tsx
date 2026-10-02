import { DogfoodConsent } from "./consent";

export const dynamic = "force-dynamic";

export default function DogfoodPage() {
  const configured = process.env.OM_DOGFOOD_SITE_KEY ?? "";
  const siteKey = /^pk_[A-Za-z0-9]{22}$/.test(configured) ? configured : "";
  return (
    <main>
      <h1>OriginMetric</h1>
      <p>
        OriginMetric, izin verilen ziyaretleri gelir kaynaklarıyla ilişkilendirmeye yardımcı olur.
      </p>
      <DogfoodConsent siteKey={siteKey} />
    </main>
  );
}
