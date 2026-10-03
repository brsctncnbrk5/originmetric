import { DogfoodConsent } from "./consent";

export const dynamic = "force-dynamic";

export default function DogfoodPage() {
  const configured = process.env.OM_DOGFOOD_SITE_KEY ?? "";
  const siteKey = /^pk_[A-Za-z0-9]{22}$/.test(configured) ? configured : "";
  return (
    <main>
      <h1>OriginMetric — P2 kabul testi</h1>
      <p role="note">
        Bu sayfa kontrollü test içindir. Dönüşüm ve gelir kayıtları gerçek müşteri veya gelir
        değildir.
      </p>
      <p>
        OriginMetric, izin verilen ziyaretleri gelir kaynaklarıyla ilişkilendirmeye yardımcı olur.
      </p>
      <DogfoodConsent siteKey={siteKey} />
    </main>
  );
}
