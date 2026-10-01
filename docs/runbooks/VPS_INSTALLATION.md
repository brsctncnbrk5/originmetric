# OriginMetric — VPS kurulum ve Codex devir rehberi

Durum: **P2 kurulum hazırlığı**. Bu belge VPS kurulduğu veya G1 geçtiği anlamına gelmez.
Kod ve paket testleri ayrı; VPS/DNS/Cloudflare, gerçek dogfood ve gerçek off-VPS geri yükleme ayrı kaydedilir.

## 1. Tek klasör, tek tmux oturumu

Termius'ta VPS'ye bağlandıktan sonra aşağıdaki bloğu çalıştır. Root veya /opt altında yazma yetkisi gerekir.
Mevcut /opt/originmetric farklı bir depo ise durur; başka projeleri değiştirmez.
Tmux yoksa yalnızca tmux kur. Codex zaten mevcut değilse önce kurulumunu kontrol et; hesap bilgilerini veya şifreleri sohbete yazma.

```bash
set -e
command -v tmux >/dev/null || { echo 'tmux eksik: sudo apt-get install tmux'; exit 1; }
if [ -e /opt/originmetric ]; then
  test -d /opt/originmetric/.git
  test "$(git -C /opt/originmetric remote get-url origin)" = 'https://github.com/brsctncnbrk5/originmetric.git'
else
  git clone --branch codex/originmetric-p2-vps-preparation \
    https://github.com/brsctncnbrk5/originmetric.git /opt/originmetric
fi
cd /opt/originmetric
if tmux has-session -t '=originmetric' 2>/dev/null; then
  tmux attach-session -t '=originmetric'
else
  tmux new-session -s originmetric -c /opt/originmetric
fi
```

Yeni oturumda:

```bash
cd /opt/originmetric
codex
```

Codex'e verilecek talimat:

> OriginMetric kurulumunu sen yapacaksın. Önce CLAUDE.md, docs/STATUS.md, docs/DECISIONS.md,
> docs/reports/P2_VPS_PREPARATION_REPORT.md ve docs/runbooks/VPS_INSTALLATION.md dosyalarını oku.
> Bu oturum /opt/originmetric altında. Önce branch ve tam commit'i rapordaki doğrulanmış kaynakla karşılaştır;
> çalışma ağacı temiz değilse değişiklikleri koru, silme/reset yapma. scripts/vps/audit-host.sh ile
> salt-okunur sunucu denetimini yap. Mevcut oyunları, tradebot'u, diğer Docker projelerini ve sistem
> servislerini değiştirme. Docker/port/firewall topolojisini incele; port çakışması varsa mevcut servisi
> durdurma. Gereken ücretsiz sistem araçlarını kur, üretim sırlarını yazdırmadan üret ve yerel
> kurulum/smoke testini tamamla. Alan adı, Cloudflare veya off-VPS hesabı için gereken eksik bilgileri
> tek seferde sor; bunları varsayma. Ücretli işlem veya yeni abonelik başlatma. G1 tamamlanmadan
> halka açık gerçek trafik açma. Yedek oluşturmayı geri yükleme doğrulaması olarak raporlama.
> Tüm kurulum ve test kanıtlarını docs/reports/P2_VPS_INSTALLATION_REPORT.md içine kaydet,
> STATUS'u gerçek sonuçla güncelle. P3'e geçme. Kurulum bitince dur ve sonucu Türkçe açıkla.

## 2. Sunucu denetimi (Codex yapar)

```bash
bash scripts/vps/audit-host.sh
```

Ubuntu, RAM/disk, mevcut container'lar, 80/443/8088/5432, UFW ve Docker firewall yolu incelenir.
Bu hazırlık ortamında VPS erişimi yoktu; eski başka-proje donanım notları bu VPS için kanıt sayılmaz.
Docker Engine + Compose >= 2.24.4, git, curl, openssl, flock/util-linux, age ve rclone gereklidir.
Host Node/npm gerekmez: uygulama görüntüsü Node 22 ile Docker içinde derlenir. Codex CLI bağımsızdır.
VPS build için en az 4 GiB kullanılabilir RAM ve yeterli disk alanı değerlendirilir. Global prune yapma.

## 3. Yerel güvenli kurulum

```bash
bash scripts/vps/init-env.sh
bash scripts/vps/preflight.sh
bash scripts/deploy.sh "$(git rev-parse HEAD)"
```

