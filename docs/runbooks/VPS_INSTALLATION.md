# OriginMetric — VPS kurulum ve Codex devir rehberi

Durum: **P2 kurulum hazırlığı tamamlandı; CI #46 geçti**. Bu belge VPS kurulduğu veya G1 geçtiği anlamına gelmez.
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

### Bu VPS'de doğrulanan web firewall durumu (2026-10-02)

Son kullanıcı kararı D-006 ile Tradebot'un doğrulanmış özel kaynakları silindi.
Ortak `/opt/tradebot-dashboard-tools` ortamı OriginMetric Certbot için korunur;
bu dizini ve genel paketleri kaldırma. Güncel nginx yolu `OM_INGRESS=nginx`,
`PUBLIC_G1_READY=no`; aşağıdaki ilk HTTPS aşaması tarihsel kayıttır.

`deploy/nginx.default-deny.conf` bilinmeyen/IP hostlarını reddeder. Yalnız OriginMetric
named vhost'u kalmıştır. Kurulu web kısıtlaması:

- Kaynak: `scripts/vps/originmetric-web-firewall.sh`; kurulu yol:
  `/usr/local/sbin/originmetric-web-firewall`.
- Resmi CF aralıkları: root-owned 600
  `/etc/originmetric/firewall/cloudflare-v4.txt` ve `cloudflare-v6.txt`.
- `originmetric-web-firewall.service` enabled, nginx'ten önce çalışır.
  `OM_CF_WEB4/6` yalnız eth0 TCP/UDP 80/443'ü eşler; TCP CF kaynaklarını geçirir,
  diğer web trafiğini ve tüm web UDP'yi düşürür. SSH/Docker/özel port kuralları korunur.
- Drift durumunda apply başarısız olur. Yeniden başlatma testi yapılmadı;
  range refresh otomatik değil. Resmi listeler ve nginx trust birlikte, staged
  zincirlerle ve yeni otomatik geri dönüş altında güncellenmeli; canlı zinciri boşaltma.

