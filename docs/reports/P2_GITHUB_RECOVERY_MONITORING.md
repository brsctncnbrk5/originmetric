# P2 — originmetric.app consent, GitHub recovery and dashboard monitoring

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
  not installed or active**. Private Actions no-spend budget and reviewed source
  pin must be verified before activation. GitHub draft Releases have no confirmed
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
