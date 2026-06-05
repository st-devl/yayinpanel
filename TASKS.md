# Patlat Proje Task Listesi

Bu liste `proje.md` ve `design/` klasorundeki tum ekranlar incelenerek hazirlandi. Ilerleme oldukca ilgili maddeler isaretlenecek.

## 0. Analiz ve Tasarim Envanteri

- [x] `proje.md` dosyasini bastan sona incele.
- [x] `design/` alt klasorlerini ve tum HTML/Markdown tasarim dosyalarini incele.
- [x] `screen.png` render goruntulerini kontrol et.
- [x] MVP kapsamini netlestir: tek kullanici, SaaS degil, tenant/workspace/odeme yok.
- [x] Tasarim dilini netlestir: Inter, Material Symbols, 280px sidebar, mobil bottom nav, acik yuzeyler, siyah primary, ince border, yogun operasyon paneli.

## 1. Proje Iskeleti ve Teknoloji Secimi

- [x] Next.js + React + TypeScript uygulama iskeletini kur.
- [x] Tailwind CSS'i tasarimdaki tokenlara gore ayarla.
- [x] shadcn/ui veya yerel component yapisini projeye uygun kur.
- [x] ESLint, Prettier ve TypeScript strict ayarlarini yap.
- [x] Ortak route, layout ve navigation mimarisini kur.
- [x] `design/` HTML'lerinden tekrar eden UI patternlerini componentlere ayir.

## 2. Tasarim Sistemi ve Ana Layout

- [x] `premium_planlay_c/DESIGN.md` renk, spacing, radius ve typography tokenlarini Tailwind/theme yapisina tasi.
- [x] Desktop sidebar componentini birebir uygula.
- [x] Mobile bottom navigation componentini uygula.
- [x] Topbar/search/notification/profile alanlarini ortak layouta tasi.
- [x] Kart, badge, button, input, textarea, select, empty state, table ve upload componentlerini standartlastir.
- [x] Tum sayfalarda pixel yakinligi icin desktop ve mobil responsive davranisi kontrol et.

## 3. Auth ve Tek Kullanici Guvenligi

- [x] `.env.example` dosyasini gerekli alanlarla hazirla.
- [x] Prisma User modelini olustur.
- [x] Ilk acilista veya seed ile `ADMIN_EMAIL` / `ADMIN_PASSWORD` uzerinden tek admin kullanici olustur.
- [x] Parolayi bcrypt veya argon2id ile hashle.
- [x] Login ekranini `design/giri_sayfas` tasarimina uygun uygula.
- [x] Kayit, sosyal login ve cok kullanici akisini MVP disi birak veya UI'dan kaldir.
- [x] Protected route/session middleware kur.

## 4. Veritabani ve Domain Modeli

- [x] Prisma kurulumunu yap.
- [x] SQLite ile MVP veritabani kurulumunu yap.
- [x] Enumlari ekle: `Platform`, `ContentStatus`, `ConnectionStatus`, `PublishLogStatus`.
- [x] Modelleri ekle: `User`, `InstagramAccount`, `XAccount`, `WordPressSite`, `MediaFile`, `ContentCard`, `PublishLog`, `Setting`.
- [x] Tek `ContentCard` modelini platform ayrimi olmadan uygula.
- [x] `platformData` icin Zod discriminated union validation yaz.
- [x] Migration ve seed akisini calistir.

## 5. Guvenlik, Secret ve Token Katmani

- [x] `ENCRYPTION_KEY` dogrulama ve format kontrolu ekle.
- [x] Token/application password encryption-decryption yardimcilarini yaz.
- [x] API response ve loglarda secret/token maskeleme yardimcisini yaz.
- [x] Hesap tokenlarini plain text saklamayacak servis katmanini kur.
- [x] Kritik env eksikse acik ve guvenli hata mesaji uret.

## 6. Timezone ve Planlama Yardimcilari

- [x] `TIMEZONE=Europe/Istanbul` varsayimini merkezi confige al.
- [x] Panel tarih/saatlerini Europe/Istanbul olarak goster.
- [x] Kullanici girislerini Europe/Istanbul kabul edip UTC olarak kaydet.
- [x] Gunluk, iki gunde bir, haftalik ve hafta sonu atlama gibi toplu planlama yardimcilarini yaz.
- [x] Timezone donusumleri icin test ekle.

## 7. Medya Katmani

