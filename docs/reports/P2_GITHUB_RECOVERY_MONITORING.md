# P2 — originmetric.app consent, GitHub recovery and dashboard monitoring

**Current sequencing (2026-10-04): P2 OPEN / G1 PENDING; P3 IN PROGRESS under D-010.**
The owner explicitly lifted the earlier “do not proceed to P3” restriction and
instructed continuing independent development without waiting for backup proof.
[Current P3 foundation and dependencies](P3_TENANCY_FOUNDATION.md). Historical
“P3 NOT STARTED” statements below describe earlier evidence dates, not today's
sequencing. Physical GPC stays OPEN, phone-independent recovery DEFERRED; current
age key and working scheduler unchanged. No P2 acceptance criterion is waived.

Date: 2026-10-02; Cloudflare/owner evidence, remote ZIP readback and concrete proposal updates: 2026-10-03. Local encryption/env preparation and documentation only; **no production redeploy, ingestion opening or scheduled external probe**; the authorized private draft ZIP transfer is recorded below. P2 remains open; P3 not started. This extends the installation report and records owner preference D-007, not acceptance of a new architecture.

**Latest result (2026-10-03): REAL MANUAL RESTORE VERIFIED for the exact empty GitHub DB snapshot; P2 remains OPEN.** The [final verification and remaining canonical criteria](#real-manual-restore-verified-and-remaining-p2-acceptance--2026-10-03) supersede earlier restore OPEN/UNVERIFIED/pending-phone entries. Earlier dated sections remain historical evidence; no blanket P2 acceptance is implied.

## D-008 uygulama: gerçek DB backup ve bağımsız monitoring — 2026-10-03

**Kullanıcı onayı kaydedildi:** [D-008](../DECISIONS.md) private age-encrypted günlük DB draft Release backup, 03:15 UTC / Türkiye 06:15, 7 daily / 4 weekly / 2 monthly / ≤90 gün; ayrı public repo/standart GitHub-hosted yaklaşık 5 dakikalık HTTPS monitoring ve telefon Actions/Releases erişimini uygulama/etkinleştirme yetkisidir. Önceki “karar bekliyor/yalnız hazırlık” kayıtları bu kapsamda tarihsel kaldı; genel onay tekrar istenmez. Canonical plan dosyası değişmedi. Bu operasyon onayı, telefon dışı kasa ertelemesini kaldırmaz veya canonical acceptance/G1/P2'yi kapatmaz.

### Gerçekleşen sonuçlar

| İş | Kanıt / sonuç |
|---|---|
| Private backup repo/dashboard | [brsctncnbrk5/originmetric-recovery Releases](https://github.com/brsctncnbrk5/originmetric-recovery/releases), private/draft API ile tekrar doğrulandı; proje `GH_CONFIG_DIR=/opt/originmetric/.runtime/github-auth`, beklenen hesap **brsctncnbrk5** |
| İlk gerçek DB backup | Snapshot **`om-db-v1-20261003T021231Z-1e2e2aff`**, captured **02:12:31 UTC**, Release ID **402277368**, [draft Release](https://github.com/brsctncnbrk5/originmetric-recovery/releases/tag/untagged-dd8704d6759021810341). Production `pg_dump -Fc --no-owner --no-acl` consistent snapshot → age stream; disk/Git'te plaintext dump yok. DB dışında env/config/private key dosyası alınmadı. |
| Ciphertext / readback | `database.dump.age`, **32381 B**, asset **606957843**; SHA-256 **`83837da8711db77f3e141c58cf07cb2519fbd2106aeed1a459f67319d84962c6`**. Manifest asset **606957883**, **84 B**. Her iki uzak asset geri indirildi; local/reference byte/hash/size eşleşti, age header doğru. API digest de aynı. Bu **BACKUP CREATED + REMOTE READBACK VERIFIED**; restore false. |
| Metadata sonrası güvenli toparlama | İlk upload/readback tamamlandı, GitHub PATCH sonrası draft `untagged-*` alias'ı yüzünden retention doğrulaması durdu; hiçbir eski Release silinmedi. Exact owned title/body marker + kontrollü draft alias doğrulaması ve explicit reverify yolu eklendi/test edildi. Aynı snapshot, yeni dump/upload oluşturmadan **02:14:30 UTC** yeniden indirildi/hash-manifest doğrulandı, state verified ve retention tamamlandı. Source SHA ilk oluşturma kodu `a1cd25e713a231d268cbe8ccf9af52f9054d8516`; metadata/readback düzeltmesi sonraki task commit'indedir. |
| Retention / telefon ZIP | Gerçekte **0** kayıt silindi. Önceki phone Release **402255166**, asset **606851238**/**1863 B**/önceki digest korundu. Policy 7 ayrı gün / 4 ISO hafta / 2 ay için en yeni snapshot'ların birleşimini tutar (en fazla 13); weekly Sunday, monthly ayın 1'i. Yalnız explicit owned DB marker/title/allowed asset'ler; ≥90 gün temizlenir. Unmarked/published/ilgisiz asset'li Release, telefon ZIP'i ve git tag/ref korunur. Partial snapshot ≥1 gün grace sonrası ancak yeni verified backup ile cleanup'a girer. |
| Public monitoring repo/dashboard | Ayrı [brsctncnbrk5/originmetric-monitoring](https://github.com/brsctncnbrk5/originmetric-monitoring), [Actions](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/workflows/uptime.yml). Public envanter yalnız **README.md, observe-public.mjs, .github/workflows/uptime.yml**; private repo içeriği, backup, env veya credential yok. Root commit `b2d0578f5a5805a1925b2deec15a44e65dd76187`; schedule commit **`0a63e43c9494ae0e75de657473f59469b4b9deba`** (yerel/uzak main eşleşti). |
| VPS dışı manuel test | [Run **37088999270**](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37088999270), **workflow_dispatch / success**, GitHub standard hosted ubuntu-24.04; gözlem **02:12:58.179 UTC**: `/api/health` **200 + status ok**, `/js/v1/om.js` **200 + uygun MIME/marker/version**, iki check PASS. Repo `main` ve workflow **active** API ile doğrulandı. Bu run email/dead-man kanıtı değildir. |
| Etkin monitoring schedule | Manuel PASS sonrası `main`e normal push ile **`2-57/5 * * * *` UTC** eklendi; kaynak/API workflow içeriği eşleşiyor, yaklaşık 5 dakika. GitHub'ın queue/run zamanı garanti değil; sonraki hedef slot rapor kontrolü sırasında **02:22 UTC / Türkiye 05:22** (ileri slotlar aynı dakika dizisinde). İlk scheduled run başarı kanıtı henüz iddia edilmez; manuel run ayrı kanıttır. |
| Backup schedule | `originmetric-github-backup.service` ve `.timer` repo'da hazır ve `/etc/systemd/system` altında kuruldu/syntax PASS; calendar **03:15 UTC / Türkiye 06:15**, Persistent=true, random delay yok. **DISABLED / INACTIVE**: uygun repo-scoped kimlik yok. Dolayısıyla sonraki otomatik backup çalışması **yok**; kimlik/check sonrası ilk hedef **2026-10-03 03:15 UTC / 06:15 Türkiye** (o slot geçerse bir sonraki gün, Persistent yakalama semantiği ayrıca geçerli). Broad operator login kalıcı unit/cron'a konmadı. |

### Kimlik ve güvenlik sınırı

Mevcut proje auth envanterinde yalnız owner `hosts.yml`/`config.yml` vardı; uygun unattended credential bulunmadı. İlk gerçek backup ve public repo hazırlığı için verilen proje owner girişi **yalnız explicit one-time operasyonlarda** kullanıldı. Scheduled backend, `.runtime/github-auth/backup-token` (root-owned 600; systemd LoadCredential kopyası 400 de kabul edilir) içindeki fine-grained kimliği kullanır; token yokken veya broad token türü verildiğinde **owner girişine fallback yapmaz**. Token argv/output/journal/Git'e taşınmaz. GH_CONFIG_DIR proje yolunda kalır; global GitHub ayarları değiştirilmedi.

**Tek somut kullanıcı kimlik adımı:** [fine-grained token oluşturma](https://github.com/settings/personal-access-tokens/new) panelinde resource owner **brsctncnbrk5**, **Only select repositories: originmetric-recovery**, **Contents: Read and write** (+otomatik Metadata read), örneğin **90 gün expiry** seç. Başka repo/Actions/Workflows/Administration/account yetkisi verme. Tokenı sohbete göndermeden [runbook'taki hidden-input yerleştirme ve check](../runbooks/VPS_INSTALLATION.md#d-008-github-db-backup-kimliği-ve-gerçek-restore) ile proje özel dosyasına koy. Token seçim kapsamı panelde doğrulanmalıdır; backend prefix/API check'i gerçek selected-repo kapsamını introspect edemez. Ardından scoped kimlikle gerçek backup/readback PASS ve `systemctl enable --now originmetric-github-backup.timer` adımı mevcut yetkiyle tamamlanabilir; tekrar genel onay gerekmez. API read/write gereksinimleri [Release asset izinleri](https://docs.github.com/en/rest/releases/assets#upload-a-release-asset) ile kontrol edildi. Yeni token üretilmedi veya chat'ten istenmedi.

### Doğrulama ve açık kabul koşulları

Backend **14** adversarial/local test PASS: 7/4/2 calendar retention/duplicates/90 gün, unknown/phone/extra asset/published korunması, recent verified current şartı, draft alias sahipliği, corrupt remote readback→no verified/no prune, dump/visibility failure→no upload, remote target mutation→no delete, operation lock ve missing-scoped→no broad fallback. Mevcut observer **7** test, rclone readback üç senaryo ve deploy-control proof PASS. systemd syntax/calendar, shell syntax, lint/format/typecheck ve secret scan sonuçları handoff'ta kaydedilir. Fixture kontrolü gerçek restore değildir.

Uygulama restart/deploy edilmedi. Protected baseline ile canonical plan/production env/installed nginx hash ve production container ID/start time/restart count eşitliği kontrol edildi. Read-only production transaction: events/sessions/customers/revenue_events/customer_attribution **0/0/0/0/0**. Live GET root data gates: events **202/drop**, identify/revenue **503**, internal operations **404**; health/tracker **200**. `PUBLIC_G1_READY=no` korunur. Mevcut rclone `backup.sh`/deploy prerequisite'i sessizce GitHub'a retarget edilmedi.

**Açıklar ayrı:**

- **Gerçek restore OPEN:** owner gerçek DB asset+manifest remote download/hash → mevcut private key ile offline decrypt stream → network-none/tmpfs disposable `restore-check.sh`; 10 tablo/migration metadata/counts, iki pipeline exit status ve production değişmeme/cleanup kanıtı. [Hazır komutlar](../runbooks/VPS_INSTALLATION.md#d-008-github-db-backup-kimliği-ve-gerçek-restore). Private key telefon/offline cihazda kalır. Ciphertext/header/hash, env decrypt ve backup created bu sonucu kanıtlamaz.
- **Telefon dışı kasa yedeği ERTELENDİ:** phone-independent vault/key/account/2FA access unverified; telefon kaybına kurtarma hazırlığı tamamlanmadı. Önceki kullanıcı phone hash/decrypt/KeePassDX beyanları korunur.
- **Backup timer kimliği BLOCKED:** yalnız yukarıdaki repo-scoped güvenli token kurulumu eksik; hazırlık/gerçek one-time backup korunmuştur.
- **Email / dead-man / missing-workflow detection OPEN:** named destination/settings/delivery test ve backup/selfcheck start/success/fail/missing pings kurulmadı. Actions summaries/log history izleme sonucudur; verified e-posta veya bağımsız missing-run alarmı değildir. Owner haftalık workflow enabled/last-run kontrolü yapmalı; >15 dakika yaşlı run UNKNOWN/STALE, >26 saat eski DB snapshot missing/unknown kabul edilir; otomatik stale adapter/alarm yok.
- **Canonical lifecycle ve G1/P2 OPEN:** GitHub owned cleanup, object-storage bucket lifecycle backstop değildir; VPS/job durmuşken ≤90 gün otomatik silme garanti edilmez. Gerçek-domain consent/banner/withdrawal/GPC/persisted trusted attribution ve diğer mevcut açık kabul koşulları korunur. **G1 PENDING; P2 OPEN; P3 başlamadı.**

Güncel resmî dokümantasyon **2026-10-03** kontrol edildi: default branch gerekir, beş dakika minimum aralıktır, schedule gecikebilir/düşebilir; public repoda **60 gün activity yoksa schedule devre dışı** olabilir. Workflow'un çalışmaması için bağımsız detector burada kurulmadı. [GitHub schedule koşulları](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Standard public hosted runner ücretsiz; larger runner, artifact/LFS/cache satın alma veya paid service yok. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## GitHub ZIP readback ve tek önerilen yapılandırma — 2026-10-03

**Gerçekleşen işlem: mevcut dosya yeniden indirildi, yeni upload yapılmadı.** Yalnız `GH_CONFIG_DIR=/opt/originmetric/.runtime/github-auth` proje girişi kullanıldı; `GH_TOKEN`/`GITHUB_TOKEN` ortam override'ları kaldırıldı. API hesabı **brsctncnbrk5**; recovery repo indirme öncesi ve sonrası **private**, mevcut Release **draft** olarak doğrulandı. Global giriş/ayarlar ve başka proje kimlikleri kullanılmadı/değiştirilmedi. Daha önceki iki commit (`c84d67a`, `c1e0e6b`) korunmuş ve önceki kullanıcı talebiyle normal push edilmiş durumda; bu işin başlangıcında yerel/uzak HEAD `c1e0e6ba80a8315ab4a92b8e9fdce1c94c76925d` eşleşti. Aşağıdaki eski 403/404 kayıtları tarihsel kanıttır; **güncel erişim engeli çözülmüştür**.

| Readback kanıtı | Gerçek sonuç |
|---|---|
| Kontrol zamanı | **2026-10-03 01:51:17 UTC** |
| Uzak kaynak | `brsctncnbrk5/originmetric-recovery`, Release ID **402255166**, tag `phone-recovery-20261003t011214z`, draft |
| Yeniden indirilen asset | `originmetric-phone-recovery.zip`, asset ID **606851238**, **1863 B** |
| SHA-256 | `a35fdf8963f58382d7cfbb8881e8c4abb524434f2ee1fb1e9d981af0793b4256` — yeni uzak indirme, eski yerel ZIP, önceki rapor kaydı ve GitHub asset digest **eşleşti** |
| Ek bütünlük kontrolleri | ZIP CRC, tam dört beklenen member adı, iç manifestteki üç dosyanın SHA-256 kontrolü **PASS**; içerik yazdırılmadı |
| Özel yerel kanıt | `.runtime/p2-remote-readback-20261003T015116Z/verification.json` ve yeniden indirilen ZIP; root-owned directory **700**, files **600**, Git-ignored; pointer `.runtime/p2-remote-readback-path` |

Kontrol, backup aracında hazırlanmış **uzak ciphertext hash'ini yerel/reference hash ile karşılaştırma** ilkesini mevcut ZIP'e uygular. `backup.sh` çalıştırılmadı; rclone remote'unun veya GitHub DB backend'inin çalıştığı iddia edilmez. Paket DB dump içermiyor. Şifre çözme, DB restore, tam backup/restore veya telefon kaybı tatbikatı **yapılmadı**. Kullanıcının daha önce bildirdiği telefon hash/sample/env decrypt ve KeePassDX kaydı kullanıcı beyanı olarak korunur.

### Tarihsel tek öneri — D-008 uygulama yetkisiyle superseded

Bu öneri D-007'nin **GitHub-only değerlendirme / originmetric.app-only / dashboard gözlemi** yönünü korur. D-001 canonical planı ve §§24–25 koşulları değişmez. Aşağıdaki yapılandırma için kullanıcı kararı gerekir; bu dokümantasyon veya mevcut telefon ZIP izni otomasyon/DB upload izni değildir.

| Konu | Önerilen somut yapılandırma |
|---|---|
| Private saklama hedefi | Mevcut **`brsctncnbrk5/originmetric-recovery`**, **draft Release assets**. DB snapshot'ları Git commit/LFS/Actions artifact olarak tutulmaz. Her snapshot'ta yalnız `database.dump.age` ve ciphertext `SHA256SUMS`; Release açıklamasında sır içermeyen tarih/source SHA/boyut/hash/readback durumu. Offline private age key VPS/GitHub'a gelmez. |
| Env/config ayrılığı | Düzenli DB Release'lerine `.env` veya onu içeren `configuration.tar.age` eklenmez. Ayrı şifreli env ve secret içeren config mevcut sahibin KeePassDX kasasında, DB deposundan ayrı tutulur; config değiştiğinde sahibi günceller. Önceki tek seferlik telefon ZIP'i aynen korunur; bu görev onu silmez/yayımlamaz veya düzenli secret backup politikası saymaz. Önceki DB ile config upload önerisi bu **karar bekleyen DB-only öneriyle** daraltılmıştır. |
| Backup sıklığı | Yetkilendirme ve eksik saklama koşulları çözüldükten sonra **her gün 03:15 UTC**, VPS host cron → consistent `pg_dump -Fc` → mevcut public recipient'e age stream → GitHub API upload/readback. Önerilen cron `15 3 * * *` ancak scheduler timezone **UTC** açıkça uygulanır; host yerel saati varsayılmaz. Hedef RPO ≤24 saat; fail/missing backup bunu bozar. |
| Saklama sayısı ve süre | **7 günlük / 4 haftalık / 2 aylık**: günlük sınıf her gece, haftalık Pazar günkü dump, aylık ayın 1'inin dump'ı. Özel Release namespace `om-db-daily-YYYY-MM-DD`, `om-db-weekly-YYYY-Www`, `om-db-monthly-YYYY-MM`; sınıflar arasında kopya olabilir. Günlük yaklaşık 7 gün, haftalık yaklaşık 4 hafta, aylık yaklaşık 2 ay; her DB snapshot için mutlak **≤90 gün** üst sınır. Yalnız yeni upload/hash readback başarılı olduktan sonra owned namespace içinde script cleanup; `phone-recovery-*` kapsam dışı. En fazla 13 DB snapshot + manifest; gerçek encrypted boyutlar henüz ölçülmedi. |
| Lifecycle sınırı | GitHub'da önerilen Release cleanup, provider bucket lifecycle değildir. VPS/job durursa cleanup ve ≤90 gün backstop güvencesi yoktur; sahibi **haftalık** private Releases yaş/sayı denetimi yapar. Bu manuel kontrol canonical lifecycle backstop'u yerine getirmiş sayılmaz; backend/retention kodu da henüz uygulanmadı. |
| VPS dışı uptime | Public **`brsctncnbrk5/originmetric`** default `main` dalında, mevcut inactive template'ten hazırlanacak `uptime.yml`; standart GitHub-hosted **ubuntu-24.04**, self-hosted/VPS runner değil. Hazır `observe-public.mjs` yalnız HTTPS `/api/health` + `/js/v1/om.js` GET; token/SSH/event POST yok. **5 dakika**, saat başına yığılmayı azaltan öneri `2-57/5 * * * *`; manual dispatch de bulunur, timeout 3 dakika. Dosya şu anda workflow dizininde/default branch'te etkin değil. |
| Telefonda dashboard | Mobil tarayıcıda [public Actions](https://github.com/brsctncnbrk5/originmetric/actions): etkinleştiğinde uptime run zamanı/başarı/başarısızlık ve iki endpoint sonucu; [private Releases](https://github.com/brsctncnbrk5/originmetric-recovery/releases): owner girişiyle backup zamanı/asset/hash ve indirme. Bunlar VPS kapalıyken GitHub erişimi varsa açılır. Şu anda Actions'ta yalnız **CI** aktiftir; gelecekteki uptime sonucu varmış gibi gösterilmez. `originmetric.app/internal/operations` public 404 kalır; hazır yerel operations view bu dashboard için deploy edilmez. |
| Gecikme / görünür durum | 15 dakikadan eski son uptime run **STALE/UNKNOWN**, failed run **FAIL**; 26 saatten eski son gerçek DB backup **MISSING/UNKNOWN** olarak yorumlanmalı. Bu eşikler önerilen dashboard/operatör yorumudur; adapter ve otomatik stale/missing alarmı henüz yok. CI sonucu uptime sonucu değildir; mevcut telefon ZIP'i DB backup satırı değildir. |
| Bildirim | Başarısız uptime Actions run için sahibin mevcut GitHub hesabındaki doğrulanmış e-posta bildirim ayarını kullanma önerisi. **Adres/hedef, ayar ve test işlemi önce sahibi tarafından doğrulanıp açıkça yetkilendirilir**; burada bildirim/test gönderilmedi. Bu yöntem backup start/success/fail/missing Healthchecks pingi veya kendi schedule'ının dead-man kontrolü değildir; ayrı eksik koşullar olarak kalır. |

GitHub draft release'leri yalnız push erişimli kullanıcılara listeler; telefondan mevcut owner hesabı kullanılmalıdır. Releases dosya başına **<2 GiB**, Release başına **1000 asset** sınırını belgeler; belgede toplam boyut/bandwidth sınırı belirtilmemesi yedek hizmeti/lifecycle/SLA garantisi değildir. Öneri küçük ciphertext dosyaları içindir. [Release limitleri](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [draft erişimi](https://docs.github.com/en/rest/releases/releases#list-releases).

**Maliyet/kota:** önerilen public repodaki standart hosted runner ücretsizdir; private recovery repoda Actions çalıştırılmaz, runner/artifact/cache/LFS ücretli saklama kullanılmaz. Beş dakikalık schedule yaklaşık **288 run/gün, 8640 run/30 gün** üretir; bu sayılar dakika tüketimi değildir. Larger runner ücretlidir ve seçilmez. Private runner'a ileride geçiş bu öneriye dahil değildir: Free plan belgesindeki 2000 dakika/500 MB varsayımı hesaba uygulanamaz, API bu hesabın planını/kotasını göstermedi. Bu görev ödeme, ücretli tier veya spending ayarı açmadı; özel hesap bütçe/quota ayarları bağımsız olarak doğrulanmış değildir. [Güncel Actions ücretlendirmesi](https://docs.github.com/en/billing/concepts/product-billing/github-actions) (2026-10-03 kontrol edildi).

**Gerekli izinler:** owner projede `admin/push`, recovery repoda `admin/push/private` erişimine sahip (API doğrulandı). Bugünkü readback/push yalnız verilen proje login'iyle yapılır. İleride unattended DB backend için yalnız recovery repo'ya seçilmiş, süresi sınırlı **fine-grained Contents: Read and write** credential güvenli mode-600 dosyada gerekir; bugünkü broad owner login'i cron'a kopyalanmaz. Bu izin asset/release cleanup'ı da mümkün kıldığı için repository erişim kapsamı önemlidir. Yeni token üretilmedi/istenmedi. Uptime job için `permissions: contents: read`, public checkout dışında secret gerekmez; workflow'u `main` üzerinde etkinleştirmek repo/workflow yönetim yetkisi ve owner kararı gerektirir. Public Actions run sonuçlarının okunması token gerektirmez; ileride authenticated mirror gerekirse yalnız ilgili repo için **Actions: read** yeterliliği değerlendirilir. [Release API izinleri](https://docs.github.com/en/rest/releases/releases#create-a-release), [run okuma izinleri](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository).

**Schedule sınırı:** default branch gerekir; GitHub job geciktirebilir/düşürebilir, public schedule 60 gün repo hareketsizliğinde devre dışı kalabilir. Beş dakika hedef aralıktır, garanti değildir. GitHub outage/account kaybı backup erişimi ve monitoring'i birlikte etkileyebilir; bu yapı kendi çalışmayan scheduler'ını bağımsız olarak izleyemez. [Resmî schedule koşulları](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

### Ayrı açık gereksinimler ve sıradaki kullanıcı adımı

| Gereksinim | Güncel durum |
|---|---|
| Mevcut telefon ZIP remote readback | **PASS**, yalnız bu paketin transport bütünlüğü; real DB backup/restore değil |
| Gerçek DB backup/manual restore | **OPEN**: authorized backend + gerçek DB ciphertext upload/readback, owner remote download/hash/offline decrypt → disposable PostgreSQL restore; tablo/migration/count sonuçları ve production değişmeme kanıtı. Synthetic CI/env decrypt yerine geçmez. |
| Telefon dışı kasa yedeği | Kullanıcı kararıyla **ERTELENDİ**. Telefon bağımsız vault/key/account/2FA recovery **UNVERIFIED**; telefon kaybına hazırlık tamamlanmış değil. Mevcut key/paper/vault beyanı korunur. |
| Canonical storage/lifecycle | **OPEN**: §24 rclone/object storage + bucket lifecycle ile GitHub Release cleanup farkı için açık owner kararı; ayrı secret saklama/env güncelleme ve eksik telefon dışı preservation şartı çözülmeden bağlı operasyonlar başlamaz. |
| Monitoring/dead-man/email | **OPEN**: template hazır, hiç recurring uptime job etkin değil; backup/selfcheck start/success/fail/missing pings ve doğrulanmış e-posta delivery yok. Tek bir Actions run/telefon dashboard'u bunları tamamlamaz. |
| Gerçek domain/G1/dogfood | **OPEN**: gerçek required-consent/banner/withdrawal/GPC ve persisted session→trusted identify→revenue→attribution/duplicate/refund kanıtı; bağımsız provider/original-export incelemesinin açık sınırları önceki raporda korunur. |

**Kullanıcının sıradaki somut adımı:** yukarıdaki tek GitHub önerisini, canonical storage/lifecycle/dead-man farklarıyla birlikte kabul edip etmediğini bildirmek ve mevcut GitHub e-posta bildirim hedefi/ayarını tanımlamak. Bu bir plan kilidi/waiver veya telefon dışı ertelemenin kalktığı varsayımı değildir; gerekirse yeni açık owner kararı ayrıca kaydedilir. Kabul gelmeden DB backend/upload/cleanup/schedule/notification etkinleştirilmez. Bu görevde yeni upload, silme, Release yayınlama, DB dump/decrypt/restore, workflow dispatch, scheduler veya deploy olmadı. **G1 PENDING; P2 OPEN; P3 başlamadı; PUBLIC_G1_READY=no, events 202/drop, identify/revenue 503, internal/fixtures 404 korunur.**

## Owner-reported phone checks and independent preparation — 2026-10-03

**Source: new user declarations, not independently inspected phone evidence.** The user reports `sha256sum -c SHA256SUMS` returned OK for `recipient-check.txt`, `recipient-check.txt.age` and `env.production.age`; the harmless sample decrypted with the phone's existing private key and matched the expected text; the real env ciphertext decryption check completed without displaying contents; `env.production.age` was attached to and saved in the existing KeePassDX vault. Record these four steps as **OWNER-REPORTED COMPLETE**. No private key, vault or decrypted env was read here. Neither these statements nor the earlier authenticated server readback prove a database restore or a full recovery drill.

**Explicit owner deferral:** a vault backup outside the phone is **DEFERRED**, not complete. Phone-independent vault/key/account/2FA access remains **OPEN / UNVERIFIED**; phone-loss recovery readiness is not complete. Earlier phone download/decryption/vault-storage requests below are historical and superseded by this section; do not ask the owner to repeat them. Separate env vault storage is reported complete, while the missing independent preservation condition remains open.

### Existing work inspected and new preparation

Read operating rules, locked canonical §§23–25/28/31/33, DECISIONS, STATUS, both earlier P2 reports, recovery packager, backup/restore/selfcheck tools and inactive GitHub template. No applicable repository/ancestor `AGENTS.md` exists (the discovered Next.js dependency file does not govern these task files). The private draft ZIP transfer already exists according to the preserved earlier evidence; no duplicate repo/release/upload or sample encryption was performed.

- Local `prepare-recovery.sh --inventory` passes for all scoped required paths. No DB/config encryption or upload was run. Existing offline-decrypted stdin → isolated PostgreSQL restore tool is retained, with the concrete evidence sequence added to the runbook.
- `backup.sh` now streams each of the three remote ciphertext classes through SHA-256 and compares the local encrypted object hash **before retention for that class or final success**. It previously compared only sizes. A failed/truncated remote read propagates through `pipefail`; it does not mark completion or prune that class. This prepares the canonical rclone backend, not a GitHub backend or an off-VPS success claim. Retention remains 7 daily / 4 weekly / 2 monthly; provider lifecycle configuration is still missing.
- `observe-public.mjs` performs only two fixed public HTTPS GETs, no redirects, credentials, event writes or notification pings. It requires HTTP 200 plus JSON health `status=ok` and JavaScript tracker MIME/content/version, rejects HTML and bodies above 64 KiB, and prints only timestamp/path/status/pass. Version `0.1.0` is explicit and must be reviewed with a future tracker version change; marker checks are not byte-integrity verification. The inactive `deploy/github/uptime.yml` calls it on a GitHub runner with read-only contents permission; no workflow activation/dispatch/schedule occurred. Running it on this VPS would still be same-VPS evidence; no live observer result is claimed.
- Current read-only GitHub API identity is `brsctncnbrk3-hub`; private recovery repo metadata and release queries returned **404**. This does not prove deletion/nonexistence and does not invalidate the earlier owner-authenticated private transfer. **Current private-target access/privacy cannot be reverified with this session's credential.** Do not create a replacement target or reuse another project's secrets. The assigned public project branch remains accessible.

### Remaining gates and concrete next owner action

The next useful owner action, independent of the deferred vault backup, is an explicit decision on the already documented GitHub alternative: private Release DB snapshots with scoped credentials, manual 7/4/2 retention and no bucket lifecycle backstop; separate env secrets retained in the owner vault; best-effort Actions observations do not supply independent missing-run detection or verified email delivery. Name the authorized GitHub identity/private target and proposed notification operation/destination/settings. Existing approval covers preparation and the earlier phone ZIP only; it does not silently approve these deviations, recurring jobs or another upload.

Until that decision, authorized private-target access and the missing preservation condition are resolved, **no real backup upload, production deploy, retention execution, schedule or data gate is activated**. Real off-VPS readback/download/manual DB restore and independent recurring monitoring/dead-man/email remain OPEN. Off-phone vault backup remains explicitly DEFERRED. **G1 PENDING; P2 OPEN; P3 not started**; `PUBLIC_G1_READY=no`, events 202/drop, identify/revenue 503, internal/fixtures 404 remain required.

## Private GitHub phone transfer — 2026-10-03

The owner explicitly authorized a **one-time ZIP upload for phone download**. The existing SHA256SUMS verified all three referenced source files. ZIP CRC, exactly four relative member names, and each member's bytes were checked: `recipient-check.txt.age`, harmless `recipient-check.txt`, `env.production.age`, `SHA256SUMS`. No plaintext production env, private key, credential or other file is included. Local ZIP: `/opt/originmetric/.runtime/p2-recovery-transfer-20261003T011214Z/originmetric-phone-recovery.zip`; **1863 B**, SHA-256 `a35fdf8963f58382d7cfbb8881e8c4abb524434f2ee1fb1e9d981af0793b4256`.

Authenticated GitHub API confirmed `brsctncnbrk5/originmetric` is **public**, so its visibility was preserved. Created **private** `brsctncnbrk5/originmetric-recovery` with only GitHub's harmless initial README commit; no recovery file was added to any Git history. Rechecked private visibility immediately before upload and after readback. Created a new **draft** release `phone-recovery-20261003t011214z` with a single ZIP asset; no public VPS download endpoint, release publication, remote backup configuration or automation was created.

[Draft release page](https://github.com/brsctncnbrk5/originmetric-recovery/releases/tag/untagged-0236588ff9f334da0762) · [ZIP download](https://github.com/brsctncnbrk5/originmetric-recovery/releases/download/untagged-0236588ff9f334da0762/originmetric-phone-recovery.zip). Both are token-free GitHub URLs and require the authorized account to be signed in with access to the private draft. An authenticated API download on the VPS matched the ZIP SHA-256, CRC, exact member list and source bytes. This is **server-side transfer/readback verification only**; phone download, local decryption, KeePassDX attachment/off-phone vault backup, phone-independent access and restore remain unverified.

This permission covers this transfer only; it does not accept the canonical GitHub storage/lifecycle/monitoring deviations or satisfy separate password-manager storage. **No database backup or restore occurred; no automatic backup is configured. G1 pending; P2 open; P3 not started.** Env (including BACKUP_REMOTE), canonical plan, DECISIONS and app container IDs/start times/restart counts matched the pre-transfer baseline. Source/ZIP/readback artifacts remain ignored in `.runtime/`; nothing encrypted is committed. Earlier local-only/no-upload statements below describe the earlier preparation, superseded for this ZIP by this section.

## Age recipient and separate env recovery preparation — 2026-10-03

**Completed on the VPS:** age 1.1.1 accepted the supplied public recipient by successfully encrypting harmless known text (exit 0). This validates the recipient encoding/checksum and server encryption path; it does **not** prove possession of the matching private key, decryption or restore.

Public recipient: `age13urytsrv03lfjsex87hhvnj3pa6lglhd9f2yklnjths3jzz2p4uszmjfs2`.

Only `AGE_RECIPIENT` was populated in the existing `.env.production`; a byte comparison verified all other values were preserved, including `BACKUP_REMOTE` and `PUBLIC_G1_READY`. Ownership/mode verified **root:root / 600**. No env content or secret value was printed. Canonical §24, the runbook and `backup.sh` were reviewed: pg_dump streams to age, rclone requires an authorized dedicated remote, and backup/check scripts can send notifications. Neither `backup.sh` nor the DB/config packager was executed; no DB backup, remote upload, scheduler or notification occurred.

Separate recovery artifacts are local only, in ignored root-owned mode-700 directory `/opt/originmetric/.runtime/p2-age-recipient-20261003T010139Z` (pointer: `.runtime/p2-age-recipient-path`):

| File | Actual content / result |
|---|---|
| `recipient-check.txt` | Harmless known test text, no production data |
| `recipient-check.txt.age` | That test text encrypted to the supplied recipient |
| `env.production.age` | Only the updated production env, encrypted directly from memory; no extra plaintext recovery file |
| `SHA256SUMS` | SHA256 of the three files above; transport integrity reference, not restore evidence |

Ciphertexts are nonempty and root-owned mode 600. All artifacts and `.env.production` are Git-ignored; none is staged, committed or uploaded. Existing recipient encryption needs **no additional password**. Existing KeePassDX vault credentials stay local; no password/key was generated or requested. The local encrypted env file is prepared, but canonical **encrypted env in the owner's password manager outside the DB backup bucket remains OPEN** until owner transfer/storage is confirmed. This ciphertext stays separate from any DB archive/bucket.

**User declaration, not independent verification:** the private age key was created in Debian on the phone, saved in a KeePassDX vault, and a paper copy was prepared. These statements supersede the earlier absence of owner confirmation; they do not establish a vault backup outside the phone, complete/readable paper recovery, phone-independent vault/key/account/2FA access, or successful decryption. The private key was not supplied to or transferred onto the VPS.

**Next verification on the phone:** download the four named files over authenticated SSH into a private local directory (the server has not uploaded them). Verify `SHA256SUMS`, then use the existing private key only in the phone's Debian environment:

```bash
# Phone only; replace the path with the existing local private-key file.
# Keep key contents, vault passwords and decrypted env out of terminal/chat output.
set -o pipefail
sha256sum -c SHA256SUMS
age -d -i /local/path/existing-age-key.txt recipient-check.txt.age | cmp - recipient-check.txt
# Optional separate env decryption authentication check, without printing plaintext:
age -d -i /local/path/existing-age-key.txt env.production.age > /dev/null
```

A successful `cmp` exit status proves this harmless sample decrypts with that local key; env decrypt exit 0 proves only that ciphertext decrypts. Neither is a database restore. Store `env.production.age` as an attachment in the existing KeePassDX vault, outside the DB backup bucket. Separately preserve/access the vault backup and existing recovery information from a trusted device **without the phone**, and test that path; none of these owner steps has been executed or verified here. Report only outcomes, never secret contents.

**Still OPEN:** off-phone vault/secret backup, phone-independent private-key and account recovery, decryption, real off-VPS DB upload/readback/download/manual isolated restore, canonical storage/lifecycle/GitHub decision, backup schedule and independent recurring monitoring/dead-man/email, actual-domain consent and persisted attribution. **G1 pending; P2 open; P3 not started.** Application container IDs/start times/restart counts and canonical plan/DECISIONS/installed ingress config hashes matched the pre-change baseline. No app restart, deployment or gate change occurred; current routes remain gated.

## Chosen dogfood integration

`/dogfood` is prepared for **originmetric.app only**. It loads the real `/js/v1/om.js` bundle with `data-consent="required"`, and explicit allow/deny/withdraw buttons call the existing callable API `originmetric("consent", true/false)`. There is no `originmetric.consent()` method in the current tracker. GPC remains enabled by default. Choice is not persisted, so reload requires consent again. An invalid/unconfigured `OM_DOGFOOD_SITE_KEY` loads no tracker and disables the buttons; no test key is used in production. The new public key env is passed by Compose but the actual production env was not changed.

Preparation checks: production Next build and tracker budget (2491 B gzip) passed; three focused Playwright checks passed with a deliberately unusable DATABASE_URL. The actual page implementation was tested on localhost: pre-consent and denial have zero event requests/state; allow produces one request; withdrawal clears identifiers and stops SPA sends; reload requests consent again; GPC blocks sending even after allow. The ingestion request is intercepted with 202/drop, so these are **browser integration tests**, not real domain/production attribution evidence. The third check verifies operations authorization and missing-data rendering. Existing deployed-build G1 evidence is reused, not claimed for this changed undeployed source.

Production still has no registered project. After real off-VPS backup and the reviewed deployment prerequisite are satisfied, create the `originmetric.app` project through the existing CLI without printing server credentials, set its public key in `OM_DOGFOOD_SITE_KEY`, deploy the reviewed SHA and keep `PUBLIC_G1_READY=no` plus current nginx data gates. Then the actual HTTPS page can prove pre-consent, deny, allow/withdraw/browser state, GPC and a dropped request while **production fact counts stay unchanged**. This actual-domain verification has not happened yet.

The test requiring a separately authorized data-gate change is **persisted consented pageview/session/source → server-only identify → test revenue → attributed result, duplicate/refund behavior**. A 202 from today's drop gate is not persistence evidence. The gate is not opened by this task.

## Historical GitHub feasibility and actual access — 2026-10-02

Read-only GitHub API: authenticated owner `brsctncnbrk5`; current token has repo/workflow scopes. The visible repository list contains public `originmetric`, with admin/push access. There is no verified private recovery target. Account plan/current private Actions quota/spending controls were not exposed by that response; they are unknown, not assumed Free. A read-only billing usage request returned 404; it does not establish quota or a no-spend budget.

| Option | Verified constraints | P2 conclusion |
|---|---|---|
| Commit encrypted dumps to Git | Regular objects above 100 MiB blocked; GitHub explicitly says Git is not a backup tool and large SQL belongs elsewhere. Git history also defeats ordinary retention. [Docs](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) | Rejected; no database/config object is committed. |
| Dedicated **private** repo + Release assets | Releases document <2 GiB/file and up to 1000 assets/release, without an aggregate size/bandwidth quota. This is not unlimited guaranteed backup service: acceptable-use throttling/account suspension still applies. [Release limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [acceptable use](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies) | Technically plausible for small encrypted recovery snapshots, subject to explicit target/privacy/readback verification and a plan exception. No repo/release created or upload attempted. |
| Actions artifacts / Git LFS | Artifacts are quota/expiry governed; private standard-runner quota is plan dependent (Free: 2000 min/500 MB, Pro: 3000 min/1 GB). Paid usage may occur beyond limits if enabled. LFS has separate storage/bandwidth billing. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs) | Not selected as a durable/no-cost backup target. No larger runner, paid storage or LFS enabled. |

Proposed first-upload target, **not yet created**: `brsctncnbrk5/originmetric-recovery`, verified private, dedicated recovery Release tag namespace. Proposed content: `database.dump.age` (consistent production pg_dump), separately encrypted `configuration.tar.age` (OriginMetric env/ingress/deploy/firewall/renewal config), and ciphertext SHA256SUMS. No plaintext dump/config, private decryption key, broad GitHub credential, shared ACME account material, Tradebot/Eternal data or host-wide archive goes there. Configuration may contain production secrets **inside age encryption only**. Before the first upload, announce the actual verified private target, asset names, encrypted sizes/hash and content categories; obtain notification approval if Release creation/publishing can notify watchers. [Release API notes](https://docs.github.com/en/rest/releases/releases#create-a-release)

Local-only `scripts/vps/prepare-recovery.sh --inventory` passed against the actual scoped files. `--encrypt-local` requires the offline-owned public `AGE_RECIPIENT` and streams DB dump and config tar directly into age, with no persisted plaintext. It does not create a provider target, upload, prune or ping. `--measure` streamed and discarded the actual plaintext streams: DB custom dump **32181 B**, configuration tar **133120 B** at measurement time, without saving either plaintext stream. These are pre-encryption measurements, not uploaded asset sizes. No encryption occurred because the production recipient is still absent; no production private key was generated. Scope excludes shared host resources. Certificates/shared tool packages are reissued/reinstalled from documented prerequisites rather than copied indiscriminately. Keep the actual `certbot` renewal executable dependency available during recovery.

If GitHub is accepted, automation would use VPS cron and a repo-scoped contents-write token for Release create/upload/readback, then retention limited to the dedicated tags/assets: **7 daily / 4 weekly / 2 monthly**. Avoid reusing the broad operator token for unattended jobs. Validate private visibility on every upload; verify downloaded ciphertext hash, cap objects below documented file limits, record backup completion only after remote readback, and delete only named owned expired objects after the new upload passes. Release/tag retention and upload backend are **not implemented or scheduled** before that decision. A private recovery repo needs a seed commit for Release tags; no account or payment method is introduced. Backup cron does not require private Actions minutes. Account recovery/2FA and credentials must be preserved offline too.

Manual DB restore after a real upload: owner downloads ciphertext from the private Release on the offline-key device, checks SHA256SUMS, then streams `age -d -i OFFLINE_KEY database.dump.age | ssh VPS 'cd /opt/originmetric && bash scripts/vps/restore-check.sh'`. Existing restore tool uses network-none/tmpfs PostgreSQL, checks ten tables and migration metadata, and never restores production. Configuration is decrypted on the owner's device into an isolated directory, members validated and required files checked; never overwrite the live host with an unchecked tar. Private key is never stored on VPS/GitHub. This operation has not been performed; CI synthetic restore does not count.

**Canonical gap:** §24 requires rclone/object storage and bucket lifecycle backstop, plus a separate owner-encrypted secret backup outside the DB backup bucket. GitHub Releases has no equivalent bucket lifecycle/dead-man guarantee; storing encrypted configuration secrets there also changes the separate-storage policy. No exception is inferred from the request to evaluate GitHub. `deploy.sh` still fails closed via the canonical off-VPS backup prerequisite; it was not bypassed or silently retargeted. GitHub can become a functional alternative only after the owner explicitly accepts/records these differences and real upload/manual restore evidence exists.

## Dashboard and independent observations

Current management UI is the token-protected internal attribution proof, not an account/product dashboard. Added a read-only link to `/internal/operations`, using the existing internal bearer check and public nginx block; no P3 auth/accounts. Optional `deploy/compose.operations.yml` mounts **only** the owned redacted summary directory read-only. `common.sh` accepts that overlay only for `/opt/originmetric/.runtime/operations`. It is not active in production.

`collect-operations.mjs` reads health/tracker/metrics inside the production app and disk usage, produces a bounded status/history file without secrets, IDs, raw logs or outbound notifications. The actual local sample reports health/tracker/selfcheck PASS, backup/restore UNKNOWN; independent uptime is UNKNOWN. Zero counters are omitted by the existing metrics API and treated as zero, matching selfcheck behavior. An initial development sample incorrectly treated omitted counters as failure; it was corrected and that invalid sample removed only from the newly created derived summary. Shared logs were untouched. History is observations, not proof of notifications or completed backup jobs. No monitoring cron was installed.

The view validates a strict status schema, rejects extra credential fields/malformed data and shows missing/future/stale data as unavailable/stale. Health/tracker/selfcheck expire after 15 minutes; backup after 25 hours; manual restore is shown as dated evidence without pretending a recurring restore job exists. Snapshot unit checks passed. A VPS dashboard is unavailable during VPS/network failure, so it is **not independent uptime**. Merely viewing the dashboard does not supply canonical delivery/dead-man evidence.

`deploy/github/uptime.yml` is an **inactive reviewed template**, outside `.github/workflows`. A standard GitHub-hosted runner can independently GET only public health/tracker, without SSH or admin/ingestion token. It has no event POST, issue creation or webhook. Default proposed mode is explicit manual dispatch; no schedule activated and no external checks dispatched. Results would live in GitHub run history during VPS outage. An eventual bounded authenticated server-side read/pull can mirror those results to the existing operations view; that adapter has not been activated or claimed as working.

GitHub schedule semantics: minimum five minutes, default branch only; queue delay/dropped jobs possible, public schedules disabled after 60 inactive days. Therefore it cannot be represented as guaranteed five-minute availability or an independent dead-man check for its own missing runs. [Scheduling docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) Public standard-hosted runners are free; private scheduled checks may consume the owner's quota. [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) A 5-minute private schedule can exceed a small monthly minute allowance; plan/current usage and hard no-spend settings must be verified before enabling it.

**Canonical gap:** dashboard-only alerts and best-effort GitHub run history do not equal §24/25 Healthchecks start/success/fail/missing pings and email delivery. The owner asked for dashboard display; this is prepared without claiming that independent detection or delivery is complete. An explicit alternative acceptance is needed; a third-party account or paid service is not started. Existing external probe evidence remains one-time evidence.

## Historical owner-action list — superseded by the 2026-10-03 current update

1. The owner now **reports** phone-Debian key creation, KeePassDX storage and a paper copy; this is not independently verified. Public `AGE_RECIPIENT` is populated and a separate local env ciphertext is ready. Follow the [phone verification and separate vault-storage steps](#age-recipient-and-separate-env-recovery-preparation--2026-10-03); off-phone vault backup, phone-independent access and decryption/restore remain open. Share only results, never secrets.
2. Decide whether to accept GitHub private Releases + dashboard/Actions as a **documented alternative to the canonical storage/lifecycle/Healthchecks/email requirements**, including their stated gaps; confirm the dedicated private repo name. Until then, no target creation/upload/retention or deploy-prerequisite bypass.
3. Before any first Release upload or independent workflow activation, review the actual target/content or the HTTPS-check operation and possible GitHub notification destination/settings. Give explicit notification approval if applicable; account quota/no-spend settings must be verified for any private runner.
4. **2026-10-03 update:** the requested Cloudflare panel details have been supplied as transferred evidence and recorded below; direct account/original-export review is unverified. Confirm the actual originmetric.app banner after deployment prerequisites and separately authorize any data-gate-dependent attribution test; this documentation instruction does not open it.

## Read-only continuation — 2026-10-02, 19:14–19:15 UTC

Prepared code and production settings were preserved. Current shell environment contains no Cloudflare access key names; `/etc/originmetric/secrets/cloudflare-read.curl` and standard root Wrangler config paths are absent; no callable Cloudflare connector is available. Scoped provider filenames found under `/etc/originmetric` are public CIDR lists only. No account API request was made without credentials. Saved SSL mode, rule inventory/order, exact counting period and Worker overrides were **not independently inspected**. Previously supplied Full (strict), Pseudo IPv4 Off and visitor-IP-removal Off panel evidence remains owner-supplied evidence; no repeat setting change is requested.

Fresh public GET-only probes from this VPS passed via Cloudflare in both IP families: root/health/tracker 200, events 202/drop, identify/revenue 503, metrics/operations/fixture 404. All sampled API/internal/fixture responses were `no-store` + `DYNAMIC`; tracker was `no-store` + `BYPASS`. This is sampled behavior, not proof of saved cache-rule ordering. www returned 308 retaining path/query. Public A/AAAA resolved to Cloudflare ranges and NS to Cloudflare nameservers; this cannot enumerate saved DNS records or prove their exact origin target. TLS verification used curl's normal certificate checks, without `-k`; successful edge TLS does not prove saved Full (strict).

The [official IPv4](https://www.cloudflare.com/ips-v4) and [IPv6](https://www.cloudflare.com/ips-v6) lists were freshly read: **15/7 ranges**, matching saved firewall files, active `OM_CF_WEB4/6` source sets and the committed/installed nginx trust config. Initial Python urllib retrieval received 403; curl retry succeeded. `nginx -t` passed; nginx/firewall units were active and both firewall units enabled. These local chain checks do not replace the earlier independent external port evidence or establish a production reboot test. Deployed tag remains `b750a1b5262eb83d04810afc2c71c35678ecfbcc`; five production fact counts are zero.

Recovery `--inventory` passed for all existing scoped members. Refreshed only the owned local operations summary/history: health/tracker/selfcheck PASS, **backup/restore/independent uptime UNKNOWN**. No upload, encryption, key generation, scheduler, remote workflow dispatch or notification occurred. Public probes are one-time VPS-origin observations, not independent recurring uptime. Sanitized check details are in ignored mode-600 `.runtime/p2-readonly-followup-20261002.json`; local summary is `.runtime/operations/snapshot.json`.

### Cloudflare: tek eksik panel listesi

**Historical request, superseded 2026-10-03:** the four requested inventory/detail groups (rate limiting, Custom Rules, Cache/Page Rules, Workers Routes) are now supplied at the user-panel evidence level, with additional Origin/transform inventories. The source distinction and remaining independent-review limits are recorded in the new section below; do not request the same missing panels again as if they were not supplied.

## Cloudflare transferred evidence — 2026-10-03

Zone `originmetric.app`; reported panel review **3 October 2026, approximately 00:13–01:17 Europe/Istanbul** (2 October 21:13–22:17 UTC). Source: **user-provided panel screenshots, rule URLs, the fully copied expression and ChatGPT-reviewed Security Events JSON summary**, transferred here as text. This agent did not directly inspect the Cloudflare panel/API, screenshots or original JSON; those originals are not assumed present on the VPS. Literal rule URLs are absent from the transferred text, so no account links are invented. The user reports no setting change during inspection; this task changes documentation only.

| Cloudflare evidence | Transferred result | Source / remaining limit |
|---|---|---|
| Rate limiting | One Active rule, position 1 / First; **OriginMetric ingestion IP limit**, ID `c39d94f4c043491a9e62464c46f1b949`; `(http.request.uri.path eq "/api/v1/e")`; IP; **60 requests / 10 seconds**; **Block**, mitigation **10 seconds** | User panel evidence supplies saved count/order/window/settings. Earlier VPS edge behavior is separate; no direct ruleset review. |
| Custom / Managed list | Custom Rules **0/5**, empty; **“No Managed rules created”** | User panel evidence. Do not infer managed protection is inactive: transferred export reports 11 `firewallManaged` blocks. |
| Cache | One Active rule, position 1 / First; **OriginMetric API cache bypass**, ID `2de21241ca0a4635b1f1b39f2ac405f2`; **Bypass cache**; no extra Browser TTL setting visible | User panel and exact copied expression below; no hidden/default TTL or static-cache policy inferred. |
| Other rule inventories | Cache Response Rules empty; Page Rules empty **0/3**; Workers Routes empty in **Show all**; Origin Rules empty; Request and Response Header Transform Rules empty | User panel evidence closes requested visible override inventories, not independent account/Worker code review. |
| IP / TLS | Pseudo IPv4 **Off**; Remove visitor IP headers **Off**; Overview **Current encryption mode: Full (strict)**; separate screen **Full (Strict)** selected | User panel evidence. Earlier client-IP/TLS behavior remains separately dated; successful HTTPS alone cannot prove saved mode. |
| Security Events | Reported `firewall-events-2026-10-01T22_06_37Z-2026-10-02T22_06_37Z.json`: **22 block events**, `ratelimit` **10**, `firewallManaged` **11**, `bic` **1** | Transferred **ChatGPT JSON review summary**; original-file integrity/completeness and direct API review unverified. No HTTP status supplied. |
| VPS behavior test | Prior 60×202/drop then request 61→429/1015; +9 blocked / +11 recovered; two supplied Ray examples found in existing VPS result files | Existing behavior-test records, separately read for correlation in this task; not a new request burst or original Security Events parsing. |

Exact expression copied by the user:

```text
starts_with(http.request.uri.path, "/api/") or
http.request.uri.path eq "/api" or
starts_with(http.request.uri.path, "/internal") or
starts_with(http.request.uri.path, "/fixtures")
```

The ten `ratelimit` events reportedly share Host `originmetric.app`, Method `POST`, Path `/api/v1/e`, Source `ratelimit`, Action `block`, Description `OriginMetric ingestion IP limit`, Rule ID `c39d94f4c043491a9e62464c46f1b949`, Ruleset ID `5d1f78f7f5784fd2a909593eff6f6430`. First **2026-10-02T01:24:40Z**, last **2026-10-02T01:26:39Z**; sample Rays `a43fe8a8def52608` and `a43feb919afa1dc1`. Raw client IPs are omitted. Summary supports named-rule blocks, **not HTTP 429/1015 on its own**.

Both example Ray bases match ignored existing VPS behavior files: `a43fe8a8def52608-FRA` is mixed-colo burst request 76, status 429, `error1015=false`, without a stored request-level timestamp; `a43feb919afa1dc1-FRA` is the +9.008 s recovery probe at **2026-10-02T01:26:39.609984Z–01:26:39.618137Z**, status 429, `body_1015=true`, zero observed CF→origin/private upstream payload packets. The second timestamp falls in the reported last-event second. These correlations associate behavior with the supplied rule **through the transferred summary**; no exact original-event reconstruction or unmatched request-61 export match is claimed. See the [installation report's full correlation and canonical assessment](P2_VPS_INSTALLATION_REPORT.md#cloudflare-transferred-evidence-and-acceptance--2026-10-03).

**Canonical assessment (§§6,20,23,28):** the single ingestion rule and saved threshold/window/order, Full (strict), IP toggles and requested conflicting-rule inventories are now supported **at the user-supplied panel evidence level**. Blocking/recovery remains independently supported by earlier VPS tests; the transferred JSON adds Rule ID support. Direct saved-ruleset inspection and original export validation remain **unverified**. API cache bypass does not prove a `/js/*` cache rule; historical HIT/BYPASS samples alone do not establish saved static-cache configuration.

**Still OPEN (§§24–25/28):** real off-VPS upload/readback/download/manual restore; scheduled backup/retention/lifecycle; independent recurring uptime/dead-man/email delivery; explicit GitHub alternative/target decision; actual originmetric.app banner/required-consent/withdrawal/GPC and persisted trusted attribution/duplicate/refund tests; private age key in **password manager + paper**, separate encrypted `.env` outside the DB backup bucket and phone-independent recovery confirmation. None is inferred from Cloudflare panels or JSON. **G1 pending; P2 open; P3 not started.** `PUBLIC_G1_READY=no` and nginx 202/drop, 503 and 404 data gates remain unchanged. No key/password generation or change.

### Key preservation and phone-loss recovery remain open

**Historical state from the earlier Cloudflare documentation task:** the new [age preparation section](#age-recipient-and-separate-env-recovery-preparation--2026-10-03) supersedes the missing recipient/owner declaration below. Phone-independent recovery, separate vault transfer and restore remain open.

Canonical §24 explicitly requires the private age key **offline, password manager + paper**, and `.env` separately encrypted in the owner's password manager **outside the DB backup bucket**. Owner confirmation and a real restore are still missing. Public `AGE_RECIPIENT`, `BACKUP_REMOTE` and both check URLs remain empty. No private key availability on the owner's devices is inferred from this server audit.

The [phone-loss recovery instructions](../runbooks/VPS_INSTALLATION.md#telefon-kaybında-mevcut-anahtarla-kurtarma) explain using the existing key from the vault or its complete paper copy, existing phone-independent vault/account/2FA recovery information, then downloading/decrypting a real remote object and performing an isolated manual restore. No key/password was created or changed. A phone-only vault/2FA path is insufficient; public recipient cannot decrypt. Owner confirmation should disclose only that copies and phone-independent access exist, never their contents. GitHub ciphertext configuration does not silently satisfy the separate-secret-storage condition.

Documentation verification: `git diff --check` and local file-link target validation passed; gitleaks v8.30.1 scanned the current docs read-only with redaction and no network, **no leaks found**. Production env/nginx/private include hashes remained unchanged after edits; canonical plan and DECISIONS are unchanged. No application code changed, so the earlier CI #68 result remains historical code evidence, not a newly run test suite.

**Historical 2026-10-02 checks completed independently:** accessible public/host read-only checks, scoped recovery inventory and fresh local observation/history, documented phone-loss procedure and updated handoff. **Open after the 2026-10-03 update:** direct Cloudflare/original-export verification (requested panel inventory/counting details now supplied); offline key preservation and separate `.env` recovery; GitHub canonical-alternative decision/private target; real upload/download/manual restore; independent scheduled monitoring/dead-man/email; actual-domain consent and persisted attribution. **Owner steps:** confirm existing phone-independent recovery without secrets, decide the already documented GitHub deviations/target, and subsequently review actual upload/check destinations and real-site steps. Until prerequisites are met, no deploy-prerequisite bypass or traffic opening. **G1 pending; P2 open; P3 not started.**


## Code verification / handoff

Code head `fea039e51dd8eb43804b33cd281ead6353d7dc70` passed [CI #68](https://github.com/brsctncnbrk5/originmetric/actions/runs/37039757133): full-history secrets, lint/format/types, unit/real-DB/migrations, tracker budget/build, browser (including the three new checks), demo, Docker package and synthetic encrypted restore. The duplicate push workflow was cancelled by concurrency, not failed. Local/remote code SHA matched and production's five fact counts remained zero. The subsequent documentation commit records this result; no live app deployment or phase acceptance follows from it.


## Documentation verification — 2026-10-03

`git diff --check`, local file-link/new-anchor and fenced-block checks, exact-expression comparison and `npm run format:check` passed. Markdown is intentionally excluded from Prettier by the existing `.prettierignore`; its links, fences and whitespace were checked separately. Existing **gitleaks v8.30.1**, with redaction, scanned current docs and full Git history: **no leaks found**. Only `docs/STATUS.md` and the two P2 reports changed. Canonical plan, DECISIONS, production env, installed OriginMetric nginx and private proxy include hashes matched the pre-edit baseline. No application tests or live requests were rerun for this documentation-only change; CI #68 remains historical code verification, not a new acceptance result. A new commit is made on the assigned P2 branch without amend/history rewriting; actual commit/push and remote SHA verification are reported at handoff.

## Age preparation documentation verification — 2026-10-03

`git diff --check`, local Markdown file-target/new-anchor and balanced-fence checks, and `npm run format:check` passed. Markdown remains excluded by the existing Prettier configuration; links/fences/whitespace were checked separately. Existing Docker image **gitleaks v8.30.1**, read-only mounts, `--redact` and `--network none`, scanned current docs and Git history: **no leaks found**. Only STATUS and the two current P2 reports are task commit files; encrypted recovery artifacts remain ignored/local. The permitted env change was verified to affect only `AGE_RECIPIENT`; root ownership/mode 600 and unchanged application runtime/protected files were checked. No application suite was rerun for this scoped config/documentation preparation; earlier CI results remain historical, not decryption/restore or phase acceptance. Commit/push and remote SHA comparison are reported at handoff.


## Independent preparation verification — 2026-10-03

Local shell syntax, three backup-readback scenarios (valid, equal-size corruption, failed read), seven public-observer tests, existing deploy-control proof, lint, format and typecheck passed. These are isolated preparation tests, not real remote backup/restore or independent uptime. New tests are wired into existing CI; the push-triggered full suite is not represented as already passed.

GET-only live checks: health/tracker 200, events 202/drop, identify/revenue 503, operations/metrics/fixture 404. A read-only transaction returned zero for all five production fact counts. `PUBLIC_G1_READY=no`; backup/check URLs remain unset. Canonical plan, DECISIONS, production env and installed ingress hashes, plus running container identities, match the private baseline. No production restart/deploy or data writes occurred. Markdown links/fences/whitespace and redacted task-file/full-history secret scans are checked before commit. Only task scripts/template/CI/docs are included; ciphertexts and private baselines remain ignored.


## Historical commit / remote-access blocker — 2026-10-03

Preparation commit `c84d67aa1b99de3a20f91ae3f35e7b7562306064` was created on the assigned branch. Push to `origin/codex/originmetric-p2-vps-preparation` returned **403: permission denied to `brsctncnbrk3-hub`**. `gh auth status` lists only that account; no authorized alternate account is available in that configuration. No other project's credentials were reused, no force push/history rewrite attempted. Remote branch still reads `e6853ba54275e97302819f6b22acbf7a7278603e`; it does **not** match the new local work. The final local documentation commit records this blocker; publication is incomplete.

Immediate owner step: make the OriginMetric-authorized GitHub account available through the local secure GitHub login/credential mechanism (never post a token/key in chat). Then push the assigned branch and compare full local/remote SHAs. After access is restored, the next P2 decision remains the documented GitHub storage/lifecycle/monitoring alternative and exact notification target/operation. Off-phone preservation stays DEFERRED; no gate is opened.


## ZIP readback / proposal documentation verification — 2026-10-03

Actual remote download/reference hash comparison, ZIP CRC/exact four members and three inner manifest checks passed. New private readback directory/files are root-owned 700/600 and Git-ignored. `git diff --check`, Markdown local targets/new anchors/balanced fences and `npm run format:check` passed; Markdown remains excluded from Prettier, so its structural checks were separate. Existing gitleaks v8.30.1 with redaction/read-only mounts/network-none scanned changed docs and full Git history: no leaks found. Only STATUS and the two P2 reports changed. Canonical plan/DECISIONS/production env hashes and running container identities match the private baseline. No application suite or live uptime observer was rerun for this documentation/readback task; previous CI results remain historical. Commit/push uses only project GH_CONFIG_DIR on the assigned branch, followed by full remote SHA and clean-tree verification at handoff.


## D-008 verification / handoff — 2026-10-03

Final local checks PASS: 14 GitHub backup/policy/failure/lock/credential tests, 7 observer tests, existing rclone corruption/read-failure proof and deploy-control proof, shell syntax, systemd service/timer syntax and explicit UTC calendar, lint/format/typecheck, Markdown targets/new anchors/fences, `git diff --check`. Existing gitleaks v8.30.1 redacted/read-only/network-none scanned task files, full OriginMetric history and isolated public monitoring history: no leaks found. Public three-file source mirror equals the pushed monitoring repo. No full DB/browser/application rebuild suite was rerun; no new G1 acceptance or real restore is inferred.

Protected canonical plan/production env/installed nginx hashes and production container IDs/start/restart counts match the private baseline. Existing phone Release/ZIP ID, size and API digest remain unchanged. Exact initial remote snapshot/readback evidence is saved privately at `.runtime/github-db/last-backup.json`; no ciphertext/credential/baseline enters Git. Separate monitoring `main` is clean with local/remote SHA `0a63e43c9494ae0e75de657473f59469b4b9deba`; workflow active, initial manual run success; no scheduled-run success is asserted in this handoff. At that initial handoff the backup timer remained inactive/disabled with no next elapse, pending the explicit scoped credential procedure; the activation evidence below supersedes this historical blocker. Final task commit/push on the assigned OriginMetric branch and full SHA comparison are reported at handoff; prior commits are preserved.


## Scoped backup identity and daily timer activation — 2026-10-03

Following the owner's secure SSH setup completion, independently verified the credential file metadata without displaying its contents: `/opt/originmetric/.runtime/github-auth/backup-token` is a regular root:root file, mode **600**; `.runtime` and `.runtime/github-auth` are real root:root directories, mode **700**. `git check-ignore` confirms the token path is ignored; `git ls-files` confirms it is untracked. No token was requested in chat or placed in arguments, output, documentation or Git.

`python3 scripts/vps/github-backup.py --check-credential` **PASS**, using the scoped credential rather than `--operator-once`: API account `brsctncnbrk5`, authorized active **private** `brsctncnbrk5/originmetric-recovery`. The API check does not introspect the token's full selected-repository scope; the owner's fine-grained setup declaration remains the scope source. Installed service uses `LoadCredential=backup-token:/opt/originmetric/.runtime/github-auth/backup-token`; the script supplies the token only to child `gh` environments and suppresses API error bodies/stderr.

Ran the installed `originmetric-github-backup.service` once before timer activation. Consistent DB dump → age encryption → private draft Release upload → remote ciphertext and manifest download/SHA-256/size comparisons → verified metadata → owned retention completed successfully. The job exited successfully and its fresh root-owned mode-600 `.runtime/github-db/last-backup.json` records:

| Evidence | Result |
|---|---|
| Snapshot | `om-db-v1-20261003T130037Z-eeab03ba` |
| Captured | `2026-10-03 13:00:37 UTC` |
| Remote verified | `2026-10-03 13:00:45.757787 UTC` |
| Private Release ID | `402515437` |
| Ciphertext bytes | `32381` |
| Ciphertext SHA-256 | `278b0ca3ff038e2e5a07256b0e135e428a988894cec33b47f93123a57d876592` |
| Job result | `BACKUP_CREATED_REMOTE_READBACK_VERIFIED` |
| Owned retention | One eligible prior snapshot pruned after verification |
| Manual restore | `restore_verified=false`; **UNVERIFIED** |

Only after the successful fresh remote readback, ran `systemctl enable --now originmetric-github-backup.timer`. At **2026-10-03 13:01:21 UTC**, systemd reported **enabled / active / waiting**, `OnCalendar=*-*-* 03:15:00 UTC`, next elapse **2026-10-04 03:15:00 UTC** (Türkiye **06:15**). Installed timer has `Persistent=true` and `RandomizedDelaySec=0`. This proves timer activation and the next planned execution, not a completed scheduled run.

This resolves the scoped unattended-identity and backup-timer blocker. Actual decryption/manual isolated restore, provider lifecycle backstop, email/dead-man delivery, off-phone recovery (DEFERRED), real-domain consent/attribution acceptance and G1/P2 acceptance remain separate open items. No application deployment or gate opening was part of this task. Credential and runtime evidence stay outside Git; only sanitized STATUS/report changes are task commit files.

Documentation verification: `git diff --check`, balanced Markdown fences and the new STATUS link target/anchor passed. Existing gitleaks v8.30.1 scanned current docs with `--redact`, read-only mount and `--network none`: **no leaks found**. No application code changed; the real scoped-credential service run and remote readback are the operational validation for this task.


## Real restore audit — 2026-10-03

**Result: BACKUP/REMOTE READBACK PASS; REAL RESTORE BLOCKED, NOT VERIFIED.** This task inspected the authorized GitHub backup and existing timer only; no new backup/upload/retention operation, deployment, monitoring notification, production SQL or traffic-gate change was performed. Canonical §§24–25/28 and D-008 remain the acceptance boundary; P2 is open and P3 was not started.

### Last backup and preserved timer

The installed service journal records start **2026-10-03 13:00:36 UTC**, successful completion **13:00:49 UTC**, with the same snapshot/readback result as root-only `.runtime/github-db/last-backup.json`. Current service status: `Result=success`, `ExecMainStatus=0`, inactive after the successful oneshot. No later backup or failure is inferred from these records.

| Check | Independently observed result |
|---|---|
| Snapshot / private draft Release | `om-db-v1-20261003T130037Z-eeab03ba` / ID `402515437`; exact ownership marker, verified state and two DB-only asset names checked via scoped-credential GETs |
| Captured / original remote verification | **13:00:37 UTC** / **13:00:45.757787 UTC** |
| Fresh remote download | **13:09:36.719215 UTC**; `database.dump.age` **32381 B** |
| Ciphertext SHA-256 | `278b0ca3ff038e2e5a07256b0e135e428a988894cec33b47f93123a57d876592`; fresh downloaded bytes equal local success record and remote verified body |
| Manifest / format | Exact `SHA256SUMS` entry matches downloaded ciphertext; age format header valid. Neither proves decryption. |
| Timer state | **enabled / active / waiting**; installed `OnCalendar=*-*-* 03:15:00 UTC`, `Persistent=true`, `RandomizedDelaySec=0` |
| Next / previous scheduled execution | **2026-10-04 03:15:00 UTC** / `LastTriggerUSec` empty, list-timers LAST `-`; no completed scheduled run claimed |

The timer and service were read only; no enable/disable/restart/reload or schedule edit occurred. Repository visibility was checked again after downloading. No remote Release or asset was modified/deleted.

### Private-key availability and blocked checks

Only safe results were emitted: existing-file checks, owner/mode where applicable and private identity marker presence, never key/token/env values. Inspected OriginMetric-owned `/opt/originmetric` and `/etc/originmetric`, conventional `/root/.config/age` and `/root/.age`; excluded Git history, dependencies/build caches and other projects. **362 regular files** were examined privately for standalone native/plugin age identity markers; **zero identity candidates**. Standard key paths under those roots plus `/root/.config/sops/age/keys.txt` and `/etc/age/keys.txt` are absent. The current process has no conventional identity reference. This is a scoped availability check, not a claim that every unrelated host file was searched. The existing public recipient is insufficient for decryption; no usable OriginMetric private identity was discovered.

This agrees with the documented offline-key model. No private key was generated, transferred or requested; no decryption was attempted without one. An empty/synthetic restore would not test this actual backup, so no disposable PostgreSQL container/network/volume was created merely to claim progress.

| Required real-restore validation | Status |
|---|---|
| Successful decryption and actual `pg_restore` | **BLOCKED / NOT RUN** |
| Schema and 10 domain tables | **NOT CHECKED** |
| Migration history against deployed schema | **NOT CHECKED** |
| Core table counts | **NOT CHECKED**; no production counts queried in this task |
| Foreign keys / tenant relationships / orphan checks | **NOT CHECKED** |
| Restore result | **`restore_verified=false`**, unchanged in existing backup evidence |

### Minimum owner step: use the existing offline key

On the trusted device already holding the existing private key, download **`database.dump.age` and `SHA256SUMS` from Release ID `402515437`** in the private [recovery Releases dashboard](https://github.com/brsctncnbrk5/originmetric-recovery/releases). Select the exact snapshot name above; draft `untagged-*` URLs can change. In the download directory, confirm the hash above and then run the existing offline streaming procedure:

```bash
# On the trusted offline-key device; replace the key path and SSH host locally.
# No private key or plaintext dump file is uploaded to the VPS.
sha256sum -c SHA256SUMS
# Continue only if this exact snapshot's ciphertext hash check succeeds.
set -o pipefail
age -d -i /local/path/existing-age-key.txt database.dump.age | \
  ssh VPS_HOST 'cd /opt/originmetric && bash scripts/vps/restore-check.sh'
OM_RESTORE_STATUS=("${PIPESTATUS[@]}")
printf 'decrypt_exit=%s isolated_restore_exit=%s\n' "${OM_RESTORE_STATUS[0]}" "${OM_RESTORE_STATUS[1]}"
```

Keep the key/token/password/env contents local. Provide only both exit codes and sanitized table-count/restore output. Both exits must be zero, and the real schema/migration/constraint/count results must be recorded before acceptance; the existing helper's table-presence/migration-count summary alone does not establish migration-hash equality or every required integrity check. If the private-key device cannot run this pipeline, the remaining prerequisite is a secure decrypted stdin stream from that device, not putting the key on this VPS. The helper creates only a `--network none`, tmpfs disposable PostgreSQL 18 container and removes it on exit. Detailed migration and relationship verification still needs to be completed in that isolated test before declaring success; no production restore is authorized.

### Cleanup, protected resources and next canonical work

Fresh ciphertext/manifest downloads were held in a mode-700 temporary directory beneath ignored `.runtime` and removed on exit; removal verified. **No temporary PostgreSQL resources exist from this task.** Only sanitized private audit evidence remains at `.runtime/restore-audit-20261003.json` (root-owned mode 600, ignored/untracked). Pre/post hashes and container metadata confirm the canonical plan, DECISIONS, production env, installed OriginMetric ingress and backup units are unchanged, and production container IDs/start times/restart counts/mounts are unchanged. No production database query, volume write/mount, app command or restart was issued.

The immediate canonical P2 task is the **real isolated manual restore** of this exact remote DB backup, followed by the still-open actual-domain required-consent/withdrawal/GPC and persisted trusted-attribution/duplicate/refund evidence and G1 review. Off-phone vault recovery remains **DEFERRED**; provider lifecycle backstop, dead-man/missing-run and email delivery remain open. No new general authorization or scoped-token setup is needed. Preserve daily **03:15 UTC**; stop before P3.

Documentation validation: changed Markdown whitespace, balanced fences and local file/anchor links checked; existing gitleaks v8.30.1 with redaction/read-only mounts/network-none scanned the current docs (including both changed files) and full Git history: **no leaks found**. Only STATUS and this report are committed on `codex/originmetric-p2-vps-preparation`; normal push and full local/remote SHA equality are checked at handoff. No application code changed or application test suite was rerun; previous CI evidence is historical, and these checks do not resolve the restore blocker.


## Phone prerequisites and existing-key decision — 2026-10-03

**Owner-reported phone checks:** existing private age identity at `/root/.config/originmetric/identity.age`, owner root / mode 600; age 1.1.1; 341 GB free; authenticated VPS connection returned `SSH_PRECHECK_OK`. The earlier successful recipient-check decryption is also owner-reported. These resolve the phone prerequisites only; the actual DB backup decryption, isolated restore, schema/migration/count/relational-integrity validation are still **NOT VERIFIED**.

**Explicit owner decision:** the owner reports the existing private age key was exposed in a screenshot and that the exposure risk has been communicated. The latest instruction supersedes the initially proposed rotation workflow: **do not rotate the age key; retain the existing offline key for old backups and continue using its current public recipient for new backups.** No key value was requested, received or recorded here. No private key is copied to VPS/GitHub, and no recipient/env/production change is authorized by this continuation. Retaining the current key does not undo the reported exposure; no confidentiality recovery is claimed.

The next step remains downloading the exact verified GitHub DB ciphertext and manifest into a fresh phone directory, checking SHA-256, then streaming phone-side decryption over SSH into an isolated PostgreSQL test. SSH transfer staging contains only those two encrypted-backup files; existing source files are not overwritten. Preserve **03:15 UTC** scheduling and keep **P2 OPEN / P3 NOT STARTED** until actual restore and the other acceptance criteria are fulfilled.


Phone transfer preparation at **14:19:59 UTC**: exact private GitHub Release `402515437` freshly downloaded by scoped authenticated GET, draft/ownership/private checks and both file comparisons succeeded. Ciphertext remains **32381 B**, SHA-256 **`278b0ca3ff038e2e5a07256b0e135e428a988894cec33b47f93123a57d876592`**; exact manifest matches. An initial `gh api user` read timed out; a bounded IPv4 curl read succeeded without changing host/network/GitHub configuration. Authentication was passed only as an in-memory stdin config, never arguments/output/files. The new root-only transfer directory is `/opt/originmetric/.runtime/phone-pigpm9sw`, containing only `database.dump.age` and `SHA256SUMS`; both mode 600, directory 700, Git-ignored. It remains temporarily for the phone download and must be cleaned after transfer/test. Sanitized ignored evidence: `.runtime/phone-transfer-phone-pigpm9sw.json`. **Phone download/hash verification and actual restore are still pending**; no private key/plaintext dump or PostgreSQL test resource was created.


## Phone hash confirmed and isolated receiver prepared — 2026-10-03

Owner reports phone download completed, `SHA256SUMS` OK and ciphertext hash exactly matching **`278b0ca3ff038e2e5a07256b0e135e428a988894cec33b47f93123a57d876592`**. This is owner-reported phone verification, distinct from the independently checked remote bytes. Existing-key/no-rotation decision remains in force; no private key value was requested, transferred or recorded.

Prepared new `scripts/vps/restore-phone.py` without replacing the existing restore helper. It receives custom-format plaintext only on stdin and sends it directly to `pg_restore`; it does not load production env or connect/query production PostgreSQL. pg_restore/psql diagnostic bodies are captured only in memory and suppressed, never logged. The single test container uses `--network none`, no published ports/production mounts, PostgreSQL data and `/tmp` in tmpfs, Docker logs disabled, PostgreSQL statement/error-statement logging disabled, 512 MiB memory / 1 CPU limits. Cleanup removes only its unique test container.

The receiver builds a second, empty reference database **inside the same isolated container**, using the tested snapshot's source commit `31a370387b9e8a6a61d92d2d156918bbb0451cc2`. Real-stream validation compares all four migration hashes/timestamps, the exact ten-table inventory, columns/defaults/nullability, constraints, indexes, functions and triggers against that reference. It counts all ten domain tables and explicitly checks all 14 foreign keys (including composite project-scoped relationships and nullable session/refund pointers) for orphan rows. Only aggregate counts and status are printed; no customer/key/event rows. Container ID/start/restart/mount metadata and protected config hashes are checked before/after. New result evidence is exclusively created in a fresh root-only ignored `.runtime/restore-phone-*` directory.

**Preparation checks only:** synthetic reference dump restored through the real tool path; four migrations, ten tables, schema equality, 14 FK orphan queries, cleanup and unchanged production metadata checked. Invalid-archive control must return nonzero and suppress diagnostic data; no false success/row counts are emitted. These are receiver tests, **not the actual GitHub backup's restore proof**. Every receiver result keeps `restore_verified=false` until the actual phone decryption exit is confirmed together with server checks and cleanup. The final real-stream summary is `ISOLATED_DB_CHECKS_COMPLETE_PHONE_EXIT_PENDING`, not unconditional PASS. Capture both phone pipeline exits immediately; both must be zero before marking the actual restore verified.

**Current:** actual phone decryption/SSH restore is pending; all real-backup schema/migration/count/integrity results are pending. No plaintext dump file or key is written on VPS/phone by this workflow; ciphertext staging is retained until the test completes. Existing daily **03:15 UTC** timer remains unchanged. **P2 OPEN; P3 NOT STARTED.**


## Real phone attempt failed before restore; SSH working-directory fix — 2026-10-03

Owner-reported actual pipeline: **`decrypt_exit=0`, `restore_exit=1`**. Independently inspected the latest real-stream evidence `.runtime/restore-phone-gcu2eizp/result.json`: start **14:38:47.343550 UTC**, finish **14:38:47.589598 UTC**, `RESTORE_CHECK_INCOMPLETE`; snapshot/pg_restore/migration/schema results are absent, `database_checks_verified=false`, `restore_verified=false`. Protected production metadata/configs unchanged and no isolated container remains. Existing evidence was preserved; no dump or diagnostic row contents were printed.

**Cause reproduced:** SSH starts the receiver in `/root`; its `git show` subprocess inherited that directory. The exact snapshot migration-journal lookup returned **128 / outside Git repository** from `/root`, and **0** from `/opt/originmetric`. The failing call precedes snapshot metadata registration, temporary PostgreSQL creation and stdin consumption. The phone decryption exit alone does not prove restore; this attempt did not reach PostgreSQL.

**Correction:** receiver subprocesses now explicitly use `cwd=ROOT`, independent of the SSH caller directory. Safe evidence also records the validation phase, tool name and numeric exit code; raw stderr/SQL diagnostic bodies remain memory-only and suppressed. No production env, DB, volume, app, key/recipient or timer change.

**Regression checks:** invoked the corrected synthetic receiver with actual caller directory `/root`: all 4 migration hashes/timestamps, exact 10-table schema, table counts and 14 FK orphan queries completed; owned container removed and protected metadata unchanged. Separately, invalid synthetic archive from `/root` must reach `pg_restore_stream` then exit 1, retain `restore_verified=false`, suppress diagnostic bodies and clean its container. These are correction checks only; **the real GitHub backup still needs another phone stream**. Existing-key/no-rotation decision and daily **03:15 UTC** are preserved. **P2 OPEN; P3 NOT STARTED.**


## Real manual restore verified and remaining P2 acceptance — 2026-10-03

**REAL MANUAL RESTORE VERIFIED / PASS for this exact snapshot only. P2 OPEN; G1 PENDING; P3 NOT STARTED.** The owner reports the latest phone pipeline returned **`decrypt_exit=0`, `restore_exit=0`**, following the previously reported exact ciphertext hash match. Independently inspected the matching successful **real_phone_stream** server evidence, checked all required result fields and rechecked cleanup/protected resources/timer. Phone decryption/hash results are owner-reported; PostgreSQL/schema/migration/count/FK and cleanup results are independently checked VPS evidence. Synthetic tests are excluded from this acceptance.

| Evidence | Verified result |
|---|---|
| Snapshot / private Release | `om-db-v1-20261003T130037Z-eeab03ba` / `402515437` |
| Ciphertext / SHA-256 | 32381 B / `278b0ca3ff038e2e5a07256b0e135e428a988894cec33b47f93123a57d876592` |
| Actual receiver start / finish | **2026-10-03 14:45:11.042384–14:45:22.635616 UTC** |
| Independent final verification | **14:48:51.925876 UTC** |
| `pg_restore` / validation | Exit **0**; `database_checks_verified=true`; no failure; phase `database_checks_complete` |
| Schema | Exact 10-table inventory; table/sequence definitions, columns/types/defaults/nullability, constraints/validation state, indexes/validity, functions, user triggers/enabled state and enums match reference migrated from snapshot source commit `31a370387b9e8a6a61d92d2d156918bbb0451cc2` |
| Migration history | **4**; exact ordered hash and timestamp equality with the snapshot-source migrations |
| Relational integrity | **14 foreign keys checked**, including composite project/customer/session/refund links; **0 orphan rows**, every per-constraint count zero |
| Isolation | Actual evidence confirms network `none`, 0 published ports, no bind/named mounts in Docker `Mounts`; the executed receiver configured PostgreSQL data and `/tmp` with `--tmpfs`, disabled Docker logs, panic-only PostgreSQL logging, 512 MiB / 1 CPU limit |
| Original server evidence | `.runtime/restore-phone-rqsjwgby/result.json`; SHA-256 `e08ff464ea9690147d8fc40c0747d680fddc1a58b258bea89ba4888f471eca94` |
| Final confirmation | New root-only ignored `.runtime/restore-phone-rqsjwgby/verification.json`: **`REAL_MANUAL_RESTORE_VERIFIED`, `restore_verified=true`**, joining original server evidence with owner-reported phone exits |

The original receiver `result.json` remains unchanged with `ISOLATED_DB_CHECKS_COMPLETE_PHONE_EXIT_PENDING` / `restore_verified=false`, because it was written before the phone exit report. The new confirmation resolves that pending state without rewriting historical evidence. Likewise the backup creation record's original restore flag is not overwritten or treated as the current final confirmation.

### Actual restored row counts and limits

| Domain table | Rows |
|---|---:|
| `workspaces` | 0 |
| `projects` | 0 |
| `api_keys` | 0 |
| `events` | 0 |
| `sessions` | 0 |
| `customers` | 0 |
| `customer_visitors` | 0 |
| `revenue_events` | 0 |
| `customer_attribution` | 0 |
| `ingestion_daily` | 0 |

These are **actual restored backup counts**, not synthetic results or new production SELECTs. This real snapshot contains an empty domain database plus the four migration rows. Foreign-key definitions/validation match and orphan checks return zero, but the empty tables do not demonstrate populated business relationships or real visits. `latest_revenue_received_at=NO_REVENUE_ROWS`: the canonical <26 h revenue freshness condition cannot be demonstrated here. No live dogfood/attribution, full fresh-machine disaster drill, or populated-data coverage is inferred.

### Cleanup, production preservation and timer

Rechecked exact test container `om-phone-restore-364ed469a305406c`: Docker inspect confirms it is absent. `docker ps -a` contains only the pre-existing OriginMetric containers; this test created no named network or volume. The receiver's tmpfs data is gone with its container. After confirming the staged ciphertext hash and exact two-file inventory, removed only this task's `.runtime/phone-pigpm9sw/database.dump.age`, `SHA256SUMS` and now-empty transfer directory. Phone files/key, remote GitHub Releases/assets, existing production volumes and sanitized private evidence were preserved. No plaintext dump, private key or sensitive diagnostic file was created.

Receiver pre/post protected-resource comparison was true. An additional final comparison against the earlier private baseline confirms unchanged production container IDs/start times/restart counts/mount definitions and hashes of canonical plan, production env, installed OriginMetric nginx and backup units. No production SQL, volume mounting/writing, application command, restart, deployment or traffic-gate change occurred. This is metadata/configuration preservation evidence, not a claim of byte-for-byte volume content hashing.

Existing daily timer is **enabled / active / waiting**, exact **`OnCalendar=*-*-* 03:15:00 UTC`**, `Persistent=true`, `RandomizedDelaySec=0`; next **2026-10-04 03:15:00 UTC**. LAST/`LastTriggerUSec` remain empty, so no completed scheduled backup is claimed. The prior manual service backup/upload/readback and today's manual restore are independently complete; no scheduler operation occurred in this task.

A public, unauthenticated GET of the separate monitoring workflow's runs now verifies actual **schedule / completed / success** runs [37124111668](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37124111668) (12:49:14 UTC), [37118167664](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37118167664) (10:59:03 UTC) and [37116586580](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37116586580) (10:29:30 UTC). This supersedes earlier “no scheduled-run success yet” monitoring statements at the API workflow-result level. These timestamps do **not** establish uninterrupted five-minute observation, independent missing-run detection or email delivery. No workflow dispatch/configuration change or notification was sent.

### Remaining canonical P2 acceptance criteria

| Open criterion | Exact remaining work / existing evidence boundary |
|---|---|
| **G1 formal completion before public ingestion** — §28 | Record the complete six-item gate against the reviewed deployed slice: required-consent/withdrawal/GPC, body/schema/origin/dedup/failure isolation, in-app rate limits/abuse ceiling/daily cap plus the single edge rule, log redaction, no browser identity/revenue poisoning. Earlier fixture/full-suite evidence exists; it does not by itself close real-site acceptance. Current data gates remain closed. |
| **Actual `originmetric.app` consent setup and owner review** — §§5/8/28 | Required-consent banner integration, zero storage/network before consent, withdrawal clears/stops, GPC default; owner confirms actual dogfood setup. Controlled/synthetic fixtures do not fulfill this. No other site is authorized. |
| **Persisted real dogfood attribution and protected operator access** — §28 P2 exit/deliverables | Consented visit → persisted session/source → trusted server identify → owner-originated test payment → attributed internal result; exercise duplicate/refund/renewal behavior and token-protected internal access through the authorized private path. Reviewed deploy/post-deploy smoke and existing backup prerequisites must be respected. Restore of this empty snapshot does not fulfill this criterion. |
| **Backup/monitoring failure and missing-run email evidence** — §§24–25 | Prove backup start/success/fail/missing detection and actual email delivery to the defined owner target; resolve dump-size jump warning (±50%) coverage. Independent scheduled HTTPS workflow successes now exist, but scheduler gaps, failures and email/dead-man delivery remain unproved. First 03:15 UTC scheduled backup completion is still pending; enabled timer/manual success are not that evidence. Advanced full alerting/automated restore remain P7, not newly required P2 implementation. |
| **Storage/retention acceptance difference** — §24 / D-008 | GitHub private DB backend is authorized and owned 7/4/2/≤90-day pruning has successful operational evidence. Provider lifecycle backstop and behavior when VPS/job/account fails are still unresolved canonical differences; no new general GitHub/provider approval is requested, and D-008 did not waive these acceptance gaps. |
| **Phone-independent secret recovery** — §24 | Off-phone vault backup remains owner-**DEFERRED**; demonstrate independent access to existing offline key/password-manager/paper/account/2FA recovery and separately stored encrypted env. Preserve earlier owner declarations about paper/key/vault/env; their contents are never requested. Restore success does not prove phone-loss readiness. Owner's explicit no-rotation/current-key decision remains in force. |
| **Remaining edge configuration verification limit** — §23 / G1 review | User-panel evidence already supports the saved single rule/window/order, Full (strict) and conflicting-rule inventories; earlier VPS behavior/firewall/dual-stack checks remain valid evidence. Saved `/js/*` cache configuration is still unverified. Direct provider ruleset/original-export review remains an explicit source limit; do not repeat the already supplied panel request or label all Cloudflare evidence missing. |

**Next canonical work:** close actual-domain consent/owner review and formal G1 before any data-gate opening or controlled end-to-end dogfood deployment, while resolving the outstanding backup/monitoring/secret-recovery acceptance gaps. Do not start P3 or claim `SLICE LIVE (dogfood)` until the complete P2 exit criteria are met. No phase/plan decision was changed by this restore confirmation.

Only STATUS and this report are task changes; application/receiver code is unchanged. Markdown/link/whitespace checks and redacted offline gitleaks scans cover the task documents and Git history before commit. No application suite or restore rerun is necessary: the actual phone stream and independently checked server evidence are this task's operational validation. Normal assigned-branch commit/push and full local/remote SHA equality are checked at handoff.
## P2 acceptance continuation — 2026-10-03

**P2 OPEN; G1 PENDING; P3 NOT STARTED.** Continuation evidence is private under
`.runtime/p2-acceptance-20261003T150616Z/`. The earlier real empty-snapshot restore
remains verified; no new populated production restore has occurred. Existing age
key use remains the owner's explicit decision. No secret value was requested,
recorded here or transferred to the VPS.

## Technical work and evidence

- Added ±50% inclusive ciphertext size-change warnings to the normal scoped
  backup metadata. Seventeen backup-policy/credential/lock tests pass. Added a
  read-only local watchdog: newer backup failure supersedes old success;
  >26-hour stale/missing verification fails; invalid/future evidence is UNKNOWN.
  Four watchdog tests pass. At 15:31 UTC the actual manual backup is fresh;
  independent missing-run monitoring and email delivery explicitly remain false.
  These controls do not simulate a failure of the production backup itself.
- Public monitoring commit `866e0559f70aace5c106e107e52d33f999e2a936`
  preserves the five-minute schedule and adds explicitly labelled controlled
  failure notification tests. Expected failure steps completed:
  [monitoring control 37132327501](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37132327501),
  [backup missing control 37132330300](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37132330300),
  [backup failure control 37133412117](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37133412117).
  Earlier concurrent backup-control run 37132328909 was cancelled and is excluded;
  the serial retry above completed. Normal observation 37132649577 succeeded.
  [Normal observation 37133538649](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37133538649)
  also succeeded after the final control. These
  prove the workflow failure path, **not** actual backup failure/missing-run
  detection, email receipt, uninterrupted scheduling or a service outage.
  Owner email receipt remains unconfirmed; only a receipt/no-receipt result was
  requested, never an address or message contents.
- Retention inventory/dry-run: one managed DB snapshot, one unrelated phone
  recovery release, zero >=90-day owned candidates, zero deletions. Existing
  7/4/2 and <=90-day policy remains unchanged. Prepared separate provider-side
  expiry script with exact ownership, private-repo and changed-target guards;
  three tests pass. `deploy/github/recovery-retention.yml` is **a review template,
  not installed or active**. Private Actions no-spend budget must be verified
  before activation; source pin is now full-suite CI-verified. GitHub draft Releases have no confirmed
  native lifecycle backstop here; failed VPS/account/provider scenarios remain
  acceptance gaps. No retention gap is silently waived by D-008.
- Installed only the `/js/` origin cache-header change; `nginx -t`, reload and
  isolated original-peer/header-overwrite proof pass. Source copy matches the
  installed change. Tracker responses after reload: **MISS, HIT, HIT**, edge TTL
  `s-maxage=3600`. Origin browser TTL is 300 seconds, but public Cloudflare response
  rewrites it to **max-age=14400** (4 hours). Saved browser/cache rule review is
  therefore still required. No Cloudflare API credential/zone ID is available;
  no direct panel/API or original export claim is made. Previously supplied API
  bypass/rate/SSL/inventory panel evidence remains valid at its recorded source
  level. [Cloudflare TTL reference](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/).
- Prepared explicit GitHub predeploy adapter with inherited exact operation lock
  and scoped credential, keeping the remote-readback gate before deployment.
  Default rclone path remains explicit; production env/backend was not changed.
  Mocked GitHub backup failure stops before Docker build/migration; existing
  rollback/first-deploy DB-preservation tests pass. No production app deployment,
  migration, API test ingestion, project/key creation or revenue occurred here.
  Production DB, volumes and app were not modified; the intentional nginx header
  reload above is the only production ingress change.

## Prepared dogfood and populated recovery acceptance

[P2_DOGFOOD_ACCEPTANCE.md](../runbooks/P2_DOGFOOD_ACCEPTANCE.md) contains the ordered
real-domain G1 review, deny/allow/withdraw/GPC checks, separate labelled test
workspace/project, server-only trusted conversion, `test=true` payment, exact
duplicate/conflict, renewal/refund assertions, protected internal result and a
new populated snapshot restore. Test totals are explicitly test minor units,
never business/customer/revenue evidence. Production currently serves the old
build and `/dogfood` returns 404; owner browser consent testing is not ready yet.

Receiver now supports a new private `--snapshot-evidence` JSON, mandatory explicit
new snapshot source SHA, exact expected ten-table counts and a populated-test
requirement. It still uses network-none/tmpfs, no plaintext dump file/log/key and
removes only its container. Synthetic regression verified 10 tables, 4 migrations,
14 FKs and cleanup without production changes; it is **not real restore evidence**.
Empty-as-populated negative control failed as required (exit 1, cleanup and
production metadata unchanged). Real new restore additionally needs
phone exits 0/0, actual snapshot counts/freshness and attribution/payment assertions;
neither PASS nor P2 completion can be inferred from this preparation.

Earlier recipient sample/hash/decrypt, encrypted env decrypt and KeePassDX
attachment/save remain owner-reported COMPLETE. They are not requested again.
Off-phone vault backup remains explicitly DEFERRED; independent key/vault/account/
2FA recovery remains unverified. Existing key-use decision is preserved.

## Remaining canonical P2 acceptance

1. Formal six-item G1 deployed-build evidence and actual-domain owner consent/GPC/
   withdrawal confirmation before ingestion opens (§28).
2. Reviewed deploy/smoke, persisted real owner visit → trusted conversion →
   labelled test payment → attribution, duplicate/conflict/refund/renewal and
   private token-protected internal result (§28).
3. New populated encrypted backup/readback and phone-only real restore, exact
   counts, freshness, schema/migrations, FKs and test-attribution assertions.
   The required first manual **empty** restore is already complete, not undone.
4. Actual scheduled backup success, failure/start/success/missing-run detection,
   independent dead-man and confirmed owner email receipt (§§24–25). First
   03:15 UTC run is **PENDING**, no LastTrigger yet; enabled/active timer next
   2026-10-04 **03:15 UTC** (05:15 CEST) is not scheduled-success evidence.
5. Activated/verified independent lifecycle/retention backstop and documented
   failure behavior, within the authorized free/no-spend constraints (§24/D-008).
6. Phone-independent secret/account recovery; deferred off-phone vault decision
   is preserved and completed attachment/paper/key declarations are not repeated.
7. Saved `/js/*` cache and browser TTL verification; direct Cloudflare API/export
   review limit remains explicit. Already supplied broader panel checks stand.

Local lint, format, typecheck, production build, 219 unit tests, three isolated
consent/GPC/operations browser tests, backup/watchdog/retention and deploy/proxy
checks pass. No full real-DB suite against production was run. Full-suite CI #68
remains historical evidence; this continuation must receive its own CI result.
Task sources/docs and both Git histories are secret-scanned before handoff;
assigned-branch normal push and full local/remote SHA equality are checked.

CI continuation: run 37134345049 passed unit/real-DB migrations/tests, build,
Playwright and the demo, then exposed a portability error in the existing backup
readback test (`rg` absent on the runner). Assertions now use portable grep, with
the same corruption/read-failure/retention expectations; isolated local readback
proof passes. This failed CI run is not labelled successful; final corrected
commit CI must be checked separately.

Corrected run 37134598497 then passed the portable controls and production image
consent/identify/test-payment attribution, but exposed an existing restore-check
startup race: socket-only initialization server exited between pg_isready and
createdb. Both isolated receivers now wait for final TCP readiness **inside** their
network-none container; timeout stops explicitly. The basic receiver also
suppresses row-level pg_restore diagnostics. This failed synthetic CI restore
does not invalidate the earlier independently verified real phone restore.

**Final code CI VERIFIED:**
[run 37135062561](https://github.com/brsctncnbrk5/originmetric/actions/runs/37135062561)
completed **success** at code SHA `2558928fa4b3f02929d66a14f17d9265c792192e`.
All stages passed, including real-DB tests/migrations, Playwright, portable
backup controls and the Docker synthetic consent → trusted identify → labelled
test payment → attribution → encrypted backup → isolated restore/failure proof.
Retention review template pins that exact source. The final documentation/template
commit sits above this tested code; no application/receiver change follows it.
This CI evidence is not an actual-domain or populated production snapshot restore
result. G1 pending, P2 open, P3 not started; first scheduled backup remains pending.

## Browser TTL resolved and closed consent preview preparation — 2026-10-03

Owner reports saving Browser Cache TTL = **Respect Existing Headers** for
originmetric.app. Independent public GETs at **16:37:16 UTC**: all HTTP 200,
`Cache-Control: public, max-age=300, s-maxage=3600`, cache statuses
**MISS → REVALIDATED → HIT**. Browser 14400-second override is resolved.
Saved setting evidence is owner-reported plus live behavior; no direct Cloudflare
API/panel/export inspection is claimed. Existing wider panel evidence stands.
Private evidence: `.runtime/p2-cache-20261003T163716Z/tracker-ttl.json`.

Fresh preparation backup `om-db-v1-20261003T163906Z-b6687a79` completed scoped
encrypted upload and exact ciphertext/manifest remote readback at **16:39:13 UTC**;
no size warning. This is **manual backup/readback**, not new restore or scheduled
success. Separately labelled workspace/project/key prepared for owner-controlled
P2 acceptance only; stdout/key captured in new root-private ignored files, never
shown. These are intentionally test configuration records, not customers/revenue.
Production env changes are limited to explicit GitHub predeploy backend and the
registered public dogfood site key; all existing secrets/age recipient/data gate
remain unchanged. This preparation does not claim production metadata unchanged
across an intentional forthcoming deployment.

Reviewed proxy source adds only exact `/dogfood` preview routing, keeping browser
events 202/drop, trusted APIs 503 and internal/fixtures 404. The consent page has
required-consent/deny/withdraw/GPC and explicit test-data labels. Normal reviewed
deployment must retain backup-before-build/migrate, smoke and rollback. G1 fixture
readiness now requires final PostgreSQL TCP server rather than transient init
socket. Actual browser consent acceptance, persisted test attribution and populated
backup restore remain pending; P2 stays open and P3 is not started.

### Closed preview actually deployed and technical G1 verified

Normal exact-clean-SHA deployment completed at
`e74bfc1fcc6e404be977feee059dc1d3c78d170c`, with predeploy scoped snapshot
`om-db-v1-20261003T164300Z-e5ec346e` remotely verified at **16:43:07 UTC** before
image build/migrations. Deployment smoke passed; exact `/dogfood` route then
installed with nginx validation/reload. No rollback was required. Full source
[CI run 37137940264 succeeded](https://github.com/brsctncnbrk5/originmetric/actions/runs/37137940264).

Deployed-image `gate-g1.mjs --technical-only`: **technical PASS / overall PENDING**.
Required consent/withdrawal, default GPC, browser trust boundary, validation/origin/
dedup/failure isolation, limits/daily cap and redaction passed with deployed bytes
and matching-source isolated real-DB regressions (7 files). Test fixtures removed;
production fact counts unchanged by the gate. Safe evidence path is recorded in
`.runtime/g1-latest-path`. The tool's generic independent Cloudflare review pending
string remains a direct-inspection limitation; it does not revoke earlier
transferred saved-rule/window/order/SSL inventory evidence or request those panels
again. Formal G1 still requires the dated owner actual-banner acceptance/review.

Public actual-page browser check **16:51 UTC**: `/dogfood` 200; test label visible;
Allow enabled and Deny/Withdraw visible. Before consent and after clicking Deny:
**0 analytics requests**, no visitor identifier, no tracker cookie/local storage.
This is independent live behavior evidence, not owner browser confirmation.
No Allow action or real test revenue was executed on production.

At **16:52 UTC**, actual ten-table counts: workspace/project/API key **1 each**
(labelled configuration only); events/sessions/customers/links/revenue/attribution/
ingestion_daily **0**. Public events remain **202/drop**, identify/revenue **503**,
internal and fixtures **404**. DB and Caddy IDs/starts and all existing mounts
unchanged; app was intentionally recreated by the reviewed deployment. Production
volumes were not removed/restored/replaced; no real customer or income claimed.
No private key was moved; no credential/record body was printed. Daily timer is
still enabled/active, first scheduled execution **PENDING**, next 2026-10-04 03:15 UTC.

Current remaining acceptance: owner actual consent/deny/allow/withdraw/GPC and
formal G1; subsequent persisted controlled trusted test chain; its populated
snapshot restore; actual email/dead-man/scheduled backup; independent lifecycle
backstop activation; deferred phone-independent recovery. Browser TTL mismatch is
resolved; provider API/export source limit remains explicit. Earlier vault/env
attachment and empty manual restore remain complete. **Next owner step only:**
private tab → `/dogfood` → **Reddet** → report **Reddedildi** visible yes/no.
**P2 OPEN; P3 NOT STARTED.**

## Owner deny acceptance and server verification — 2026-10-03

Owner reports **Reddet clicked / Reddedildi visible / Allow not clicked**. This
completes the owner deny UI check; no repeat is requested. Read-only server audit
at **17:03:37 UTC** found all ten production table counts identical to the
16:52 UTC pre-owner baseline: workspace/project/API key 1 each (test configuration),
events/sessions/customers/customer_visitors/revenue/customer_attribution/
ingestion_daily **0**. Private in-container authenticated metrics returned 200,
ingestion counters **{}** (accepted and other outcomes absent/zero). Installed
nginx configuration matches reviewed source; exact events route returns 202
without any upstream proxy.

At **17:05:13 UTC**, one explicitly labelled operator control POST with empty
`{}` returned **202**, with ingestion counters still **{}**. This is a drop-path
control, **not the owner's request**. It confirms the active route prevents
application ingestion; no credential/header/request body or record contents were
logged or shown. Safe evidence is under `.runtime/p2-deny-20261003T170337Z/`:
`server-deny-audit.json`, `application-metrics.json`, `active-drop-control.json`.

**Evidence limit:** server persistence/counters and closed ingress prove no
application analytics acceptance/write; they cannot prove that the phone sent
zero outbound requests. Access logs are intentionally disabled, and no raw IP,
visitor/customer ID, cookie or per-user request log was collected. Earlier live
page automated deny/pre-consent test independently observed zero analytics
requests, but is not a network capture of this owner's phone. Deny UI acceptance
is owner-reported; server checks are independently observed. No inference is
promoted to a phone traffic observation or full G1 PASS.

Next single owner step is **Allow UI**, on the same private tab: click **İzin ver**
and report only the status message. Required-consent withdrawal and GPC checks
then follow individually. Ingestion remains **closed** until formal G1 acceptance;
no persisted real-visit/test-payment attribution or new populated restore is
claimed. Existing key decision/vault evidence stand. Timer enabled/active, daily
**03:15 UTC**, first scheduled result **PENDING**; no production config/deploy/DB
write or volume change in this deny verification. **P2 OPEN; P3 NOT STARTED.**

## Owner Allow UI acceptance — 2026-10-03

Owner reports clicking **İzin ver** in the same tab and seeing **İzin verildi**.
Recorded at **17:31 UTC**, source **OWNER-REPORTED**; this is banner UI acceptance
only. No phone identifier, cookie, request trace or sensitive screenshot collected.
Safe metadata: `.runtime/p2-allow-20261003T173115Z/owner-allow.json`.
Installed exact events location still returns 202 without upstream proxy;
ingestion was not opened. No config/deploy/production DB write/volume change was
made for this recording, and no real payment or new restore was performed.

**Data collection NOT PASSED / actual persisted visit PENDING.** The reported UI
message (or a 202/drop response) is not application acceptance/persistence proof.
Earlier deny counters/counts remain evidence from their dated checks, not new
measurements after this Allow click. This result does not establish GPC behavior.
Owner's explicit instruction to keep collection unaccepted while ingestion is
closed is preserved. Formal G1 remains pending; P2 open; P3 not started.

Next single owner step: **without refreshing the same tab**, click **İzni geri çek**
and report only whether **İzin geri çekildi** appears. Withdrawal's actual tracker
state clearing/request stopping and GPC review remain separate acceptance evidence;
no withdrawal PASS is written before the checks. Existing age-key/no-rotation and
daily 03:15 UTC decisions remain unchanged; completed vault/attachment steps are
not requested again.

## Owner withdrawal UI and independent live state/sending verification — 2026-10-03

Owner reports **same tab / no reload / İzni geri çek clicked / İzin geri çekildi
visible**. Recorded as **OWNER-REPORTED UI COMPLETE**, not identifier deletion,
request stopping or phone network/storage inspection. The owner's explicit
evidence distinction is preserved. Safe control evidence is under
`.runtime/p2-withdraw-20261003T173635Z/`; no value of a visitor/customer identifier,
cookie, key, token or request body is shown or saved in this evidence.

Independent automated **live originmetric.app/dogfood** controls:

| Control | Actual observation | Scope |
| --- | --- | --- |
| Required-consent baseline | Visitor absent, tracker cookie/localStorage/sessionStorage counts 0; analytics requests 0 | Fresh independent profile, not owner phone |
| Normal Allow | Visitor present, tracker cookies 2; one analytics request, response 202/drop | Client positive control only; not application persistence |
| Normal withdrawal | Visitor absent, tracker cookies 2 → 0; tracker storage counts 0 | Direct browser state checks, not inferred from UI |
| Cookie-write-failure fallback | Simulated cookie write rejection; Allow created 3 tracker localStorage entries; withdrawal 3 → 0 and visitor absent | Explicit injected fallback control on live tracker |
| Post-withdraw history/reload | 0 new analytics requests for pushState/replaceState/popstate; normal branch also hashchange; reload still visitor/storage absent and 0 new requests | 1000 ms post-history + 500 ms after reload, both branches |
| Default GPC | Injected navigator GPC=true; Allow showed privacy-blocked status; visitor/storage absent, 0 analytics requests | Simulated signal on live page; not actual owner browser setting |

Normal control completed **17:38:31 UTC**; fallback completed **17:40:24 UTC**.
Profiles/browser were closed after testing. These controls verify the live
implementation's clearing and no new sends in the stated cases/windows; they do
not observe the owner's phone or claim to cancel already-sent/in-flight requests.
No trace, screenshot, request payload or cookie contents were retained.

Read-only server verification at **17:39 UTC**: all ten counts identical to the
prior deny baseline, configuration rows 1 each and domain facts 0; containers/
start times/restarts unchanged, ingestion still closed. Recheck after both
controls at **17:40:53 UTC**: application ingestion counters **{}**; events,
sessions, customers, revenue, links and attribution all **0**. **Data collection
NOT PASSED**: allowed client requests were dropped by nginx. No production
config/deploy/DB write/volume change, revenue event or populated restore occurred.

**Next acceptance is GPC.** Browser name requested (metadata only) so the next
single owner privacy-setting/check step fits the actual browser; support is not
assumed and no new browser/dependency is installed. Injected GPC control is kept
separate from owner setting acceptance. Formal G1 remains pending; existing key,
vault/attachment evidence and 03:15 UTC schedule remain unchanged. **P2 OPEN;
P3 NOT STARTED.**

## Android Chrome identified / real GPC signal check pending — 2026-10-03

Owner identifies the acceptance browser as **Android Chrome**. This is browser
metadata only: no version/channel, navigator GPC value or Sec-GPC observation was
provided. Do not infer enabled native GPC, native support, or successful GPC
acceptance from the browser name or the earlier normal Allow UI message.

Primary sources checked for the next step:
- [Google Android Chrome help](https://support.google.com/chrome/answer/2790761?co=GENIE.Platform%3DAndroid&hl=en)
  documents **Do Not Track**; that setting is not the navigator.globalPrivacyControl/
  Sec-GPC signal required by this tracker's GPC check.
- [GPC initiative](https://globalprivacycontrol.org/) links its
  [reference implementation](https://global-privacy-control.vercel.app/), which
  exposes client-side signal presence/value and server-side Sec-GPC detection.
  Its client code distinguishes absent navigator property from exposed true/false.
  The GPC user guide lists Chrome extensions; this does not establish Android
  extension availability or an enabled signal on this owner's browser.

Next **single** owner step: Chrome private tab → reference URL → Client-side
detection → report only **true**, **false**, or **DOM signal not present**. No
account, credential, identifier, cookie, screenshot or request header is requested.
True proves reference-site enabled signal only; subsequent actual dogfood GPC
behavior still needs checking. False/absent cannot pass enabled-owner GPC and
must be recorded as **NOT_ENABLED** (false) or **NOT_EXPOSED** (absent), not waived. No Canary
flag or new browser/extension is recommended/installed at this step. This manual
reference check adds no dependency or integration to OriginMetric.

Existing injected live-page GPC=true technical proof remains separate from owner
browser signal evidence. No new OriginMetric data/test revenue/restore was run;
no production source/env/config/DB/volume/timer change. Ingestion remains closed;
**data collection NOT PASSED; formal G1 PENDING; P2 OPEN; P3 NOT STARTED.**


## GPC NOT_EXPOSED recorded / formal G1 review — 2026-10-03

Owner reports GPC reference **Client-side detection: DOM signal not present**
in the previously identified **Android Chrome** browser. Recorded as
**NOT_EXPOSED / OWNER-REPORTED**. The reference-result step is complete;
enabled-owner GPC acceptance is **NOT PASSED**, not waived. No browser-wide
support conclusion or server-side Sec-GPC result is inferred. Existing injected
live-page GPC=true technical proof remains separate.

Advanced to the formal six-item G1 evidence review (§28). This review uses the
existing deployed-source evidence, not a new test execution. Reviewed source:
`e74bfc1fcc6e404be977feee059dc1d3c78d170c`; private gate summary:
`.runtime/g1-1791046258249-2898892/summary.json` (technical PASS, 7 regression files,
fixtures removed and production facts unchanged at that execution).

| Canonical G1 item | Consolidated evidence / outcome |
| --- | --- |
| 1. Required consent / withdrawal | Technical PASS from deployed clone and independent live controls; owner deny/allow/withdraw UI reports complete. Dated owner confirmation of actual required-consent banner setup remains PENDING. Phone storage/network not inspected. |
| 2. Default GPC | Technical PASS from deployed clone and injected true on live page. Owner reference result NOT_EXPOSED; enabled-owner behavior acceptance NOT PASSED, remains open. |
| 3. Body/schema/origin/dedup/failure isolation | Technical PASS from matching-source real-DB regressions. |
| 4. Rate limits / abuse ceiling / daily cap / single edge rule | Technical PASS from deployed-source regression evidence; earlier transferred saved Cloudflare rule/window/order panel evidence remains accepted. Direct provider API/original-export review remains unverified; panels are not requested again. |
| 5. Log redaction | Technical PASS from real-handler regressions and fixture runtime checks. |
| 6. No browser identity/revenue creation | Technical PASS from deployed browser trust-boundary checks. |

**Formal G1 remains PENDING.** Next owner evidence is dated actual-banner setup
confirmation; enabled-owner GPC evidence stays explicitly open. No reference-test
retry, dependency installation or experimental flag requested. No ingestion gate
opening, production config/deploy/DB write, persisted visit, revenue or populated
restore was performed. **Data collection NOT PASSED; P2 OPEN; P3 NOT STARTED.**
Existing age decision, completed vault/empty-restore evidence and daily 03:15 UTC
schedule remain unchanged. After formal G1 is complete, continue the labelled
persisted visit → trusted identify → revenue → attribution chain, then its
populated backup/restore; these steps are not yet eligible to run.


## G1 evidence applicability and first owner-dependent item — 2026-10-03

Read-only/fresh-profile verification at **18:10 UTC** completed the applicable
technical reconciliation before the first owner-dependent item. Current deployed
source and image match the existing technical gate PASS, and current public
tracker SHA-256 matches that gate. Production `src`, `tracker`, and `drizzle`
match deployed source `e74bfc1fcc6e404be977feee059dc1d3c78d170c`.
Private safe evidence: `.runtime/p2-g1-review-20261003T181042Z/review.json`.

Live `/dogfood` returned **200** with `data-consent=required`, no `data-gpc=ignore`,
all three enabled consent controls, and initial **İzin bekleniyor**. Fresh independent
profile observed **0** analytics requests, **0** tracker cookies/localStorage and
absent visitor ID before consent. No Allow action was taken. All six fact counts
were **0** before and after. Browser closed; no identifiers, headers, request bodies,
traces or screenshots retained. Existing system Chrome was used; no dependency
installed. An initial read-only count query used an incorrect attribution table
name and was corrected to schema-defined `customer_attribution`; a browser launch
using Playwright's unavailable default executable was corrected to existing system
Chrome. Failed attempts are not PASS evidence. No full regression rerun is claimed.

Canonical §28 items 3–6 retain their existing reviewed technical evidence; this
verification confirms source applicability, not a new Cloudflare provider inspection.
The **first owner-dependent open item is dated confirmation of the actual required-consent
banner setup** (G1 item 1 / current checklist). Single requested action: owner confirms
in writing acceptance of the existing `originmetric.app/dogfood` consent banner,
with **Reddet / İzin ver / İzni geri çek** controls. This is setup acceptance only;
previous UI reports need not be repeated and phone storage/network is not inferred.

Owner GPC remains **NOT_EXPOSED**; enabled-owner GPC behavior remains **NOT PASSED**.
No missing evidence is waived. **Formal G1 PENDING; data collection NOT PASSED;
P2 OPEN; P3 NOT STARTED.** `PUBLIC_G1_READY=no` verified. No gate opening, config,
deploy, production DB write, labelled conversion/revenue or populated restore occurred.
Work pauses at this first owner evidence item as requested.


## Owner actual-banner setup accepted / next GPC evidence item — 2026-10-03

Owner explicitly confirms: “originmetric.app/dogfood üzerindeki zorunlu izin
düzenini ve Reddet / İzin ver / İzni geri çek kontrollerini onaylıyorum.”
Dated actual-banner setup confirmation is **ACCEPTED / OWNER-CONFIRMED**.
This resolves the G1 item 1 setup-confirmation gap in the previous checklist.
Prior independent technical controls and owner UI reports remain evidence at their
recorded scope; owner-phone storage/network is not newly observed or inferred.

| G1 item | Updated outcome |
| --- | --- |
| 1. Required consent / withdrawal | Technical PASS retained; dated owner actual-banner setup ACCEPTED; previous deny/allow/withdraw UI reports COMPLETE. |
| 2. Default GPC | Technical PASS retained; Android Chrome reference NOT_EXPOSED; enabled-owner behavior evidence NOT PASSED, still open. |
| 3. Body/schema/origin/dedup/failure isolation | Existing matching-source technical PASS retained. |
| 4. Rate limits / abuse ceiling / daily cap / edge rule | Existing technical and saved-panel evidence retained; independent direct provider API/export inspection still unverified. |
| 5. Log redaction | Existing technical PASS retained. |
| 6. Browser trust boundary | Existing technical PASS retained. |

**Next first owner-dependent item: enabled GPC evidence.** Single step: report the
name of an already available other browser in which GPC can be enabled, or report
none. This collects availability metadata only, not a PASS. No new browser,
extension or flag installation, repeated Android reference check, production
mutation or data gate opening is requested/performed. Subsequent verification
depends on that answer; the prior NOT_EXPOSED result is preserved.

**Formal G1 PENDING; data collection NOT PASSED; P2 OPEN; P3 NOT STARTED.**
No missing evidence waived; no production deployment/config/DB change or new
regression run. Existing technical source applicability review remains valid.


## No other available GPC browser / independent P2 email evidence — 2026-10-03

Owner answers **“Yok.”** to whether another already available browser can enable
GPC. Recorded **OWNER-REPORTED: no other available GPC browser**. Actual-banner
setup stays ACCEPTED; Android Chrome result stays **NOT_EXPOSED**; enabled-owner
GPC behavior acceptance stays **NOT PASSED**. This is neither a waiver nor new
support/behavior evidence. No browser/extension installation or repeat reference
test is requested. **Formal G1 remains PENDING**; data gates stay closed and the
persisted trusted chain/populated restore cannot proceed under current acceptance.

Continue independent canonical P2 §§24–25 backup/monitoring evidence. Earlier
labelled control failures were already executed (monitoring 37132327501,
backup-missing 37132330300, serial backup-failure 37133412117); workflow result
proof exists, but actual owner email receipt remains unconfirmed. No new workflow
or notification is dispatched. **Next single owner action:** check for the existing
`originmetric-monitoring` GitHub Actions failure-control email and report only
received / not received. No email address or contents requested. Receipt alone
will not prove actual scheduled backup, failure/missing-run detection or independent
dead-man coverage; those separate gaps remain open.

Existing lifecycle/no-spend and deferred off-phone recovery gaps remain explicit.
No production config/deploy/DB change, gate opening, new regression run or backup
claim. **Data collection NOT PASSED; P2 OPEN; P3 NOT STARTED.**


## Owner failure-control email not received / account-setting prerequisite — 2026-10-03

Owner reports **“gelmedi”** for the previously executed labelled failure-control
email. Recorded **NOT_RECEIVED / OWNER-REPORTED**, email delivery **NOT PASSED**.
Existing failed workflow runs establish the controlled failure path only, not
mail delivery; nonreceipt cause is **UNKNOWN**.

Reviewed monitoring workflow/template: no dedicated email-sending step is present.
Native GitHub Actions notifications depend on account notification configuration.
[Official GitHub notification guidance](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
checked 2026-10-03 directs users to Notification settings → System → Actions →
Email, then Save; failed-workflows-only is optional. Account settings are not
visible in existing evidence, so no disabled-setting diagnosis is asserted.

**Next single owner step:** at `https://github.com/settings/notifications`, enable
**Email** under **System → Actions** and save; report saved or already enabled.
No email address/contents/screenshots needed. This is configuration evidence only,
not receipt evidence. A new labelled delivery control can follow after the setting
is confirmed; no new control/notification has been dispatched in this turn.
Independent dead-man, actual missing-run/backup failure detection and scheduled
backup evidence remain open regardless of notification settings.

Banner acceptance remains complete; GPC NOT_EXPOSED / enabled-owner GPC NOT PASSED;
**formal G1 PENDING; ingestion closed; data collection NOT PASSED; P2 OPEN;
P3 NOT STARTED**. No production application/config/DB or workflow modification.


## Actions notification setting confirmed / delivery diagnosis — 2026-10-03

Owner reports existing **Actions: GitHub, Email (Failed workflows only); Saved**
and continued nonreceipt. Setting prerequisite is **COMPLETE / OWNER-REPORTED**;
email receipt remains **NOT_RECEIVED / NOT PASSED**. No disabled-setting diagnosis
is justified and the completed setting step is not requested again.

Read-only GitHub API verification: controls 37132327501, 37132330300 and
37133412117 all have event `workflow_dispatch`, status completed, conclusion
failure, and both actor and triggering_actor `brsctncnbrk5`. Serial control
37133412117 failed at **Controlled notification test (expected failure only)**;
setup succeeded and safe summary completed. This excludes cancellation and actor
mismatch as explanations for these controls, not all possible delivery causes.

[GitHub workflow notification documentation](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
confirms native notifications for triggered runs when notifications are enabled.
No API receipt/bounce proof is available in the inspected workflow evidence;
mail routing/filtering and actual receipt remain unverified, cause **UNKNOWN**.
[GitHub notification header documentation](https://docs.github.com/en/subscriptions-and-notifications/reference/email-notification-headers)
identifies `notifications@github.com` as sender. No mailbox contents accessed.

**Next single owner step:** in the mailbox used for GitHub notifications, search
all mail including spam/trash for `originmetric-monitoring`; report found / not
found only. This distinguishes mailbox filtering from apparent nondelivery without
requesting an address, headers, message content or screenshot. No new notification,
workflow, account-setting or production mutation performed.

Banner setup remains ACCEPTED; GPC NOT_EXPOSED / enabled-owner GPC NOT PASSED;
**formal G1 PENDING; data collection NOT PASSED; ingestion closed; P2 OPEN;
P3 NOT STARTED**. Scheduled backup, independent missing-run/dead-man, lifecycle
and deferred phone-independent recovery gaps retain their earlier evidence limits.


## Notification account mismatch verified / prior inference corrected — 2026-10-03

Owner clarifies that saved **GitHub + Email (Failed workflows only)** settings
were inspected on **brsctncnbrk7-byte**, whereas the controls were triggered by
**brsctncnbrk5**. Read-only API recheck of runs 37132327501, 37132330300 and
37133412117 confirms `workflow_dispatch`, completed/failure, actor and
triggering_actor **brsctncnbrk5** for all three.

[GitHub's native workflow notification rule](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
notifies the user who triggered the run when that user's notifications are
enabled. Applying this documented rule to the verified actors, the expected
account for these manual tests is **brsctncnbrk5**. Enabling email on
**brsctncnbrk7-byte** does not configure brsctncnbrk5 or redirect its native
triggered-run notification. No dedicated email-send/recipient-routing step exists
in the reviewed workflow. This establishes the account mismatch and expected
recipient account, not actual send/delivery or the email address used.

| Evidence | Corrected scope / outcome |
| --- | --- |
| Saved Actions Email / failed only | OWNER-REPORTED for brsctncnbrk7-byte only. |
| Test actor and triggering_actor | VERIFIED API: brsctncnbrk5. |
| Expected native manual-test recipient | brsctncnbrk5, conditional on its notification settings. |
| brsctncnbrk5 notification settings / mailbox receipt | NOT CHECKED. |
| Owner-reported nonreceipt | NOT_RECEIVED, not evidence of nondelivery to brsctncnbrk5. |

The prior entry's **“excludes actor mismatch”** and **“setting prerequisite
COMPLETE”** conclusions are corrected: the settings-account identity had not
been established. Historical observations are retained; their account inference
is superseded here. Email-delivery acceptance remains **NOT PASSED**.

**Next single owner step:** signed in as **brsctncnbrk5**, inspect notification
settings → System → Actions and report whether Email is enabled/saved. No new
notification, workflow dispatch, account-setting mutation or mailbox access.
Scheduled-run notification routing has separate creator/cron-editor/re-enabler
rules and is not inferred from these manual-test actors.

**Formal G1 PENDING; GPC NOT_EXPOSED; data collection NOT PASSED; ingestion closed;
P2 OPEN; P3 NOT STARTED.** No production application/config/DB changes.


## Correct-account controlled email-delivery retest — 2026-10-03

Owner confirms **brsctncnbrk5 → Actions → Email already enabled, Failed workflows
only selected**, and explicitly requests a new controlled failure test. Account
setting prerequisite is now **COMPLETE / OWNER-REPORTED for brsctncnbrk5**.
Auth API login was verified as brsctncnbrk5 before dispatch; existing uptime workflow
active. One manual `monitoring-failure-control` was dispatched at **20:45:12 UTC**
against `main` in `brsctncnbrk5/originmetric-monitoring`.

[Run 37152667292](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37152667292)
created at **20:45:14 UTC**, completed/failure; API verifies actor and triggering_actor
**brsctncnbrk5** and the intended **Controlled notification test (expected failure
only)** step failed. Setup succeeded and the safe summary completed. No actual
outage/backup failure, production mutation or dedicated mail-send step. This is
successful execution of the controlled failure path, **not email delivery PASS**.

**Email delivery remains PENDING_OWNER_RECEIPT.** Prior cross-account nonreceipt
is preserved separately. Next single owner action: check the mailbox receiving
brsctncnbrk5 notifications, including spam, for the new originmetric-monitoring
failure-test email; report received / not received only. No mail address or
contents requested. Native recipient is the triggering account under the previously
verified GitHub rule; actual dispatch/delivery by the mail system is not asserted.

**G1 PENDING; GPC NOT_EXPOSED; ingestion closed; data collection NOT PASSED;
P2 OPEN; P3 NOT STARTED.** Independent dead-man/missing-run and scheduled-backup,
lifecycle and deferred off-phone recovery gaps remain open even if receipt passes.


## Correct-account test email received / remaining operational evidence — 2026-10-03

Owner reports **“Geldi”**, the `originmetric-monitoring` failure notification
arrived **3 October 2026 23:45**, sender **notifications@github.com**. Correlated
with the explicitly requested new [control run 37152667292](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37152667292):
actor/triggering_actor brsctncnbrk5, expected failure, completion **20:45:27 UTC**.
Correlation uses the owner's direct response identifying this new control's email;
no message run-ID/header or mailbox was independently inspected. Owner timestamp
has **no supplied timezone**; 23:45 would match the run minute at UTC+03:00, which
is not assumed. Environment timezone Europe/Berlin is not substituted for the
owner's email clock. Sender is owner-reported, not authenticated-header proof.

**Email delivery for this controlled monitoring failure: PASS / OWNER-REPORTED.**
Correct-account enabled settings and actual receipt are now complete at their
reported source level. Earlier cross-account nonreceipt and pending retest files
are preserved; new `owner-receipt.json` records the superseding receipt. This does
not prove actual backup failure/missing-run alerts, independent dead-man coverage,
uninterrupted five-minute monitoring or delivery for every later run.

Read-only operational follow-up: local watchdog **FRESH_REMOTE_VERIFIED_BACKUP /
PASS**, independent missing-run monitor false. Its `email_delivery_verified=false`
field describes the local backup watchdog, not this independently reported GitHub
monitoring email. Backup timer **enabled/active**, LastTrigger empty, next
**2026-10-04 03:15 UTC**. First scheduled backup **PENDING**; inactive backup service
with no service execution timestamps is not scheduled-success evidence.

Next actionable independent item is the prepared **retention backstop no-spend
prerequisite** (§24/D-008). Existing private Actions review template remains
unactivated. Earlier account billing API access lacks required scope; current
[budget REST documentation](https://docs.github.com/en/rest/billing/budgets)
provides organization budget endpoints, not evidence for this personal account.
No new token/scope requested. [GitHub budget guidance](https://docs.github.com/en/billing/concepts/budgets-and-alerts)
and [setup instructions](https://docs.github.com/en/billing/how-tos/set-up-budgets)
confirm that Actions hard-stop budget enforcement requires Stop usage enabled;
alerts alone do not stop spending.

**Single owner step:** signed in as brsctncnbrk5, inspect Billing → Budgets and
alerts and report whether an **Actions $0 budget with Stop usage enabled** applies
to **originmetric-recovery** (account-wide or exact-repo coverage), or report absent.
This is a scoped existing-setting check, not permission to change global settings.
No private workflow activated, retention deletion, new alert/control, production
config/deploy/DB change or backup rerun. Independent dead-man remains separately
open; scheduled backup will be audited after its due time.

**Formal G1 PENDING; GPC NOT_EXPOSED / enabled-owner GPC NOT PASSED; ingestion
closed; data collection NOT PASSED; P2 OPEN; P3 NOT STARTED.** Populated test chain
and restore remain gated; deferred off-phone recovery is preserved.


## Recovery budget scope and activated independent VPS checks — 2026-10-03

Owner reports **brsctncnbrk5 account-wide Actions budget $0 / Stop usage Yes**.
Budget value/enforcement is **OWNER-REPORTED**; repository API independently
confirms active private `brsctncnbrk5/originmetric-recovery`, owned by that personal
account. [Documented account-wide budget scope](https://docs.github.com/en/billing/how-tos/set-up-budgets)
therefore covers this repository; this coverage conclusion is an inference from
verified ownership and owner-reported scope, not an independent billing API read.
No-spend prerequisite accepted at that evidence level. Existing account-wide
settings unchanged; no new credential, secret, service or payment setting.

Under existing D-008 activation authorization, installed reviewed expiry backstop
in private recovery main and set `RETENTION_BACKSTOP_READY=true`. Public helper
source pinned to full-suite CI-verified `2558928fa4b3f02929d66a14f17d9265c792192e`.
**Daily 03:45 UTC**; VPS backup timer **03:15 UTC** remains unchanged.
Three existing retention regression tests PASS. Private repository dry-run
[37153813356](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37153813356)
SUCCESS, then apply [37153955063](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37153955063)
SUCCESS: **0 expired candidates, 0 deletions, 2 protected records**. Positive deletion
and changed-asset protection are fixture-test evidence only; no real expired asset
was available. No unrelated phone recovery or current DB snapshot deleted.

Continued the next technical gap: added **Remote backup freshness watchdog** to
same private repo, scheduled **hourly at :15 UTC**, using repository job token,
no copied VPS/broad operator credential. Fetches bounded private release inventory,
uses existing exact DB ownership/asset metadata parser, selects latest verified
**capture timestamp**, and applies existing **26-hour** stale/missing policy.
A repeated readback cannot refresh an old dump. Missing verified backup, future latest capture, or inventory request failure
returns UNKNOWN/FAIL, not PASS. No request or write to production VPS/DB; GET-only
release inspection, no encrypted dump/manifest download or new hash verification.
Remote metadata integrity/readback claims remain at backup producer's recorded
source level. Four existing status tests and six inline integration cases passed:
fresh, stale capture despite refreshed verified_at, missing, future, pending-only,
and wrong-private-target rejection.

Initial hosted [37154103588](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37154103588)
failed **UNKNOWN / NO_VERIFIED_BACKUP** with `contents:read`: GitHub hid draft
releases. This is a visibility failure, **not actual backup loss or missing-run
acceptance**. [GitHub draft release documentation](https://docs.github.com/en/rest/releases/releases#list-releases)
requires push access for draft listings. Job-local `contents:write` fixes visibility;
checker code still performs GETs only, checkout persists no token and Actions are
pinned. No new PAT or account access granted. A brief initial workflow-registration
404 was retried only after API confirmed registration; no duplicate watchdog run
was dispatched by that failed call.
Corrected hosted [37154193166](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37154193166)
**SUCCESS / FRESH_REMOTE_VERIFIED_BACKUP**. Current release-count/metadata checks
prove real remote read access from GitHub runner, not a newly scheduled backup.

**Configured and manually verified technical controls**, not complete canonical
lifecycle/dead-man acceptance. GitHub schedules/account/quotas/provider can fail;
$0 hard stop protects spending but may block jobs after included quota. A daily
expiry job removes >=90-day owned assets only when it runs: it cannot guarantee
strict <=90-day deletion during scheduler/account/provider failure. No native
storage lifecycle is established. Hourly freshness is independent of VPS execution
but depends on GitHub; it cannot detect its own missed run/provider outage. Actual
backup start/failure, missed-backup delivery, scheduled successful runs and all-provider
failure behavior remain unverified. Do not mark these missing proofs PASS.

**Next single owner action:** report receipt/nonreceipt of the already generated
`originmetric-recovery` **Remote backup freshness watchdog** failure notification
for initial run **37154103588**. This verifies detector-error notification delivery
only; it is not a synthetic missing-backup test or actual production backup failure.
No further control notification is sent. No address/content/screenshots requested.
Scheduled backup evidence will be inspected after 2026-10-04 03:15 UTC; first
scheduled expiry and freshness results likewise remain PENDING.

**Formal G1 PENDING; GPC NOT_EXPOSED / enabled-owner evidence NOT PASSED;
data collection NOT PASSED; ingestion closed; P2 OPEN; P3 NOT STARTED.**
Application/env/nginx/deploy/DB/volumes and existing age key unchanged. Deferred
off-phone recovery unchanged. Prepared workflow copies and safe private evidence
are retained for review; full application suite was not rerun for workflow-only work.


## Recovery detector-error email matched / next scheduled evidence — 2026-10-03 UTC

Owner reports receipt **4 October 00:09**, subject **“Run failed: Remote backup
freshness watchdog - main (5f0b38a)”**, naming run **37154103588**. Read-only API
matches workflow **Remote backup freshness watchdog**, branch **main**, full SHA
`5f0b38a94b7edbd5514d0e2076037f27eab5e73e`, and completed/failure at **3 October
21:09:34 UTC**. Explicit run identification plus matching subject SHA/name/branch
correlates the owner's email with this exact [run](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37154103588).
Owner timezone remains unspecified; 4 October 00:09 matches the UTC completion
minute/date rollover if UTC+03, not assumed. No new sender value, header or mailbox
inspection was supplied; previous message sender evidence is not transferred here.

**Delivery of this detector-error email: PASS / OWNER-REPORTED.** The draft-visibility
UNKNOWN failure remains a detector error, not an actual missing backup. Corrected
freshness manual run PASS remains valid. This closes the pending receipt item for
37154103588 only; actual stale/missing-backup and production backup-job failure
notification acceptance remain **NOT VERIFIED**. No repeated notification/control.

Continued next operational evidence with read-only checks at **21:18 UTC**:
local backup watchdog **FRESH_REMOTE_VERIFIED_BACKUP**, timer **enabled/active**,
LastTrigger empty; **first scheduled backup PENDING / NOT DUE** at audit, next
**2026-10-04 03:15 UTC**. Private recovery expiry and freshness workflows both
active; no schedule-event run returned yet. **First scheduled expiry/freshness
completion PENDING**, not PASS from installed schedule/manual runs.
Public HTTPS [scheduled run 37154300615](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37154300615)
created **21:12:40 UTC**, completed/success. The preceding listed scheduled samples
were **17:37:38** and **12:49:14 UTC**; this sparse result history does not prove
continuous five-minute availability or independent alarm delivery for missed
observer schedules. No schedule reliability guarantee or missing-run PASS inferred.

**Next open evidence:** actual scheduled freshness/expiry outcomes and first real
03:15 UTC backup → remote readback. These checks await external scheduled runs;
no immediate owner action is required. Audit after due time must check actual
service execution, verified new snapshot/readback and cleanup rather than timer
state alone. Keep actual missing-backup/failure notification, GitHub-independent
dead-man, strict <=90-day provider/job-failure guarantee and deferred off-phone
recovery gaps explicit. Existing G1 owner-GPC gap remains unchanged; no new
browser or completed owner step is requested again.

No production config/deploy/DB/volume/timer change, new backup, workflow dispatch,
notification or application regression run. **Formal G1 PENDING; GPC NOT_EXPOSED;
data collection NOT PASSED; ingestion closed; P2 OPEN; P3 NOT STARTED.**


## Closed-ingestion G1 and end-to-end preparation — 2026-10-03

Continued canonical P2/§28 acceptance work without waiting for scheduled backup
or expiry. No scope change, data-gate opening, deploy or production data mutation.
Existing owner/production age identity/recipient is preserved; no such key generated, read,
transferred or rotated. Off-phone secret/account recovery stays **DEFERRED**.
Owner GPC stays **NOT_EXPOSED / enabled-owner acceptance NOT PASSED**.

### Completed preparation and verified technical evidence

`prepare-p2-acceptance.mjs` checks closed-preview config and zero production fact
baseline, consumes original explicit banner acceptance and GPC owner records,
and writes a new mode-600 private labelled scenario. No execution/approval override
flag; `productionWritesAllowed=false`. It prepares visit URL, expected API codes,
labelled test-only payment/renewal/refund amounts and exact subscription/refund
relationships, staged private ID/key capture and snapshot/phone requirements.
`.runtime/p2-prepared-20261003T214706427Z/plan.json` is preparation, not an actual
production visit or an approval to open routes. No server key is in the plan.

Extended `gate-g1.mjs --technical-only --rehearse-dogfood` against **current deployed
image** and matching live tracker/source `e74bfc1fcc6e404be977feee059dc1d3c78d170c`.
Safe evidence: `.runtime/g1-1791064358867-3123104/summary.json` and regressions log.
**98 tests across 9 files PASS** (including revenue and attribution regressions).
Technical G1 **PASS / overall PENDING**. Owner banner is ACCEPTED from the original
explicit private record; the obsolete generic owner-banner request is removed
when that record is supplied. Cloudflare direct API/export source limit is listed
separately; prior saved-panel evidence retained. Enabled owner GPC still open.

`rehearse-dogfood.mjs` restricts application origin to loopback and container names
to the gate's disposable prefix. API/server key stays in memory, never a browser
page or artifact. Browser only talks to fixture origin. Verified:

| Isolated control | Observed outcome |
| --- | --- |
| Required consent and visit persistence | No request/visitor before consent; consented session persisted for exact unique campaign, visitor and p2-test/controlled source. |
| Trusted identify and exact retry | 200 linked / 200 duplicate; one customer and trusted server_identify link. |
| Payment / exact retry / conflicting amount | 201 / 200 / 409; conflict and retries create no extra facts/customer/link. |
| Renewal / linked refund | 201 / 201; exact external original-payment ID linkage and immutable acquisition/source. |
| Amounts and test labels | Two 2900-minor USD payments, one 500-minor refund; payment 5800, refund 500, net 5300; all test=true. |
| Private internal result | Missing/wrong token 404; valid fixture token 200 with source/status visible. |
| Withdrawal and logs | Visitor removed, no new post-history sending; no key/visitor/customer/label/internal-token leak in fixture app logs. |
| Populated fixture restore | In-memory custom dump → network-none/tmpfs PostgreSQL; exact ten-table counts, schema/migrations, 14 FKs, 0 orphans, freshness/source/acquisition/totals/identities/payload digests match. |
| Tampered semantic controls | Wrong source, untrusted-link result, refund total and stale revenue timestamp each rejected by receiver validator. |

No encrypted off-VPS snapshot or phone decryption is involved in this rehearsal.
It is **ISOLATED_REHEARSAL_ONLY**, production data acceptance **NOT PASSED**;
actual encrypted populated backup/phone restore **NOT RUN**. Final cleanup removed
all owned fixture containers/network; production all-ten-table counts and protected
container IDs/starts/restarts/mounts plus env/nginx/systemd/plan hashes unchanged.
No production volume was restored/replaced and no real customer/revenue claimed.

### Populated acceptance can no longer pass on counts alone

`restore-phone.py` now requires private `acceptance_assertions` for any newly
requested populated acceptance restore. Its fixed, validated project/campaign
query checks exact customer/visitor/session identities, trusted session linkage,
credited/first-touch source and acquisition, original-payment refund linkage,
individual 2900/2900/500 payment/refund details and subscription, three semantic
payload hashes, per-currency totals/test flags and latest received timestamp.
These must match the pre-backup baseline and canonical test shape. Missing or
changed baseline/semantics cannot PASS; raw private values are not printed.
Existing verified empty manual restore and basic receiver behavior remain valid.

`capture-p2-acceptance.py` prepares the future actual restore's metadata using
read-only production queries. Requires the registered originmetric.app project
and complete uniquely labelled chain, captures ten counts/private semantic metrics,
and refuses non-test revenue. Before/after captures must agree; backup result must
be remote-readback verified **inside** that UTC window, with matching deployed
application/schema source. Only then can it produce the new private snapshot JSON.
No backup is triggered and no SQL writes or phone exit results are fabricated.

**Six semantic/snapshot-window unit tests PASS** with mismatch, missing/future/non-UTC
baseline, invalid scope, changed counts/source, stale/unverified/out-of-window
backup and typed-metric rejection controls. Negative real empty-production check
returned **PREPARATION_BLOCKED**, wrote no populated baseline/snapshot and issued
no production SQL writes. Safe result stored alongside the prepared plan.
Commands and exact future capture protocol updated in the
[runbook](../runbooks/P2_DOGFOOD_ACCEPTANCE.md#closed-ingestion-preparation-and-isolated-rehearsal).
Lint/typecheck/format checks PASS; script syntax checked. Subprocess failure artifacts retain only tool/exit/failure-class metadata, never
SQL/test diagnostics that might contain unknown generated identities or keys.
Candidate and full committed-history redacted secret scans PASS.
No application source, tracker bundle, migration or production build/deploy change.

**Full CI SUCCESS** for code `f959cd31fe441b0b0c531c7cd40a393c15dce7c4`,
[run 37157304870](https://github.com/brsctncnbrk5/originmetric/actions/runs/37157304870).
GitHub API independently verifies the exact head SHA, completed/success state and
all verification steps: full-history secret scan, lint/format/types, migrations
and schema, unit/real-DB tests, tracker budget/build, Playwright/demo, package
script syntax and production Docker/consent dogfood/synthetic encrypted restore.
CI creates only its disposable synthetic encryption key, not an owner/production
key; this is not actual populated off-VPS backup or phone restore acceptance.
The duplicate push-trigger run was concurrency-cancelled, not a failed control.
Code committed and pushed to the assigned preparation branch; local/remote SHA
both `f959cd31fe441b0b0c531c7cd40a393c15dce7c4`, clean tree at that publication.
Private audit: `.runtime/p2-prepared-20261003T214706427Z/code-publication.json`.
This final evidence update is a documentation-only commit; its post-push SHA and
clean-tree audit is recorded alongside the preparation artifacts, avoiding a
self-referential commit hash in the document.

### Remaining canonical acceptance (no missing proof inferred)

| Item | Current state |
| --- | --- |
| Formal six-item G1 / actual owner GPC | Technical PASS; banner ACCEPTED; owner GPC NOT_EXPOSED, enabled-owner evidence NOT PASSED; overall G1 PENDING. |
| Actual consented owner visit → trusted production chain | NOT RUN; six production fact tables remain 0. Scenario, assertions and isolated rehearsal ready. Gate remains closed. |
| Actual populated encrypted backup and phone restore | NOT RUN; earlier empty manual restore remains verified; new semantic capture/receiver prepared. |
| First scheduled backup/expiry/freshness | PENDING until actual event/service/readback results; no wait or manual backup substitution in this task. |
| Actual backup failure/missing-run delivery; independent dead-man | Existing monitoring/detector-error email receipts confirmed at owner source; real backup failure/missing and GitHub-independent observer alarm still unverified. |
| Retention/lifecycle guarantee under job/account/provider failure | Backstop configured/manual execution verified, 0 deletions; strict <=90-day/native lifecycle and schedule reliability still open. |
| Phone-independent recovery | DEFERRED by owner; existing key decision and vault/paper/attachment evidence preserved. |
| Provider source limits | Earlier Cloudflare saved-panel/cache TTL evidence retained; direct API/original-export unverified, not requested again. |

**Formal G1 PENDING; data collection NOT PASSED; ingestion closed; P2 OPEN;
P3 NOT STARTED.** All currently authorized closed-ingestion preparation described
above is complete; no owner decision is required for those completed actions.
Actual production execution and missing external/owner evidence remain staged,
not silently approved or waived.


## First applicable actual G1 test prepared — 2026-10-04 local

Canonical G1 item 1 has the existing explicit owner banner acceptance and
technical deny/allow/withdraw controls. First applicable additional real test:
**operator browser actual-domain consented persistence and withdrawal**, not
another banner confirmation or a repeated unavailable GPC reference check.
The canonical item 2 native owner test is presently unavailable (NOT_EXPOSED),
not waived. Normal public go-live remains blocked by formal G1.

Prepared a proposed controlled-traffic exception requiring one specific owner
approval. No activation or public data-gate opening has occurred. Exact scope:
one fresh operator browser, registered originmetric.app test project and prior
unique private campaign, **maximum 600 seconds**, `/api/v1/e` only, POST with exact
origin/dogfood referrer and private access cookie. Other visitors cannot enter the
forwarding path without that private token; other APIs remain closed. The token
is temporary infrastructure access, not a new API key or age identity. Bootstrap
and candidate artifacts are root-only; token/headers/bodies are never published.
Expected one labelled event/session, zero customers/link/revenue/attribution.
No real customer or monetary event is claimed; test facts retained for later
controlled attribution/backup, with no production deletion/truncate.

Scripts: `prepare-controlled-consent.py` stages an exact closed-config backup,
private candidate/deadline template and protected-resource baseline. Owner-approved
activation will arm a scoped systemd rollback before nginx mutation; the server's
own epoch-second expiry caps cookie replay even if that timer fails. Immediate
manual rollback and the actual runner's `finally` restore the closed route;
syntax/reload failure also restores the saved config. Refuse reused windows or
changed config; refuse overwriting unrelated subsequent changes. No claim is made
that the rollback timer has been installed/tested on production yet.

`accept-controlled-consent.mjs` is ready, **NOT RUN**. It observes fresh real-domain
browser state/request counts before consent and after deny, verifies exact SQL
persistence after Allow, and checks cleared state/no new requests/facts after
withdrawal/history navigation. Always closes its browser, restores the route and
compares protected resources. Safe booleans/counts only; no native GPC injection,
no owner-phone observation, no actual restore claimed. Failure cannot become PASS.

**Preparation verification:** 14 loopback-only nginx controls PASS: missing/wrong
cookie, wrong origin/page/method, valid forwarding, oversized body, and all denied
again after server expiry. Initial long nginx parameter was rejected and corrected
by chunking expiry rules; failed attempt is not PASS. Current complete candidate
nginx syntax PASS. Production config still equals exact closed backup; six fact
tables remain zero. Private directory pointer:
`.runtime/p2-consent-window-last-path`; candidate/preparation/protected evidence
stored there. No access token appears in tracked files. JavaScript lint/syntax, Python syntax,
format and diff checks PASS; redacted candidate secret scan PASS. Publication
and local/remote SHA audit are kept in this private preparation directory; no
new full-CI or actual-test success is inferred from these preparation checks.

**Actual acceptance NOT RUN; awaiting one bounded owner approval.** This test may
only establish actual-domain operator scope; it does not complete formal G1,
waive enabled-owner GPC, start the full revenue chain or open uncontrolled traffic.
GPC NOT_EXPOSED; phone-independent recovery DEFERRED; current age key/recipient
unchanged; PUBLIC_G1_READY=no; G1 PENDING; P2 OPEN; P3 NOT STARTED.


## Actual controlled G1/1 completed and closed — 2026-10-04 local

Owner explicitly approved the staged isolated-browser/current-test-project scope,
`/api/v1/e` only, at most ten minutes, with closure verification and actual evidence.
Decision D-009 records that one-time controlled-traffic authorization; no formal
G1 waiver or public go-live. Private explicit approval is retained as
`.runtime/p2-consent-window-538320244341/owner-approval.json`.

**Actual test PASS — ACTUAL_DOMAIN_OPERATOR_SCOPE_ONLY.** A fresh isolated existing
Chromium visited the actual originmetric.app domain via the private one-time
access path. No fixture app/DB, native GPC injection or owner phone observation
was used. Exact running application/image and registered test project unchanged.
Cookie-bearing access was restricted to POST/exact origin/dogfood referrer on
`/api/v1/e`; other APIs remained closed and `PUBLIC_G1_READY=no` remained set.
The active nginx file used root-only permissions to protect the temporary access
token; rollback restored the normal closed file. No age key/recipient change.

| Actual observation | Outcome |
| --- | --- |
| Fresh page / before consent | Zero outbound event requests, zero `om_*` cookies/localStorage, visitor absent. |
| Reddet | Same zero state/request results. |
| İzin ver | HTTP 202 plus exactly one independently SQL-verified event/session for the prepared campaign and p2-test/controlled source. 202 alone not used as proof. |
| İzni geri çek | `om_*` state cleared, visitor absent; history navigation produced no new event request or production fact. |
| Fact totals | Events 1, sessions 1; customers 0, trusted links 0, revenue 0, attribution 0. All new browser facts belong to the registered labelled test scenario; retained, not deleted/truncated. |
| Cleanup | Isolated browser closed; exact closed nginx config restored/reloaded; protected production container/config metadata unchanged. |
| Fresh closure probe | Node public POST with formerly valid access cookie returned 202/drop; facts unchanged. |
| Actual-window sensitive log scan | PASS in memory: no private visitor/session/event identities, registered site key or temporary access token printed in application logs. Raw logs/values not published. |

Activation **2026-10-03 22:52:58 UTC**, immediate closed restoration
**22:53:05.982 UTC**: **7.982 seconds**, below the 600-second authorized maximum.
Scoped systemd timer independently verified active after being armed **before**
nginx mutation. After successful immediate rollback/closure, that exact timer was
stopped; no claim that timer expiry executed or that scheduled recovery passed.
Server epoch expiry remains additional defense validated in the earlier isolated
preparation; no redundant ten-minute live wait occurred.

Private actual artifacts in `.runtime/p2-consent-window-538320244341/`:
`activation.json`, `armed-timer.log`, `actual-result.json`, `rollback-result.json`,
`execution-audit.json`, `final-closure-proof.json`. Runner exit 0, outer rollback
exit 0, closed config bytes match. A separate Python-client public closure probe
received 403 and was **not** treated as 202/drop proof; the fresh Node probe and
runner's separate Node closure probe both returned 202 with no new facts. The
403 cause was not determined or bypassed. No secret URL/cookie/body/identity is
in the public evidence.

This actual result resolves the additional operator actual-domain G1/1 test;
prior explicit owner banner acceptance remains at its original source level.
Owner-phone storage/network is still unobserved and native enabled-owner GPC
remains NOT PASSED / reference NOT_EXPOSED. Canonical G1 items 3–6 retain prior
reviewed technical evidence/provider source limits, not fabricated new acceptance.
No identify, payment/renewal/refund, populated encrypted backup or phone restore
was run. Preserve the prepared campaign/test fact baseline for any separately
authorized later chain; earlier zero-fact statements describe historical stages.
The original zero-baseline preparation command cannot be rerun as if facts were
still zero. No data deletion is needed for rollback.

**Ingestion CLOSED AGAIN; PUBLIC_G1_READY=no; formal G1 PENDING; GPC NOT_EXPOSED;
phone-independent recovery DEFERRED; existing age key unchanged; P2 OPEN;
P3 NOT STARTED.** Actual execution cannot approve another window or the full
revenue chain. Completion and post-push SHA/clean-tree audit recorded privately;
no new full CI result inferred from this acceptance run.

## GPC evidence reconciliation / closed-ingestion controls — 2026-10-04 local

Canonical basis: locked plan §8.1 and §28 G1 item 2 require
`navigator.globalPrivacyControl === true` to block storage and sending by default,
including after `consent(true)`, with the explicit `data-gpc="ignore"` override.
§28 calls for implementation and passing tests; it does not explicitly require a
particular physical browser. The current formal review additionally retains the
open enabled-owner browser evidence. That requirement is not silently removed
because the technical tests pass or because a browser exposes no signal.

**NOT_EXPOSED cause verified at its actual evidence level.** Original private
owner record `.runtime/p2-gpc-not-exposed-20261003T180342Z/owner-result.json`
states Android Chrome, reference **Client-side detection: DOM signal not present**,
OWNER_REPORTED, enabled-owner false, server-side `Sec-GPC` NOT_CHECKED. This
explains the recorded classification: the reference did not observe the DOM
property, rather than observing an enabled true signal. Browser version, settings,
and the deeper reason for the missing property were not captured; neither a
browser-wide support claim nor a server-header conclusion follows. The existing
tracker checks strict true; absent/false do not activate its GPC block. Required
consent remains a separate protection. The banner's ordinary Allow text cannot
distinguish absent from false and cannot certify GPC.

The later owner record
`.runtime/p2-gpc-unavailable-20261003T200656Z/owner-result.json` explicitly reports
no other available GPC browser. Preserve that answer: no repeated unavailable
Chrome reference check, new browser/extension, experimental setting or service
was requested or installed.

Focused verification **3 October 23:29:58–23:30:08 UTC** used the existing
`/usr/bin/google-chrome`, fresh isolated contexts and the current public tracker.
Source remains `e74bfc1fcc6e404be977feee059dc1d3c78d170c`; tracker SHA-256 remains
`b629914f93296cbb78d4d09e940c0e0ff78139b59f9a3008ecbae68a9eb6d7e9`, equal to the
previous deployed-image gate evidence. No production source change or deployment.

| Focused check | Result / acceptance limit |
| --- | --- |
| Operator browser, unmodified native signal, actual `/dogfood` | DOM property absent, outgoing navigation `Sec-GPC` absent, zero tracker state/requests before consent. Allow deliberately not clicked. This is operator evidence only; it does not inspect the owner's Chrome or establish GPC success. |
| Actual `/dogfood`, explicitly injected DOM true | Required consent present, no ignore override. Allow displayed the privacy-blocked message. Zero visitor identifier, `om_*` cookies/localStorage/sessionStorage and event request attempts; still zero after pushState/replaceState/popstate/hashchange and reload plus Allow. PASS_INJECTED_ONLY. |
| `data-gpc="ignore"`, deployed bytes in isolated intercepted origin | GPC true, required-consent pre-Allow state/requests zero; Allow created an identifier and exactly one intercepted event request. Withdrawal cleared state. PASS_ISOLATED_INTERCEPTED_ONLY; no production request or DB acceptance. |
| Closed-access/resource proof | Actual closed nginx file exactly equals the G1/1 rollback copy before/after, `PUBLIC_G1_READY=no`, protected container/config metadata unchanged. Six production counts unchanged: events 1, sessions 1, customers/links/revenue/attribution 0. |

The live test intercepted any `/api/v1/e` regression attempt before transmission,
while separately counting attempts (zero). Thus closed-server dropping cannot
explain the observed zero sends. The override origin and all its responses were
intercepted, never forwarded to production. The runner initially stopped before
browser checks on an incorrect nginx filename, then on an unavailable default
Playwright binary; corrected to the existing nginx path and installed Chrome.
Those setup attempts are not PASS runs and did not open access. Final runner
exit 0. Private runner and safe-value result:
`.runtime/p2-gpc-review-20261004/verify.mjs`, `result.json`. No identifiers, site
keys, temporary access token, raw browser headers or logs published.

| G1/P2 item | Consolidated status after this review |
| --- | --- |
| G1/1 required consent / withdrawal | PASS actual-domain operator scope; prior owner banner setup ACCEPTED. Phone storage/network remains unobserved. |
| G1/2 default GPC + configurable ignore | Technical PASS retained and focused controls PASS. Physical enabled-owner signal/actual behavior NOT PASSED; original NOT_EXPOSED retained. |
| G1/3 body/schema/origin/dedup/failure isolation | Prior matching-source technical PASS retained; no new regression-suite claim. |
| G1/4 rate limits / ceiling / daily cap / edge rule | Prior technical PASS and accepted saved-panel evidence retained; direct provider API/original-export verification remains unverified. |
| G1/5 log redaction | Prior technical PASS and actual G1/1 window sensitive-log PASS retained. |
| G1/6 browser trust boundary | Prior technical PASS retained; production customer/link/revenue/attribution counts remain zero. |
| Actual persisted full visit → identify → revenue → attribution chain | NOT RUN; only the separately approved G1/1 event/session exists. |
| Populated encrypted backup / actual phone restore | NOT PASSED; fixture rehearsal and empty restore do not close this item. |
| Recovery/monitoring | Existing manual upload/readback and labelled owner-reported email controls retained. Scheduled backup/retention/freshness completion, actual backup-failure/missing-run delivery, GitHub-independent dead-man and strict lifecycle acceptance remain unverified by this review. |
| Off-phone secret/account recovery | DEFERRED; current age identity/recipient preserved, no key read/generation/rotation. |

**Missing physical validation:** first observe a real enabled DOM true signal,
then on the actual dogfood page verify no ignore attribute, click Allow and
observe zero tracker identifiers/storage and zero event request attempts, including
history/reload. A privacy-blocked UI message alone is only owner UI evidence;
native true at a reference alone is signal evidence. Neither alone closes the
complete behavior proof. An absent or false signal cannot receive enabled-GPC PASS.

**Conditional single owner step:** when a physical browser with GPC already
enabled becomes available, open
[the existing reference page](https://global-privacy-control.vercel.app/) in that
browser and report its **Client-side detection** value and browser name.
No action on the currently unavailable Android Chrome setup is needed now.
`true` permits the next actual-site behavior verification; false/absent leaves
acceptance open. This is conditional on a newly available capable browser, not a
request to repeat the completed Chrome check or install a dependency.

**Access stays closed.** No temporary test access is necessary for signal/zero-send
GPC proof; no reopening proposed or authorized. Any future positive persisted
traffic would require its own stated scope and authorization; D-009 was exhausted.
**Formal G1 PENDING; GPC NOT_EXPOSED / enabled-owner NOT PASSED;
PUBLIC_G1_READY=no; recovery DEFERRED; current age key unchanged; P2 OPEN;
P3 NOT STARTED.** Documentation-only publication; commit/push and remote SHA
equality audit will be kept in `.runtime/p2-gpc-review-20261004/publication.json`.


## Isolated full-chain acceptance and open-item audit — 2026-10-04 local

Owner explicitly requested completing GPC-independent P2 work, first the full
revenue-attribution acceptance using plan-compatible isolated test data, with no
production customer/revenue impact. This authorizes the isolated validation below;
it does not reuse D-009, open public routes or waive physical-browser GPC evidence.
Canonical §26 end-to-end proof and §28 controlled/synthetic traffic are the basis.
Locked plan, Recovery DEFERRED and current age identity/recipient remain unchanged.

**Isolated full-chain acceptance PASS.** Ran
`npm run gate:g1 -- --technical-only --rehearse-dogfood` against the current deployed
image `e74bfc1fcc6e404be977feee059dc1d3c78d170c` cloned into a disposable app and
PostgreSQL database, with loopback-only ports and intercepted off-origin requests.
Live tracker SHA-256 still
`b629914f93296cbb78d4d09e940c0e0ff78139b59f9a3008ecbae68a9eb6d7e9` matches fixture
bytes. Fresh uniquely labelled fixture customer/subscription/events; all three
revenue events `test=true`, USD only. Production secrets/data are not cloned.

| Acceptance assertion | Verified result |
| --- | --- |
| Required consent → session | No request/visitor before consent; Allow 202 plus SQL exact visitor/session/campaign and p2-test/controlled source, not HTTP alone. |
| Trusted identify | 200 linked, exact retry 200 duplicate; SQL server_identify link joins the credited session/customer. |
| Initial payment / retry / conflict | 201 / 200 / 409; after retry/conflict one payment, one customer, one trusted link. |
| Renewal / refund | 201 / 201; refund SQL points to original external payment event; acquisition fields unchanged. |
| Revenue facts | Exactly 2 payments + 1 refund, test-only USD; payment 5800, refund 500, net 5300 minor units independently checked by SQL. |
| Internal result | Missing/wrong token 404, valid token 200; rendered table has exactly one row with the exact test customer, attributed status and p2-test source. No incidental HTML word matching accepted as sole result proof. |
| Withdrawal / logs | Visitor cleared, no new send after history navigation; fixture logs contain no checked secrets/private identities. |
| Fixture restore | In-memory dump to network-none/tmpfs receiver; ten counts, schema/migrations, freshness, trusted identities/payload hashes and semantic attribution/totals match; 14 FKs, zero orphan rows. Four changed source/link/refund/freshness controls rejected. |
| Production preservation / cleanup | All ten table counts and protected container/config metadata unchanged; all owned fixture app/DB/restore containers and network removed. Production event/session 1/1; customer/link/revenue/attribution 0/0/0/0. |

Strengthened the existing reusable isolated runner with exact rendered row and
independent SQL net checks, and an explicit `isolatedChainAcceptance: PASS` evidence
field. No product code/deployment changed. Private final gate evidence:
`.runtime/g1-1791070917346-3174806/summary.json` and `regressions.log`;
**98 tests / 9 files PASS**, technical gate exit 0, overall **PENDING**.
The GPC check in that run injects true and remains technical evidence only.

**Other open items reconciled at 3 October 23:41–23:42 UTC:** local read-only
watchdog reports FRESH_REMOTE_VERIFIED_BACKUP. Daily timer enabled/active with
empty LastTrigger, service execution timestamps empty; default Result=success /
status=0 does not prove a service execution. First real scheduled backup is
**NOT DUE**, next **4 October 03:15 UTC** (05:15 CEST). Existing private operator
GitHub auth successfully queried scheduled recovery Actions: empty list. Initial
default gh auth returned 404; not interpreted as deleted repository/no runs.
No auth/settings/schedule change or dispatch. Public monitoring still returns
latest scheduled success [37154300615](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37154300615)
at 21:12 UTC; sparse successful samples cannot prove uninterrupted five-minute
monitoring. No waiting for the due time or substituting a manual backup.

| P2 item after this task | Actual status / remaining evidence |
| --- | --- |
| Full chain in isolated deployed-image fixtures | COMPLETE / ACCEPTANCE PASS at isolated scope, including rendered internal result and USD net. |
| Actual consented production visit → trusted revenue attribution | OPEN / NOT RUN. Existing actual-domain G1/1 event/session retained; no production customer/revenue write. Fixture acceptance cannot close canonical real-site exit criterion. |
| Physical real GPC | OPEN / NOT PASSED; original Android Chrome NOT_EXPOSED and owner report of no alternative browser retained. Require native true plus actual-site zero identifiers/storage/event attempts after Allow/history/reload. Injected checks do not substitute. |
| G1/1 and G1/3–6 | Prior actual-domain operator consent PASS, owner banner acceptance and matching-source technical evidence retained. Owner-phone storage/network and direct Cloudflare API/original-export limits remain explicit. G1 overall PENDING. |
| Populated encrypted backup / actual phone restore | OPEN / NOT RUN; isolated populated restore above is additional technical evidence. Earlier actual empty phone restore remains verified. No backup/key/phone action in this task. |
| First scheduled backup / remote expiry / freshness | OPEN: backup not yet due; no scheduled recovery run returned. Require actual trigger/service result and new remote readback; manual results and configured timers do not substitute. |
| Alarm delivery and monitoring | Existing owner-reported monitoring failure and detector-error emails retained; actual backup-failure/missing-run delivery and GitHub-independent dead-man OPEN. No test notification sent. Continuous five-minute coverage unproven. |
| Strict retention/lifecycle under provider/account/scheduler failure | OPEN; configured/manual tested backstop is not a strict 90-day independent lifecycle guarantee. No Release deletion in this task. |
| Phone-independent secret/account recovery | DEFERRED by owner, not changed to PASS or re-requested; existing age key preserved, no key read/generation/rotation/transfer. |

Checks: lint, typecheck, format PASS; deployed-image 98-test regression suite plus
browser/API/SQL/restore acceptance PASS; backup policy 17, local status 4,
retention 3, restore acceptance 6 and public observer 7 tests PASS (**37 controls**).
Expected lock-refusal output in backup policy tests is a negative control, not an
actual backup failure. No full new CI result is inferred from these local checks.
Diff/secret scan and commit/push/remote SHA audit are recorded with publication
under `.runtime/p2-chain-review-20261004/`; operational audit `audit.json` is private.

**Next owner action, conditional on availability:** use a physical browser with
real GPC enabled, report browser name and native Client-side detection at the
existing reference page; then complete actual-site zero-storage/zero-send behavior
proof. No immediate action on the unavailable Chrome setup, repeated banner
confirmation, installation or general approval is required. Ingestion stays
closed; zero-send GPC proof needs no access window. Production chain/populated
phone drill remain separately scoped open work.

**PUBLIC_G1_READY=no; G1 PENDING; physical GPC OPEN; Recovery DEFERRED; existing age
key unchanged; P2 OPEN; P3 NOT STARTED.**


## Publication AssertionError audit — 2026-10-04 local

The first post-push Python publication audit stopped at
`assert local == remote and clean`. **SHA equality was true; working-tree
cleanliness was false.** The immediately following diagnostic showed only
`?? scripts/vps/__pycache__/`, while local HEAD and the remote assigned branch
both equalled `53648a255de00198fe8405f7191a9fc49de77738`.
The earlier operator audit imported `github-backup.py` without disabling Python
bytecode generation, creating `github-backup.cpython-312.pyc`. This was an audit
artifact, not an application change or failed attribution/restore assertion.

The original turn removed **only that generated file**, removed its empty parent
directory, and reran the publication audit with `python3 -B`. Final evidence
`publication.json` at 3 October **23:45:34 UTC** records SHA equality and clean
working tree. The failed first attempt is not counted as PASS. Its additional
`apport` FileNotFoundError was a secondary exception-hook error: the hook tried to
stat `/opt/originmetric/-`, because the Python program was supplied through stdin.
It was not a second application acceptance failure.

Owner-requested follow-up at **23:51:33 UTC** reran only the relevant publication
checks, with separate assertions for SHA equality, working-tree cleanliness and
cache absence. All PASS at the original published head: `git status --porcelain
--untracked-files=all` empty; `scripts/vps/__pycache__/` absent; local/remote SHA
identical. No files needed deletion in the follow-up. Private evidence:
`.runtime/p2-chain-review-20261004/assertion-review.json`. Python audit commands
use `-B` to avoid generating another bytecode artifact.

**Acceptance impact:** the initial publication-cleanliness check failed and
required cleanup before publication could be reported fully verified. Cleanup
and the original rerun resolved it; this follow-up independently reconfirms the
result. Retained gate evidence remains isolated-chain PASS, technical PASS,
overall PENDING, production facts/protected resources unchanged and fixtures
removed. No browser, revenue, restore or broad regression suite was rerun for
this publication-only issue. This documentation correction is published in a new
commit; its final SHA/clean-tree/cache audit is stored privately as
`assertion-review-publication.json`.

**Physical real GPC OPEN / NOT PASSED; Recovery DEFERRED; existing age key
unchanged; ingestion closed; G1 PENDING; P2 OPEN; P3 NOT STARTED.** No key,
production-data, deployment, access-window or notification operation occurred.


## D-010 — Independent P3 development while P2 acceptance remains open — 2026-10-04

Owner explicitly decided not to wait for backup evidence and removed the previous
P3 prohibition. Recorded in DECISIONS and STATUS. Canonical P3 is **Accounts,
workspaces, projects, keys (tenancy)**, dependencies P2 (or P1b when deployment is
delayed) plus U1. Scope and exit criteria are unchanged. Independent scoped
operator data/key primitives, internal-page integration, lint guard and isolated
attack tests are completed; full auth/membership/UI/two-account acceptance remain
OPEN. [P3 report](P3_TENANCY_FOUNDATION.md) records tests and technical boundaries.

All missing P2 criteria from the latest full-chain audit remain OPEN: physical
native GPC; actual production trusted revenue chain; populated encrypted backup
and phone restore; first scheduled backup/readback and scheduled retention/freshness
proof; actual backup-failure/missing-run email and independent dead-man; strict
lifecycle. No new operational proof was collected for these gaps and configured
or manual checks are not reclassified as scheduled PASS. Phone-independent
recovery remains DEFERRED. Existing empty manual restore and isolated full-chain
acceptance retain their precise evidence scope.

No deployed application/production-data mutation, temporary access, notification,
backup run, key read/change or scheduler alteration in this development task.
Existing one-event/one-session baseline is retained. **PUBLIC_G1_READY=no;
G1 PENDING; P2 OPEN; physical GPC OPEN; recovery DEFERRED; P3 IN PROGRESS.**
Next owner action is the still-open U1 auth selection, not waiting for backup
proof; physical-GPC follow-up remains conditional on an available capable browser.

## First scheduled backup, retention and G1 continuation — 2026-10-04

Current instruction [D-013](../DECISIONS.md#d-013--2026-10-04--return-to-p2-evidence-and-preserve-installation-work)
returns active work to canonical §§26/28 P2. Installation ease is COMPLETE at its
isolated technical scope; independent user test PENDING, customer time UNMEASURED.
Historical D-010/D-011 P3 implementation is preserved; no new P3 work. Earlier
“not due / no scheduled run” entries are historical and superseded by this audit.

### Actual scheduled operations and remote readback

Private evidence `.runtime/p2-scheduled-audit-20261004/`: audit JSON, downloaded
ciphertext/manifest, actual Actions logs, source-provenance comparison, production
before/after protected-resource/count records, and `g1-proof/`. Observed around
10:53–10:55 UTC. No workflow dispatch, manual backup, remote mutation or deletion.

| Evidence | Verified result and limit |
| --- | --- |
| First systemd scheduled backup | LastTrigger **4 October 03:15:00 UTC**, actual service start 03:15:00, exit **03:15:12**, Result success / ExecMainStatus 0; journal confirms execution. Timer remains enabled/active; next 5 October 03:15 UTC. |
| Exact snapshot | `om-db-v1-20261004T031502Z-9ee17021`, release **402803598**, captured 03:15:02, verified 03:15:11.208965 UTC; daily+weekly (Sunday), **33,236 B**, no size warning, **0 pruned**. |
| New independent readback | Exact remote ciphertext and manifest downloaded again; SHA-256 **23e8539e4cd19e9ff60ee5dc0917d3d12ee3f4b6e19a79ab8ab4ee403e0f716d** equals local success record and remote metadata, exact manifest and size match, age v1 header correct. Remote body/assets unchanged across readback. **Integrity PASS**, no decrypt or restore inferred. |
| First scheduled expiry | [37180284300](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37180284300), event schedule, SUCCESS, created **05:34:27**, completed **05:34:38 UTC**. Logs: apply mode, **0 expired candidates / 0 deletions / 3 protected inventory records**. Configured time 03:45 UTC; actual start delayed **1 h 49 m 27 s**. No actual expired-object deletion was exercised. |
| Scheduled remote freshness | [37172128140](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37172128140) at 02:47:28 UTC checked the earlier backup; [37179440970](https://github.com/brsctncnbrk5/originmetric-recovery/actions/runs/37179440970) at **05:17:07–05:17:16 UTC**, after the new backup, logs **PASS / FRESH_REMOTE_VERIFIED_BACKUP**. These prove scheduled execution, not uninterrupted hourly coverage or failure notification delivery. |
| Read-only retention reevaluation | 3 remote records, **0 period-policy candidates**, **0 >=90-day owned candidates**. Dry-run only; original phone ZIP and both DB snapshots preserved. |
| Public scheduled observation | [37196625353](https://github.com/brsctncnbrk5/originmetric-monitoring/actions/runs/37196625353) SUCCESS at 10:49:39–10:49:47 UTC; only three 4 October scheduled observations returned in inspected inventory. Fresh local GET-only health/tracker 200 semantic PASS. Sparse samples do not prove continuous five-minute uptime or missed-run detection. |

An initial Actions-log download with an octet-stream Accept header was rejected;
using the normal GitHub log endpoint downloaded the ZIP logs successfully. That
failed download is not counted as operational success or backup failure.

### Backup source provenance defect and authorized correction

The successful scheduled manifest's `source_sha` is checkout
`eb3fad858ec4946bc30b4e31cc97b90361a56e00`, containing **5** migration journal entries
including undeployed P3 migration `0004_brown_rogue`. Actual application remains
`e74bfc1fcc6e404be977feee059dc1d3c78d170c`, with **4** journal entries. The receiver
uses snapshot `source_sha` to reconstruct migrations; thus **this scheduled
snapshot's source/schema compatibility is NOT PASSED / restore NOT RUN**.
Ciphertext/hash PASS does not close that gap. Earlier exact empty-snapshot phone
restore PASS remains valid for its own snapshot only.

Corrected `github-backup.py`: resolve `.runtime/current-tag` to its exact Git commit,
verify the running app image equals `originmetric:<tag>` and check the same source
again after the dump, before upload/retention. Record this deployed commit in the
manifest, rather than working-tree HEAD. Missing/invalid commit, image mismatch,
inspection failure or source change fail closed with suppressed diagnostics.
Tests exercise diverged checkout, invalid/missing tag, image mismatch and source
change with zero remote creation/deletion. Actual **GET/read-only deployed-source
probe PASS**, returning `e74bfc1`; no production backup was manufactured to prove
the fix. The installed service points to this repository script, so the next
scheduled execution will use the correction after publication; units/time/key
unchanged. **Next-run manifest/readback remains PENDING**. Historical remote
metadata is untouched. No claim that image identity alone proves every possible
out-of-band DB schema change; an actual restore remains separate evidence.

Rollback for the code correction: restore only `scripts/vps/github-backup.py`
from entry commit `7f739a1` through a normal reviewed revert (no history rewrite);
leave timer, credentials, key and snapshots intact. This reinstates the known
provenance defect and must keep snapshot compatibility OPEN. Do not restore the
entire checkout or roll back preserved auth/installation code.

### Fresh six-item G1 review and remaining acceptance

To avoid testing newer undeployed P3 source against the older image, used a
**detached disposable worktree at `f959cd3`**, whose `src/tracker/drizzle` match the
deployed `e74bfc1`, existing installed Node/browser dependencies and the deployed
Docker image. `gate-g1 --technical-only --rehearse-dogfood` ran under the existing
operation lock. Live tracker bytes equal fixture bytes; **98 tests / 9 files PASS**.
Full isolated trusted visit/identify/retry/payment/409/renewal/refund/internal
rendered row PASS; USD **5800 payment / 500 refund / 5300 net**; semantic populated
fixture restore, 14 FKs/zero orphans and four tamper refusals PASS. Owned fixture
containers/network removed; protected production resources/counts unchanged.
Worktree evidence copied to private `g1-proof/` before owned worktree cleanup.

| Canonical G1 item | Current outcome / remaining proof |
| --- | --- |
| 1. Required consent / withdrawal | Fresh deployed-image technical PASS; prior actual-domain operator persistence/withdrawal PASS and owner banner acceptance retained. Owner-phone storage/network unobserved; no repeated confirmation requested. |
| 2. Default GPC / configurable ignore | Default fresh fixture PASS; prior injected live true and isolated ignore override evidence retained. **Physical native true plus actual-site zero-storage/zero-request evidence OPEN / NOT PASSED**. Android Chrome NOT_EXPOSED and no alternative browser available remain recorded. |
| 3. Body/schema/origin/dedup/failure isolation | Fresh matching-source real-DB technical PASS. Closed public responses are not evidence of active production ingestion. |
| 4. IP/site/project limits, abuse ceiling, daily cap and edge rule | Fresh application controls PASS; previously accepted saved single-rule/window/order panels retained. Direct provider API/original export unverified; no new provider inspection or five-minute continuity claim. |
| 5. Log redaction | Fresh real-handler/fixture sensitive-log PASS; previous actual-window log PASS retained. No unperformed live revenue-handler observation inferred. |
| 6. Browser cannot create trusted links/customers/revenue | Fresh deployed-image browser and matching-source identity-poisoning regressions PASS; production customer/link/revenue/attribution remain zero. |

**Formal G1 PENDING.** Physical native GPC is the first missing acceptance proof;
no ingestion opening is needed to observe a tracker sending zero requests. A new
bounded production chain requires the concrete scope/rollback in the
[current runbook](../runbooks/P2_DOGFOOD_ACCEPTANCE.md#p2-continuation-scope-and-rollback--2026-10-04)
and separate authorization; exhausted D-009 does not authorize reuse. Current P2
image is sufficient: no auth/P3 deployment is required for this next proof.

P2 also retains OPEN: actual production consented attribution chain, populated
encrypted phone restore, this scheduled snapshot's incompatible provenance,
actual backup-failure/missing-run delivery, GitHub-independent dead-man, strict
90-day lifecycle during provider/account/schedule failure and saved `/js/*`
Cloudflare cache verification. Phone-independent recovery **DEFERRED**, no key
operation. Owner-reported existing email receipts retain their exact scopes.

Checks: backup policy **21**, local status **4**, retention **3**, restore acceptance
**6** = **34 tests PASS**, plus deployed-image **98** tests and isolated chain.
Actual deployed-source/image check and public GET checks PASS. No new full
application/remote CI PASS inferred for these operational changes. Protected
production env/nginx/units/container start/restart metadata and canonical plan
unchanged; ten-table counts unchanged (events 1, sessions 1, ingestion_daily 1;
workspaces/projects/api_keys 1 each; other four fact tables 0).
**PUBLIC_G1_READY=no; G1 PENDING; P2 OPEN; installation work COMPLETE;
independent user test PENDING; existing P3 work preserved, no new P3 work.**