`.env.production` 600 izniyle üretilir; dosyayı ekrana basma. DB/API/proxy sırları repoya girmez.
Compose projesinin adı `originmetric`; DB ve app portları hosta açılmaz. İlk proxy yalnızca
`127.0.0.1:8088` üzerindedir. App non-root, loglar döner; DB PostgreSQL 18.6 kalıcı named volume kullanır.
`/api/health` DB'yi sorgular. `/internal/*` ve `/api/internal/*` proxyde 404. İnceleme localhost app
container'ı üzerinden yapılır; internal token'ı URL query'sine koyma.

CLI image içinde hazırdır (anahtar oluşturma komutu secret'i bir kez gösterir; çıktı kaydına koyma):

```bash
# APP_TAG dosyadaki SHA olmalı. .env.production değerlerini yazdırma.
export APP_TAG="$(cat .runtime/current-tag)"
docker compose --env-file .env.production -f deploy/compose.yml exec -T app \
  node dist/ops.mjs create-project --name 'OriginMetric dogfood' \
  --domain GERCEK_SITE_HOSTU --timezone Europe/Istanbul --currency USD
```

Site hostu ve alan adı Barış'tan alınır. Placeholder'ı gerçek bilgi olmadan çalıştırma.
Projeye uygun anahtar `create-key --project UUID --name dogfood` ile oluşturulur.
API anahtarı test istekleri için yerel gizli dosyadan okunur; chat/rapor/loglarda gösterilmez.

## 4. Cloudflare ve public ingress — host denetiminden sonra

Mevcut 80/443 sahibi yoksa sağlanan `deploy/compose.public.yml` + `Caddyfile.public` kullanılabilir.
Başka reverse proxy varsa o servisi kesme; yalnızca OriginMetric'e ait bir host route ekle ve eşdeğer
Cloudflare peer gate, token overwrite ve log redaction'ı koru. Compose override'ı körlemesine açma.

- Gerçek alan adını Barış seçer; Cloudflare proxied DNS'i doğru VPS adresine yönlendirir.
- Cloudflare Origin CA sertifikası actual host için üretilir. `secrets/cloudflare/origin.crt` ve
  `origin.key` içine koyulur, private key 600; dosyalar Git'te yoktur. Full (strict) gerekir.
  Origin CA sertifikası doğrudan tarayıcı/Let's Encrypt sertifikası değildir; edge üzerinden kullanılır.
- Cloudflare IPv4/IPv6 listelerini resmi kaynaklardan kurulum günü yeniden doğrula. Caddy örneğindeki
  snapshot ve host firewall listesi aynı olmalı. Caddy public proxy yalnızca gerçek CF peer'lerini kabul eder.
- SSH erişimini kaybetmeden host firewall'u değerlendir. **Docker yayın portları UFW'yi bypass edebilir**:
  iptables Docker-USER veya mevcut nftables Docker yolu denetlenir, kurallar yalnızca OriginMetric port/
  interface akışına uygulanır. Diğer projelere global policy veya firewall reset yapma. Doğrudan dış IP'den
  app/DB portları ve IPv4/IPv6 kontrol edilir. Peer gate uygulama için ikinci korumadır, firewall kanıtının yerini almaz.
- Free planın **tek** rate-limit kuralı: `http.request.uri.path eq "/api/v1/e"`, IP, başlangıç
  60 request/10 seconds, Block 10 seconds. App içindeki 60/min/client+site sınırı ayrıca aktiftir.
  Panelde mevcut hak/parametreleri doğrula; ikinci kural veya ücretli plan oluşturma.
- `/js/*` için cache değerlendir; API/internal/consent fixture response'larını cache etme.
- WAF custom rules en fazla planın izin verdiği sayı; method/internal filtreleri gerekiyorsa eklenir.
- Loglarda raw IP, URL query, Authorization, cookies, customer/visitor ID veya sır olmamalı.

Tüm maddeler kanıtlandıktan sonra `.env.production` içindeki `OM_DOMAIN`, `OM_INGRESS=public` ve
`PUBLIC_G1_READY=yes` yerelde ayarlanır. Token aynı kalır. `deploy.sh` yeni konfigürasyonla tekrar çalışır.
**Flag tek başına G1 kanıtı değildir**; gerçek kontroller ve sonuçları rapora yazılır.

## 5. Dogfood testi

Yalnızca controlled/synthetic trafik; public gerçek ziyaretçiye açmadan G1.
`/fixtures/required?site=PUBLIC_SITE_KEY&utm_source=Google` kontrollü sayfası izni bekler.
Playwright ile actual domain'de consent öncesi cookie/localStorage/network yokluğu ve consent sonrası
ziyaret gönderimi tekrar gözlenir. Server identify + `test:true` ödeme ile google/attributed sonucu,
yenileme/iade ve duplicate davranışı doğrulanır. Browser'a server key koyulmaz.
Gerçek dogfood sitesinde snippet `data-consent="required"` ve consent withdrawal bağlantısıyla kurulur.
Kontrollü test fixture'ı gerçek site banner'ı kurulmuş sayılmaz.

## 6. Yedek ve geri yükleme

Barış off-VPS sağlayıcısını seçer; mevcut ücretsiz hesabı uygunsa kullanılır. B2/R2 hesabı veya kart/
ücret gerekirse ayrıca onay alınır. Başka bir projeye ait rclone remote/config değiştirilmez.
Offline cihazda `age-keygen` ile anahtar oluşturulur. **Yalnızca public recipient** VPS'deki
AGE_RECIPIENT'e yazılır. Private key şifre yöneticisi/offline cihazda kalır.
`BACKUP_REMOTE=remote:bucket/path/originmetric` özel prefix olmalı. 7 günlük / 4 haftalık / 2 aylık
şifreli snapshot korunur; script bu prefix dışına silme yapmaz. Secrets ayrıca parola yöneticisinde.

```bash
bash scripts/vps/backup.sh
```

Gerçek encrypted object off-VPS'ten offline cihaza indirildikten sonra:

```bash
# Offline bilgisayarda: plaintext dump diske/VPS'ye dosya olarak yazılmaz.
age -d -i OFFLINE_PRIVATE_KEY ENCRYPTED_BACKUP.dump.age | \
  ssh VPS_HOST 'cd /opt/originmetric && bash scripts/vps/restore-check.sh'
```

Script production DB'ye dokunmadan, network-none + tmpfs kullanan disposable PostgreSQL içinde
restore eder, 10 domain table ve migration metadata kontrol eder, row counts verir. CI restore proof
aynı araç yolunu sentetik veride test eder; gerçek off-VPS restore yerine geçmez.

Nightly backup cron'u ve periyodik selfcheck ancak başarılı backup/restore sonrası kurulur:

```cron
15 3 * * * cd /opt/originmetric && bash scripts/vps/backup.sh >> /opt/originmetric/.runtime/backup.log 2>&1
*/5 * * * * cd /opt/originmetric && bash scripts/vps/selfcheck.sh >> /opt/originmetric/.runtime/selfcheck.log 2>&1
```

Saat host timezone'a göre; 03:15 istenen yerel/UTC saat kurulumda kaydedilir. Sadece bu projenin cron
satırları eklenir; mevcut crontab değiştirilmez/silinmez. Logrotate yapılandırılır. Healthchecks URL
backup ve selfcheck için ayrı; mevcut ücretsiz hesabı Barış seçer. Uptime check HTTPS health ve tracker.
Selfcheck abuse/failure counter'ı restart'tan beri pozitifse uyarır (P2 conservative davranışı; P7 delta/advanced alerting).

## 7. Güncelleme ve rollback

Exact reviewed SHA checkout, clean worktree, `deploy.sh SHA`. Daha önce deployment varsa off-VPS encrypted
backup başarılı olmadan migrate/deploy yapılmaz. Backup başarısızsa eski app çalışmaya devam eder.
Forward-only migration uygulanır; image health/smoke başarısızsa önceki app tag ile geri dönüş denenir.
Geri dönüş sonrası health doğrulanır; ilk kurulum başarısızsa app/proxy durur ve DB korunur.
DB downgrade veya veri geri sarma yapılmaz. Son 3 image tag tutulur; otomatik global image prune yoktur.
İlk public ingress topoloji/config geçişi app-image rollback değildir; bu geçişte önceki config'in
saklanması ve route/TLS smoke'u Codex tarafından ayrıca yönetilir.

## 8. Kapanış

P2 ancak G1, real consented dogfood, real off-VPS backup/restore, port/TLS/security denetimi ve monitoring
kanıtlarıyla `SLICE LIVE (dogfood)` olur. Kurulum raporunu, STATUS'u, git commit/push ve doğrulama
sonucunu kaydet; P3'e kendiliğinden geçme.

Resmi referanslar (2026-10-02'de kontrol edildi):
- https://nextjs.org/docs/app/getting-started/deploying
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- https://caddyserver.com/docs/caddyfile/matchers
- https://www.cloudflare.com/ips-v4
- https://www.cloudflare.com/ips-v6
- https://developers.cloudflare.com/waf/rate-limiting-rules/
- https://developers.cloudflare.com/use-cases/solutions/stop-account-takeover-attacks/
- https://docs.docker.com/engine/network/packet-filtering-firewalls/