- [x] Local storage klasor yapisini belirle.
- [x] Medya upload API'sini yaz.
- [x] `sharp` ile format, width, height, aspect ratio ve dosya boyutu dogrulama ekle.
- [x] `MediaFile` kayitlarini veritabanina yaz.
- [x] Medya listeleme, arama, silme ve kullanim durumu endpointlerini yaz.
- [x] Instagram icin kisa omurlu medya erisim endpointi veya signed URL mantigini kur.
- [x] WordPress icin backend binary upload akisini destekle.

## 8. Hesap Baglantilari

- [x] Hesap Baglantilari sayfasini tasarima uygun uygula.
- [x] Instagram account CRUD, test, reconnect ve remove akislarini yaz.
- [x] X account OAuth2, refresh token, test, reconnect ve remove akislarini yaz.
- [x] WordPress site application password kaydi, test ve remove akislarini yaz.
- [x] Connection status ve lastError bilgisini net sekilde guncelle.
- [x] MVP disi tasarim orneklerini kapsam disinda tut: LinkedIn, Medium, Google Drive, S3 entegrasyon kartlari.

## 9. Kontrol Paneli

- [x] Kontrol Paneli ekranini `design/kontrol_paneli` tasarimina uygun uygula.
- [x] Bugun paylasilacak, planlanmis, yayinlanmis, hata, manuel kontrol metriklerini veritabanindan hesapla.
- [x] Bagli hesap ozetlerini goster.
- [x] Token/hata uyarilarini goster.
- [x] Son basarili yayinlar ve son hatalari `PublishLog` uzerinden listele.

## 10. Instagram Paneli

- [x] Aktif Instagram hesabi secimini zorunlu hale getir.
- [x] Instagram Paneli statik UI'ini `design/instagram_paneli` tasarimina uygun uygula.
- [x] Toplu caption parser yaz.
- [x] Toplu gorsel upload ve siralama UI'ini uygula.
- [x] Metin-gorsel birebir eslestirme onizlemesini uygula.
- [x] Eksik/fazla metin-gorsel uyarilarini ekle.
- [x] Instagram icin gorsel zorunlulugu ve sharp validasyonunu bagla.
- [x] Kart olusturup ortak depoya gonderme akisini yaz.
- [x] Toplu tarih/saat planlama akisini yaz.
- [x] IG gunluk/24 saat limit uyarisi icin `Setting` tabanli kontrol ekle.

## 11. X / Twitter Paneli

- [x] Aktif X hesabi secimini zorunlu hale getir.
- [x] X / Twitter Paneli statik UI'ini `design/x_twitter_paneli` tasarimina uygun uygula.
- [x] Toplu post metni girisini uygula.
- [x] Opsiyonel medya ekleme ve eslestirme akisini yaz.
- [x] X karakter sayimini `text.length` kullanmadan uygun kutuphane ile yap.
- [x] Link dahil son tweet metni uzerinden karakter validation yap.
- [x] Limit asan iceriklerin planlanmasini engelle.
- [x] Kart onizleme ve kart olusturma akisini uygula.
- [x] Toplu planlama akisini ortak planlama servislerine bagla.

## 12. Web Sitesi / Blog Paneli

- [x] Aktif WordPress site secimini zorunlu hale getir.
- [x] Blog editor ekranini `design/web_sitesi_blog_paneli` tasarimina uygun uygula.
- [x] Baslik, slug, icerik, excerpt, kategori, etiket, featured image, SEO title, SEO description alanlarini uygula.
- [x] Slug generation ve manuel duzenleme akisini yaz.
- [x] Taslak kaydet, hemen yayinla ve planla akislarini `ContentCard` modeline bagla.
- [x] WordPress future scheduling kullanmadan uygulama scheduler akisini kullan.

## 13. Ortak Icerik Deposu

- [x] Ortak Icerik Deposu sayfasini tasarima uygun uygula.
- [x] Platform, hesap, durum ve tarih araligi filtrelerini ekle.
- [x] Kartlarda platform, hesap, medya, metin/baslik, scheduledAt, status ve hata bilgisini goster.
- [x] Duzenle, sil, planla, iptal et, tekrar dene ve manuel kontrol aksiyonlarini yaz.
- [x] Status badge renklerini tasarim sistemiyle eslestir.

## 14. Medya Kutuphanesi

- [x] Medya Kutuphanesi sayfasini tasarima uygun uygula.
- [x] Galeri ve liste gorunumlerini uygula.
- [x] Arama, yukleme, silme ve bos durum ekranlarini yaz.
- [x] Medyanin kullanilip kullanilmadigini goster.
- [x] Video MVP disi ise UI'da kontrollu sekilde pasif veya bilgilendirici yap.

## 15. Yayin Loglari ve Ayarlar