Yalıtılmış politika/geri alma testi (host firewall'una dokunmaz):

```bash
cd /opt/originmetric
sudo unshare -n python3 scripts/vps/test-web-firewall.py /etc/originmetric/firewall
```

30 paket kontrolü, geçersiz girişte değişiklik olmaması ve repeat apply/remove geçti.
Her gelecekteki web cutover öncesinde kurulu bağımsız geri dönüşü arm et:

```bash
sudo systemd-run --collect --unit=originmetric-web-firewall-rollback \
  --on-active=5m --timer-property=AccuracySec=1s \
  /usr/local/sbin/originmetric-web-firewall-rollback
```

Manual geri alma aynı `/usr/local/sbin/originmetric-web-firewall-rollback` komutudur:
sadece bu web kurallarını kaldırır ve yeni persistence servisini disable eder.
INPUT/Docker/NAT veya SSH sıfırlanmaz. Geri alma webi tekrar doğrudan erişilebilir
kılacağından ilgili firewall kriterini yeniden sağlanmamış olarak kaydet.

Mevcut cutover'da önce sertifika dry-run, sonra arm/apply, **kısıtlama altında yeniden
scoped dry-run**, IPv4/IPv6 edge/SSH ve bağımsız dış port probları başarılı oldu;
ancak ardından `systemctl stop originmetric-web-firewall-rollback.timer` çalıştırıldı.
Scoped HTTP-01 hem apex hem www için çalışır; üretim sertifikası değişmedi.
02:23/14:23 cron'u yalnız `originmetric.app` sertifikasını yeniler. Şu an DNS-01
anahtarı veya plugin gerekli değil.

Gelecekte DNS-01 gerekirse [resmi plugin belgesine](https://certbot-dns-cloudflare.readthedocs.io/en/stable/)
göre yalnız `originmetric.app` zone için `Zone:DNS:Edit` token kullan. Token'ı doğrudan
sunucuda güvenli editörle root-owned 600 `/etc/letsencrypt/cloudflare-originmetric.ini`
dosyasının `dns_cloudflare_api_token` alanına yerleştir. Dosya yoksa `umask 077` ile
oluştur; mevcut dosyayı körlemesine ezme. Token'ı chat, shell argümanı, Git veya
rapora koyma. Önce plugin uyumluluğunu ve scoped staging renewal'ı doğrula.

Güncel kanıt ve dış ölçüm bağlantıları [P2 raporunun son bölümünde](../reports/P2_VPS_INSTALLATION_REPORT.md#tradebot-removal-and-originmetric-web-firewall--2026-10-02).
Bu adımlar G1/P2 kabulü değildir; veri rotalarını açma ve P3'e geçme.

## 5. Dogfood testi

### İlk domain/HTTPS aşaması (2026-10-02; tarihsel)

`originmetric.app` ve `www.originmetric.app`, mevcut nginx korunarak ayrı
`/etc/nginx/sites-available/originmetric` dosyasına bağlandı. Kaynak şablon
`deploy/nginx.originmetric.conf`; Let's Encrypt sertifikası iki hostu kapsar.
Sertifika yenilemesi yalnızca bu domain için `/etc/cron.d/originmetric-cert-renew`
ile çalışır; nginx testinden sonra reload edilir. Kurulum raporu ve
`.runtime/https-backup-path` mevcut kanıt/yedek konumunu gösterir.

Bu aşamada yalnızca HTTPS root/static, health ve tracker açıktır. Internal/fixture
rotaları 404; identify/revenue 503; ingestion nginx'te 202/drop verir. G1 geçmedi.
`OM_INGRESS=local`, `PUBLIC_G1_READY=no` ve loopback Caddy korunur. Cloudflare
panelinde Full (strict) ve tek rate-limit kuralı sahibi tarafından doğrulanmalıdır.
Public veriyi açmadan önce gerçek CF istemci adresini koruyan ve özel güven
token'ını overwrite eden nginx/Caddy yolu kurulmalı ve test edilmelidir.
**Mevcut review Caddy sabit loopback CF adresi kullanırken nginx data-route
engellerini kaldırma.** Ardından aşağıdaki gerçek-domain dogfood adımları uygulanır.

Yalnızca controlled/synthetic trafik; public gerçek ziyaretçiye açmadan G1.
`/fixtures/required?site=PUBLIC_SITE_KEY&utm_source=Google` kontrollü sayfası izni bekler.
Playwright ile actual domain'de consent öncesi cookie/localStorage/network yokluğu ve consent sonrası
ziyaret gönderimi tekrar gözlenir. Server identify + `test:true` ödeme ile google/attributed sonucu,
yenileme/iade ve duplicate davranışı doğrulanır. Browser'a server key koyulmaz.
Gerçek dogfood sitesinde snippet `data-consent="required"` ve consent withdrawal bağlantısıyla kurulur.
Kontrollü test fixture'ı gerçek site banner'ı kurulmuş sayılmaz.

### Mevcut G1 teknik kontrol komutu

```bash
npm run gate:g1
# Yalnız teknik doğrulama için; gate kabulü değildir:
npm run gate:g1 -- --technical-only
```

Komut VPS'de çalışan imajı üretim sırları/volume'leri olmadan tek kullanımlık fixture'a kopyalar.
İzole test veritabanı tmpfs kullanır; portlar yalnız localhost'a bağlanır. Mevcut Chromium kullanılır
(gerekirse `PLAYWRIGHT_CHROMIUM_EXECUTABLE` mevcut executable'a ayarlanır). Source/imaj/live tracker
hash eşitliği, consent/withdrawal/GPC ve yedi dosyadaki 56 regression testi denetlenir. Üretim fact
sayıları SELECT-only karşılaştırılır, fixture kaynakları temizlenir; kanıt `.runtime/g1-latest-path` içindedir.
Teknik PASS, gerçek sitenin consent/banner onayı ve kayıtlı Cloudflare kural envanteri/counting period
incelemesinin yerine geçmez. Bu engeller varken normal komut exit 2 verir; teknik hata exit 1,
`--technical-only` teknik PASS için exit 0 verir. Hiçbir flag/route/phase kabulü değiştirilmez.

## 6. Yedek ve geri yükleme

Barış off-VPS sağlayıcısını seçer; mevcut ücretsiz hesabı uygunsa kullanılır. B2/R2 hesabı veya kart/
ücret gerekirse ayrıca onay alınır. Başka bir projeye ait rclone remote/config değiştirilmez.
Offline cihazda `age-keygen` ile anahtar oluşturulur. **Yalnızca public recipient** VPS'deki
AGE_RECIPIENT'e yazılır. Private key şifre yöneticisi/offline cihazda kalır.
`BACKUP_REMOTE=remote:bucket/path/originmetric` özel prefix olmalı. 7 günlük / 4 haftalık / 2 aylık
şifreli snapshot korunur; script bu prefix dışına silme yapmaz. Secrets ayrıca parola yöneticisinde.

Güvenli kurulum: mevcut yetkili remote için root-owned mode 600 özel rclone config dosyası kullan;
`.env.production` içine `RCLONE_CONFIG` ile dosya yolunu, `BACKUP_REMOTE` ile yalnız OriginMetric prefix'ini
ve `AGE_RECIPIENT` ile public recipient'i yerel editörle yaz. Aynı dosyada `HEALTHCHECKS_URL` ve
`SELFCHECK_URL` ayrı mevcut check'lerin URL'leri olmalı; değerleri terminal çıktısına veya sohbete koyma.
`.env.production` mode 600 kalmalı. Başka projenin config/remote'unu değiştirme; hesap/provider yetkisi
olmaksızın upload/retention başlatma. Sadece dosya yolu, sağlayıcı/prefix ve public recipient paylaşılabilir.

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
- https://www.postgresql.org/docs/18/runtime-config-logging.html
