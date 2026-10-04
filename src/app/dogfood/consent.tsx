"use client";

import { useEffect, useState } from "react";

type Tracker = ((command: "consent", allowed: boolean) => void) & {
  getVisitorId(): string | null;
};

export function DogfoodConsent({ siteKey }: { siteKey: string }) {
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState("İzin bekleniyor");
  const [gpc, setGpc] = useState(false);
  useEffect(() => {
    if (!/^pk_[A-Za-z0-9]{22}$/.test(siteKey)) return;
    const script = document.createElement("script");
    script.src = "/js/v1/om.js";
    script.dataset.site = siteKey;
    script.dataset.consent = "required";
    script.onload = () => {
      setGpc(
        Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl),
      );
      setReady(typeof (window as Window & { originmetric?: Tracker }).originmetric === "function");
    };
    script.onerror = () => setChoice("İstatistik aracı yüklenemedi; sayfayı kullanabilirsiniz.");
    document.head.append(script);
    return () => {
      (window as Window & { originmetric?: Tracker }).originmetric?.("consent", false);
      script.remove();
    };
  }, [siteKey]);

  function decide(allowed: boolean, label: string) {
    const tracker = (window as Window & { originmetric?: Tracker }).originmetric;
    if (!ready || !tracker) return;
    tracker("consent", allowed);
    setChoice(
      allowed && gpc ? "Tarayıcınızın gizlilik tercihi nedeniyle istatistikler kapalı." : label,
    );
  }

  return (
    <section aria-labelledby="consent-title">
      <h2 id="consent-title">Ziyaret istatistikleri</h2>
      <p>
        İzin verirseniz bu sayfadaki ziyaretleri ölçmek için tarayıcınızda bir tanımlayıcı saklanır.
        İzin vermeden sayfayı kullanabilirsiniz. İzninizi geri çekmek bu sayfanın istatistik
        tanımlayıcılarını siler ve yeni gönderimleri durdurur.
      </p>
      <button id="consent-allow" disabled={!ready} onClick={() => decide(true, "İzin verildi")}>
        İzin ver
      </button>{" "}
      <button id="consent-deny" disabled={!ready} onClick={() => decide(false, "Reddedildi")}>
        Reddet
      </button>{" "}
      <button
        id="consent-withdraw"
        disabled={!ready}
        onClick={() => decide(false, "İzin geri çekildi")}
      >
        İzni geri çek
      </button>
      <p role="status">{choice}</p>
      {!siteKey && <p>Bu sayfa için istatistik kurulumu henüz tamamlanmadı.</p>}
      <p>Tercihiniz kaydedilmez; sayfa yeniden açıldığında tekrar izin istenir.</p>
    </section>
  );
}