- [x] PublishLog liste ekranini uygula.
- [x] Log filtreleri ve detay gorunumunu ekle.
- [x] Setting yonetimini ekle: timezone, IG limit, backup path, Telegram ayarlari.
- [x] Sistem durumu ve yedekleme ekranlarini MVP kapsaminda sade uygula.

## 16. Publisher Altyapisi

- [x] Ortak `Publisher` interface yaz.
- [x] `PublishContext` modelini yaz.
- [x] `PublishResult` ve hata siniflandirma modelini yaz.
- [x] `InstagramPublisher` iskeletini ve container/status/publish akisini yaz.
- [x] `XPublisher` iskeletini ve medya/tweet publish akisini yaz.
- [x] `WordPressPublisher` iskeletini ve media binary upload + post publish akisini yaz.
- [x] 401 durumunda tek sefer token refresh + retry mantigini kur.
- [x] Kalici ve gecici hata ayrimini standardize et.

## 17. Scheduler

- [x] Next.js icinde `setInterval` kullanmadan ayri `scheduler.ts` process yaz.
- [x] Dakikalik polling akisini kur.
- [x] `status=SCHEDULED`, `scheduledAt<=now`, `nextAttemptAt<=now` sorgusunu yaz.
- [x] Atomik claim ile sadece `SCHEDULED -> PUBLISHING` gecisini guvenli yap.
- [x] Basarili publish sonrasi `PUBLISHED`, `publishedAt`, `externalPostId`, `externalPostUrl` kaydet.
- [x] Gecici hatalarda retry/backoff uygula.
- [x] Kalici hatalarda `FAILED` ve Telegram uyarisi gonder.
- [x] Uzun sure `PUBLISHING` kalan kartlari `MANUAL_CHECK_REQUIRED` yap ve tekrar otomatik yayinlama.
- [x] Scheduler icin test ve dry-run komutu ekle.

## 18. Telegram Bildirimleri

- [x] Telegram Bot API client yaz.
- [x] Basarili yayin, basarisiz yayin, token expired, reconnect gerekli, manuel kontrol, retry bitti gibi durumlari bildir.
- [x] Bildirim mesajlarini acik, kisa ve cozum odakli yaz.
- [x] Telegram token/chat id eksikse sessiz hata yerine loglanmis uyarilar uret.

## 19. Backup ve Deployment Hazirligi

- [x] Dockerfile ve docker-compose yapisini kur.
- [x] Container baslangicinda SQLite, Prisma migrate deploy ve seed akislarini kur.
- [x] Docker host portunu ortam degiskeniyle ayarlanabilir hale getir.
- [x] Docker build, compose healthcheck ve HTTP route kontrollerini dogrula.
- [x] SQLite database backup scripti yaz.
- [x] Medya klasoru backup scripti yaz.
- [x] `.env` ve `ENCRYPTION_KEY` yedekleme uyarilarini dokumante et.
- [x] PM2 config hazirla: web process ve scheduler process.
- [x] Production build komutunu dogrula.
- [x] Nginx/HTTPS/APP_BASE_URL deployment notlarini yaz.

## 20. Test, Kalite ve Dogrulama

- [x] Ilk milestone dogrulamasi: `format:check`, `typecheck`, `lint`, `build`, `npm audit`.
- [x] Dev server acilisini ve login korumali route yonlendirmesini HTTP seviyesinde kontrol et.
- [x] Unit testler: timezone, platformData validation, encryption, parser, character count.
- [x] Integration testler: content card CRUD, scheduler claim, retry, manual check.
- [x] Publisher servisleri icin mock API testleri.
- [x] UI smoke testleri ve kritik route kontrolleri.
- [x] Playwright ile desktop ve mobil ekran goruntusu kontrolleri.
- [x] Tasarim screenshot'lariyla temel pixel/layout karsilastirmasi yap.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` komutlarini gecir.

## 21. Nihai Teslim

- [x] Tum MVP akislari end-to-end calisir hale getir.
- [x] Seed/demo veriyle paneli gezilebilir hale getir.
- [x] README kurulum, env, migration, dev, scheduler ve deploy adimlarini yaz.
- [x] Bilinen sinirlar ve MVP disi ozellikleri dokumante et.
- [x] Son guvenlik kontrolu yap: `.env` yok, secret log yok, tokenlar encrypted.
- [x] Son performans kontrolu yap: gereksiz polling, gereksiz veri transferi ve agir UI render yok.
- [x] Kullaniciya calisan local URL, test komutlari ve kalan riskleri bildir.
