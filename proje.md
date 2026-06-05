# KİŞİSEL İÇERİK PLANLAMA VE OTOMATİK YAYINLAMA WEB UYGULAMASI

## 1. PROJENİN HİKAYESİ

Bu proje, bana ait Instagram hesapları, X/Twitter hesapları ve web siteleri/bloglar için içerikleri tek bir panelden hazırlamak, depolamak, planlamak ve zamanı geldiğinde otomatik olarak yayınlamak amacıyla geliştirilecek kişisel bir web uygulamasıdır.

Bu proje SaaS değildir.

Yani sistemde:

- Çoklu kullanıcı kaydı
- Tenant yapısı
- Workspace yapısı
- Süper admin
- Üyelik planları
- Kullanıcı aktivasyonu
- Rol/izin sistemi
- Ödeme sistemi
- Farklı müşteriler için ayrı çalışma alanları

olmayacaktır.

Sistem sadece benim kişisel kullanımım için geliştirilecektir.

Ben bu panel üzerinden kendi dijital kanallarımı bağlayacağım:

- Instagram hesaplarım
- X/Twitter hesaplarım
- WordPress veya benzeri web sitelerim/bloglarım

Daha sonra içerikleri önceden sisteme yükleyeceğim. Sistem bu içerikleri kart haline getirecek, içerik deposunda saklayacak, tarih ve saat bilgisine göre planlayacak ve zamanı geldiğinde ilgili hesaba veya web sitesine otomatik olarak gönderecek.

Bu sadeleştirme sayesinde SaaS mimarisinden gelen karmaşıklıklar kaldırılmıştır. Ancak platformların kendi API kurallarından gelen teknik zorluklar hâlâ devam eder.

Örneğin:

- Instagram için Meta App, Facebook Page bağlantısı, Instagram Business/Creator hesap, token yönetimi ve medya format kuralları gerekir.
- X/Twitter için developer hesabı, API erişimi, access token / refresh token yönetimi, karakter sayımı ve API limitleri dikkate alınmalıdır.
- WordPress için REST API, Application Password, medya yükleme, kategori/etiket ve yayınlama akışı gerekir.

Bu yüzden sistem sade ama profesyonel kurulmalıdır.

Temel hedef şudur:

Ben içerikleri sisteme yükleyeyim, görsellerle metinleri eşleştireyim, tarih/saat vereyim, sistem zamanı gelince paylaşsın, başarılı veya hatalı sonucu bana Telegram üzerinden bildirsin.

Uygulamada üç ana panel olacaktır:

1. Instagram Paneli
2. X/Twitter Paneli
3. Web Sitesi / Blog Paneli

Ayrıca şu yardımcı bölümler olacaktır:

- Ortak İçerik Deposu
- Medya Kütüphanesi
- Hesap Bağlantıları
- Yayın Logları
- Ayarlar
- Yedekleme / Sistem Durumu

Instagram panelinde toplu metin girişi, toplu görsel yükleme, görsel sıralama, metin-görsel eşleştirme, içerik kartı oluşturma, toplu tarih/saat planlama ve otomatik paylaşım yapılacaktır.

X/Twitter panelinde kısa metinler, karakter sınırı, link, opsiyonel görsel ve zamanlanmış paylaşım yönetilecektir.

Web sitesi/blog panelinde başlık, içerik, öne çıkan görsel, kategori, etiket, SEO başlığı, meta açıklama ve WordPress REST API ile yayınlama yönetilecektir.

Tüm içerikler tek bir ortak ContentCard modeliyle tutulacaktır. Instagram, X ve WordPress için ayrı ayrı içerik tabloları yapılmayacaktır. Platforma özel alanlar platformData JSON alanında saklanacaktır.

Zamanlama sistemi kişisel kullanım için sade tutulacaktır. Redis/BullMQ kullanılmayacaktır. Bunun yerine dakikada bir çalışan ayrı bir scheduler process kullanılacaktır.

Önemli karar:

Scheduler, Next.js uygulamasının içinde setInterval ile çalıştırılmayacaktır.

Çünkü Next.js içinde çalışan background interval yapıları restart, serverless, çoklu instance veya deploy sırasında güvenilir değildir.

Scheduler için iki doğru seçenek vardır:

1. PM2 veya systemd ile sürekli çalışan ayrı bir scheduler.ts Node process
2. Sistem cron’unun her dakika korumalı bir API route çağırması

Bu projede önerilen yöntem:

Ayrı bir scheduler.ts process çalıştırmak.

Bu process her dakika veritabanını kontrol eder, zamanı gelen kartları atomik şekilde claim eder ve ilgili publisher servisiyle yayınlar.

Veritabanı tek gerçek kaynak olacaktır.

Planlanmış işler veritabanında tutulacaktır.

Bir içeriğin tarihini değiştirmek sadece scheduledAt alanını güncellemek anlamına gelir.

Bir içeriği iptal etmek status = CANCELED yapmak anlamına gelir.

Queue job silme veya Redis yönetimi olmayacaktır.

Sistem zamanlama ürünü olduğu için timezone çok önemlidir.

Tek kullanıcı olduğum için TIMEZONE sabit olabilir.

.env veya Setting tablosunda şu değer tutulmalıdır:

TIMEZONE=Europe/Istanbul

Tüm scheduledAt değerleri veritabanında UTC olarak saklanacaktır.

Panelde tarih ve saat Europe/Istanbul saatine göre gösterilecektir.

Kullanıcı panelde “10 Haziran 2026 saat 10:00” seçtiğinde sistem bunu Europe/Istanbul saat dilimine göre yorumlayacak, UTC’ye çevirecek ve veritabanına UTC olarak kaydedecektir.

“Her gün saat 10:00”, “2 günde bir”, “hafta sonlarını atla” gibi toplu planlama hesapları da TIMEZONE değerine göre yapılacaktır.

Aksi halde paylaşımlar 3 saat kayabilir. Bu yüzden timezone desteği zorunludur.

Sistemde status enum sade tutulacaktır.

Tek kullanıcı olduğum için editör/onaycı ayrımı yoktur. Bu nedenle READY ve APPROVED gibi ara statülere gerek yoktur.

Temel status akışı:

DRAFT
SCHEDULED
PUBLISHING
PUBLISHED
FAILED
CANCELED
MANUAL_CHECK_REQUIRED

Bu sade akış yeterlidir.

DRAFT: İçerik hazırlandı ama planlanmadı.
SCHEDULED: İçerik planlandı.
PUBLISHING: Sistem içeriği yayınlamaya çalışıyor.
PUBLISHED: İçerik başarıyla yayınlandı.
FAILED: Yayın başarısız oldu.
CANCELED: İçerik iptal edildi.
MANUAL_CHECK_REQUIRED: Çift paylaşım riski veya belirsiz durum nedeniyle manuel kontrol gerekiyor.

Yayın sırasında çift paylaşımı engellemek çok önemlidir.

Scheduler bir kartı yayınlamadan önce atomik claim yapmalıdır:

Sadece status = SCHEDULED olan kart PUBLISHING durumuna alınabilir.

Eğer claim başarısız olursa o kart işlenmemelidir.

Böylece aynı anda iki scheduler çalışsa bile aynı içerik iki kez paylaşılmaz.

Ancak daha kritik bir durum vardır:

Bir kart PUBLISHING durumuna geçti. Sistem platforma postu gönderdi. Platform paylaşımı kabul etti. Fakat sistem externalPostId veya externalPostUrl bilgisini veritabanına yazamadan çöktü.

Bu durumda kart PUBLISHING durumunda takılı kalır.

Bu kart otomatik olarak tekrar yayınlanmamalıdır.

Çünkü platformda paylaşılmış olabilir. Tekrar denenirse aynı içerik iki kez paylaşılabilir.

Bu yüzden uzun süre PUBLISHING durumunda kalan kartlar MANUAL_CHECK_REQUIRED durumuna alınmalı ve Telegram üzerinden manuel kontrol uyarısı gönderilmelidir.

Medya dosyaları kişisel kullanım için local storage’da tutulabilir. Ancak düzenli yedeklenmelidir. İleride istenirse S3/R2’ye geçilebilir.

Instagram yayını sırasında görselin Meta tarafından erişilebilir bir URL ile sunulması gerekir. Bu yüzden APP_BASE_URL üzerinden kısa ömürlü medya erişim endpoint’i veya signed URL mantığı kurulmalıdır.

WordPress için ise görsel URL vermek yerine backend dosyayı okuyup WordPress /wp/v2/media endpointine binary olarak yüklemelidir.

API app secret bilgileri .env dosyasında saklanacaktır:

META_APP_ID
META_APP_SECRET
X_CLIENT_ID
X_CLIENT_SECRET
X_API_KEY
X_API_SECRET
TELEGRAM_BOT_TOKEN
ENCRYPTION_KEY
DATABASE_URL
APP_BASE_URL
TIMEZONE=Europe/Istanbul

Hesaba özel tokenlar ilgili hesap tablolarında şifreli saklanacaktır.

Örneğin:

InstagramAccount:
accessTokenEncrypted
tokenExpiresAt

XAccount:
accessTokenEncrypted
refreshTokenEncrypted
tokenExpiresAt

WordPressSite:
applicationPasswordEncrypted

ENCRYPTION_KEY çok kritiktir.

Veritabanı yedeği alınsa bile ENCRYPTION_KEY kaybedilirse şifreli tokenlar çözülemez. Bu durumda tüm sosyal medya hesaplarının ve WordPress bağlantılarının yeniden bağlanması gerekir.

Bu yüzden ENCRYPTION_KEY:

- Stabil tutulmalıdır.
- Deploy sırasında değişmemelidir.
- Veritabanı yedeğinden ayrı, güvenli bir yerde yedeklenmelidir.
- GitHub’a gönderilmemelidir.
- Sunucu değişikliğinde aynı anahtar yeni sunucuya taşınmalıdır.

Uygulama her zaman açık çalışan bir VPS üzerinde çalışmalıdır.

Laptop veya kişisel bilgisayar üzerinde çalıştırmak doğru değildir. Çünkü bilgisayar kapalıysa zamanlanmış içerikler paylaşılmaz.

Önerilen yapı:

- Küçük VPS
- Docker veya PM2
- Nginx reverse proxy
- HTTPS
- Dakikalık scheduler process
- Düzenli veritabanı ve medya yedeği
- Telegram hata bildirimi

Bu sistemin amacı büyük bir SaaS ürünü yapmak değildir.

Amaç sade, güvenilir, tek kullanıcılı, benim hesaplarıma içerik planlayıp otomatik paylaşan kişisel içerik operasyon paneli kurmaktır.

---

# 2. YAZILIMCIYA VERİLECEK DETAYLI GELİŞTİRME PROMPTU

Bana özel kullanılacak bir içerik planlama ve otomatik yayınlama web uygulaması geliştirmek istiyorum.

Bu proje SaaS değildir. Çok kullanıcılı, tenant/workspace yapılı, üyelik planlı veya süper admin onaylı bir ürün olarak geliştirilmeyecektir.

Sistem sadece bana ait dijital kanalları yönetmek için yapılacaktır.

Uygulama ile:

- Instagram hesaplarım
- X/Twitter hesaplarım
- WordPress / web sitesi / blog sayfalarım

için içerik hazırlamak, içerikleri depolamak, tarih/saat vererek planlamak ve zamanı geldiğinde ilgili platforma otomatik olarak göndermek istiyorum.

---

## 3. YAPILMAYACAKLAR

Bu proje kişisel kullanım içindir.

Bu yüzden aşağıdaki yapılar yapılmayacaktır:

- Multi-tenant mimari
- Workspace
- WorkspaceMember
- Plan/paket sistemi
- Süper admin paneli
- Kullanıcı aktivasyon sistemi
- Kullanıcı kayıt ekranı
- Rol sistemi
- Tenant bazlı limitler
- Kullanıcı yönetimi
- ApiCredential isimli genel tenant credential tablosu
- Redis
- BullMQ
- SaaS ödeme altyapısı

Tek kullanıcı mantığı yeterlidir.

---

## 4. AUTH / GİRİŞ MANTIĞI

Kayıt ekranı olmayacaktır.

Sistemde tek kullanıcı olacaktır.

Tek kullanıcı şu yöntemlerden biriyle oluşturulmalıdır:

1. Seed script ile ilk kullanıcı oluşturulabilir.
2. İlk açılışta .env içindeki ADMIN_EMAIL ve ADMIN_PASSWORD değerlerinden kullanıcı oluşturulabilir.

Önerilen .env alanları:

ADMIN_EMAIL=...
ADMIN_PASSWORD=...

İlk kurulumda sistem User tablosunda kullanıcı yoksa bu bilgilerle tek kullanıcıyı oluşturmalıdır.

Daha sonra giriş ekranından e-posta ve şifre ile giriş yapılmalıdır.

Şifre hashlenerek saklanmalıdır.

Şifre hash için bcrypt veya argon2id kullanılabilir.

Uygulama internete açık olacaksa login zorunlu olmalıdır.

Alternatif güvenlik yöntemleri:

- Reverse proxy basic auth
- Tailscale/VPN arkasında çalışma
- IP kısıtlama

Ancak önerilen minimum güvenlik:

Tek kullanıcı login + HTTPS.

---

## 5. ÖNERİLEN TEKNOLOJİ YIĞINI

Frontend + Backend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Next.js Route Handlers
- Server Actions kullanılabilir

Veritabanı:

Seçenek 1:
SQLite + Prisma

Kişisel kullanım için yeterlidir.
Kurulumu kolaydır.
Yedeklemesi kolaydır.
Sunucu yönetimi gerektirmez.

Seçenek 2:
PostgreSQL + Prisma

Daha sağlam production tercihi olabilir.
İleride büyüme ihtimali varsa tercih edilebilir.

Öneri:

İlk MVP için SQLite yeterlidir.
Daha uzun vadeli, daha sağlam VPS kullanımı istenirse PostgreSQL tercih edilebilir.

ORM:

- Prisma

Scheduler:

- Redis/BullMQ kullanılmayacaktır.
- Next.js içinde setInterval kullanılmayacaktır.
- Ayrı bir scheduler.ts Node process tercih edilecektir.
- Alternatif olarak sistem cron her dakika korumalı bir API route çağırabilir.

Medya işleme:

- sharp

Validation:

- Zod

X karakter sayımı:

- X/Twitter karakter sayım kurallarına uygun kütüphane kullanılmalıdır.
- text.length ile sayım yapılmamalıdır.
- Link dahil son birleşik tweet metni üzerinden sayım yapılmalıdır.

Bildirim:

- Telegram Bot API

Deployment:

- Küçük VPS
- Docker veya PM2
- Nginx
- HTTPS
- Always-on çalışma

---

## 6. ENV DEĞERLERİ

.env içinde şu bilgiler bulunmalıdır:

DATABASE_URL=...
APP_BASE_URL=...
TIMEZONE=Europe/Istanbul

ADMIN_EMAIL=...
ADMIN_PASSWORD=...

ENCRYPTION_KEY=...

META_APP_ID=...
META_APP_SECRET=...

X_CLIENT_ID=...
X_CLIENT_SECRET=...
X_API_KEY=...
X_API_SECRET=...

TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

ENCRYPTION_KEY kaybedilmemelidir.

ENCRYPTION_KEY veritabanı yedeğinden ayrı, güvenli bir yerde ayrıca yedeklenmelidir.

---

## 7. TIMEZONE KURALI

Timezone zorunludur.

Tek kullanıcı için TIMEZONE sabit olabilir.

Varsayılan:

Europe/Istanbul

Kurallar:

- Panelde tüm tarih/saatler Europe/Istanbul olarak gösterilir.
- Kullanıcı planlama yaparken yerel saat girer.
- Sistem bu tarihi TIMEZONE bilgisine göre UTC’ye çevirir.
- Veritabanında scheduledAt UTC olarak saklanır.
- Scheduler UTC zamana göre çalışır.
- Toplu planlama hesapları TIMEZONE değerine göre yapılır.

Örnek:

Kullanıcı panelde şunu seçer:

10 Haziran 2026 - 10:00

Sistem bunu Europe/Istanbul olarak yorumlar, UTC’ye çevirir ve scheduledAt alanına UTC olarak kaydeder.

“Her gün saat 10:00”, “2 günde bir”, “hafta sonlarını atla” gibi hesaplar da Europe/Istanbul saat dilimine göre yapılmalıdır.

---

## 8. VERİTABANI MODELLERİ

Minimum veri modelleri şunlardır:

User:

- id
- email
- passwordHash
- createdAt
- updatedAt

InstagramAccount:

- id
- accountName
- username
- instagramBusinessAccountId
- facebookPageId
- profileImageUrl
- accessTokenEncrypted
- tokenExpiresAt
- connectionStatus
- lastError
- createdAt
- updatedAt

XAccount:

- id
- accountName
- username
- xUserId
- profileImageUrl
- accessTokenEncrypted
- refreshTokenEncrypted
- tokenExpiresAt
- connectionStatus
- lastError
- createdAt
- updatedAt

WordPressSite:

- id
- name
- baseUrl
- username
- applicationPasswordEncrypted
- connectionStatus
- lastError
- createdAt
- updatedAt

MediaFile:

- id
- fileName
- originalFileName
- mimeType
- fileSize
- width
- height
- storageType
- storagePath
- createdAt
- updatedAt

ContentCard:

- id
- platform
- accountType
- accountId
- mediaFileId
- text
- status
- orderNumber
- scheduledAt
- nextAttemptAt
- publishedAt
- externalPostId
- externalPostUrl
- platformData
- errorCode
- errorMessage
- retryCount
- publishingStartedAt
- manualCheckReason
- createdAt
- updatedAt

PublishLog:

- id
- platform
- accountId
- contentCardId
- action
- status
- apiResponse
- errorCode
- errorMessage
- createdAt

Setting:

- id
- key
- value
- createdAt
- updatedAt

---

## 9. ENUM DEĞERLERİ

Platform enum:

- INSTAGRAM
- X
- WORDPRESS

ContentCard status enum:

- DRAFT
- SCHEDULED
- PUBLISHING
- PUBLISHED
- FAILED
- CANCELED
- MANUAL_CHECK_REQUIRED

READY ve APPROVED kullanılmayacaktır.

Tek kullanıcı olduğum için ayrı onay akışı gereksizdir.

Connection status enum:

- CONNECTED
- NEEDS_RECONNECT
- TOKEN_EXPIRED
- PERMISSION_MISSING
- RATE_LIMITED
- FAILED
- DISCONNECTED

Publish log status:

- OK
- ERROR
- WARNING

---

## 10. TEK CONTENTCARD MODELİ

Instagram, X ve WordPress için ayrı içerik tabloları yapılmayacaktır.

Tek ContentCard tablosu kullanılacaktır.

Platforma özel alanlar platformData JSON alanında saklanacaktır.

Instagram platformData örneği:

{
"postType": "IMAGE",
"hashtags": ["trabzon", "kurban", "adak"],
"captionStyle": "professional"
}

X platformData örneği:

{
"linkUrl": "https://example.com",
"hasMedia": true,
"isThread": false
}

WordPress platformData örneği:

{
"title": "Trabzon Kurban Hizmeti",
"slug": "trabzon-kurban-hizmeti",
"contentHtml": "<p>Blog içeriği...</p>",
"excerpt": "Kısa açıklama",
"seoTitle": "Trabzon Kurban Hizmeti",
"seoDescription": "Trabzon'da kurban hizmeti hakkında detaylı bilgi.",
"categoryIds": [1, 2],
"tagIds": [5, 8],
"publishStatus": "publish"
}

platformData Zod discriminated union ile validate edilmelidir.

Doğrudan as/cast yapılmamalıdır.

---

## 11. HESAP BAĞLANTILARI SAYFASI

Bu sayfada üç bağlantı bölümü olmalıdır:

1. Instagram hesapları
2. X/Twitter hesapları
3. WordPress siteleri

Her bağlantı kartında şu bilgiler görünmelidir:

- Hesap/site adı
- Kullanıcı adı veya site URL
- Bağlantı durumu
- Token süresi, varsa
- Son hata mesajı
- Bağlantıyı test et
- Bağlantıyı yenile
- Bağlantıyı kaldır

Instagram için:

- Meta App bilgileri .env’den alınır.
- OAuth bağlantısı veya manuel token kaydı desteklenebilir.
- Instagram Business/Creator hesap bağlantısı gereklidir.
- Facebook Page bağlantısı gereklidir.
- Kişisel Instagram hesabına resmi API ile post atılamaz.
- Güncel Meta API gereksinimleri geliştirme öncesi kontrol edilmelidir.

X için:

- X developer app bilgileri .env’den alınır.
- OAuth2 bağlantısı yapılmalıdır.
- Access token ve refresh token encrypted saklanmalıdır.
- Token süresi dolduğunda yenilenebilmelidir.
- Güncel X API limitleri ve ücretlendirmesi geliştirme öncesi kontrol edilmelidir.

WordPress için:

- Site URL
- Kullanıcı adı
- Application Password
- Bağlantıyı test et
- Kategori ve etiketleri getir, ileride
- Yazı yayınlama izni kontrolü

---

## 12. INSTAGRAM PANELİ

Instagram panelinde aktif Instagram hesabı seçimi en üstte olmalıdır.

Kullanıcı hesap seçmeden içerik oluşturamamalı veya planlama yapamamalıdır.

Sayfa bölümleri:

1. Aktif Instagram hesabı seçimi
2. Toplu metin/caption girişi
3. Toplu görsel yükleme
4. Görsel sıralama
5. Metin-görsel eşleştirme önizlemesi
6. Eksik/fazla uyarısı
7. Kart oluştur ve depoya gönder
8. Toplu tarih/saat planlama
9. Kart listesi

Toplu metin girişi:

- Her satır bir içerik olabilir.
- Boş satırla ayrılmış içerikler desteklenebilir.
- Numaralı içerikler desteklenebilir.
- Sistem kaç metin algılandığını göstermelidir.

Toplu görsel yükleme:

- JPG
- JPEG
- PNG
- WebP

Görsel işlemleri:

- Önizleme göster
- Sürükle bırak sıralama
- Dosya adına göre sırala
- Yükleme sırasına göre sırala
- Manuel sıra değiştir

Eşleştirme:

- 1. metin + 1. görsel
- 2. metin + 2. görsel
- 3. metin + 3. görsel

Kart oluşturmadan önce eşleştirme önizlemesi gösterilmelidir.

Metin ve görsel sayısı eşit değilse açık uyarı verilmelidir.

Instagram için görsel zorunludur.

sharp ile görsel doğrulama yapılmalıdır:

- format
- genişlik
- yükseklik
- aspect ratio
- dosya boyutu
- platforma uygunluk

Uygun olmayan görseller için kullanıcıya hata verilmeli veya dönüştürme seçeneği sunulmalıdır.

Instagram toplu planlama sırasında aynı Instagram hesabı için aynı 24 saatlik pencereye düşen gönderi sayısı kontrol edilmelidir.

Instagram Content Publishing API tarafında günlük/24 saatlik yayın limitleri olabilir. Eski kaynaklarda yaklaşık 25 gönderi/24 saat limiti geçmektedir, ancak güncel limit geliştirme öncesi Meta dokümanlarından doğrulanmalıdır.

Sistem bu nedenle şu davranışı göstermelidir:

- Bir Instagram hesabı için aynı 24 saate çok fazla gönderi planlanırsa uyarı ver.
- Limit aşımı riski varsa planlamayı engelle veya kullanıcıdan onay iste.
- Limit değeri kodda sabit gömülmemeli, ayarlanabilir olmalıdır.
- Örneğin Setting tablosunda IG_DAILY_POST_LIMIT tutulabilir.

Örnek uyarı:

“Bu Instagram hesabı için aynı 24 saat içine 30 gönderi planlıyorsunuz. Instagram API yayın limitine takılabilirsiniz. Lütfen günlere dağıtın.”

---

## 13. INSTAGRAM PUBLISHER AKIŞI

Instagram yayını tek adım değildir.

InstagramPublisher.publish() şu adımları içermelidir:

1. Geçerli access token al.
2. Görsel için erişilebilir kısa süreli medya URL’i üret.
3. Media container oluştur.
4. Container status kontrolü yap.
5. Container FINISHED durumuna gelirse publish et.
6. Publish sonrası media ID al.
7. Mümkünse permalink bilgisini API’den çek.
8. externalPostId ve externalPostUrl alanlarını kaydet.
9. Başarı logu yaz.
10. Hata varsa sınıflandır.

Tek görsel postlarda container genellikle hızlı hazır olabilir, ancak yine de kısa bir status kontrol mekanizması bulunmalıdır.

Video/Reels MVP kapsamına alınmayacaktır, ancak publisher mimarisi ileride video/reels eklenebilecek şekilde yazılmalıdır.

---

## 14. X / TWITTER PANELİ

X panelinde aktif X hesabı seçimi en üstte olmalıdır.

Kullanıcı X hesabı seçmeden içerik oluşturamamalı veya planlama yapamamalıdır.

Sayfa bölümleri:

1. Aktif X hesabı seçimi
2. Toplu post metni girişi
3. Opsiyonel görsel yükleme
4. Metin-görsel eşleştirme
5. Karakter kontrolü
6. Link kontrolü
7. Kart oluşturma
8. Toplu tarih/saat planlama
9. Kart listesi

X için görsel opsiyoneldir.

X karakter sayımı text.length ile yapılmamalıdır.

Önemli:

Eğer linkUrl platformData içinde ayrı tutuluyorsa ama yayın anında tweet metnine eklenecekse, karakter sayımı son birleşik tweet metni üzerinden yapılmalıdır.

Yani şu ikisi birlikte sayılmalıdır:

- text
- linkUrl

X/Twitter URL’leri t.co mantığıyla sabit uzunlukta sayabilir. Bu yüzden twitter-text benzeri X karakter sayım kurallarına uygun bir kütüphane kullanılmalıdır.

Karakter sınırını aşan içerikler planlanamamalıdır.

X API limitleri ve ücretlendirme geliştirme öncesi güncel olarak kontrol edilmelidir.

---

## 15. WEB SİTESİ / BLOG PANELİ

Web panelinde aktif WordPress sitesi seçimi en üstte olmalıdır.

Kullanıcı site seçmeden içerik oluşturamamalı veya yayın planlayamamalıdır.

Blog içeriği alanları:

- Başlık
- Slug
- İçerik HTML veya rich text
- Kısa açıklama/excerpt
- Öne çıkan görsel
- Kategori
- Etiket
- SEO başlığı
- Meta açıklama
- Yayın tarihi/saat

İlk MVP’de WordPress REST API desteği yeterlidir.

WordPress’in kendi future-dated post zamanlama sistemi kullanılmayacaktır.

Bilinçli tercih:

Tüm zamanlama uygulamanın kendi scheduler sistemi üzerinden yürütülecektir.

Neden?

- Tek durum modeli korunur.
- Telegram hata bildirimi tek yerden yapılır.
- PublishLog tek gerçek kaynak olur.
- Platformlar arasında aynı davranış sağlanır.

WordPress yayınlama akışı:

1. Bağlantı bilgileri decrypt edilir.
2. Site bağlantısı kontrol edilir.
3. Öne çıkan görsel varsa backend dosyayı okur.
4. WordPress /wp/v2/media endpointine binary upload yapılır.
5. Dönen media ID featured_media olarak atanır.
6. /wp/v2/posts endpointi ile yazı oluşturulur.
7. Yazı WordPress’te hemen publish edilir.
8. Başarılıysa externalPostId ve externalPostUrl kaydedilir.
9. Hata varsa loglanır ve Telegram bildirimi gönderilir.

---

## 16. ORTAK İÇERİK DEPOSU

Ortak içerik deposu tüm platform içeriklerini tek listede göstermelidir.

Filtreler:

- Platform
- Hesap/site
- Durum
- Planlandı
- Yayınlandı
- Hata aldı
- Manuel kontrol gerekli
- Tarih aralığı

Her kartta şu bilgiler görünmelidir:

- Platform
- Hesap/site
- Görsel, varsa
- Metin veya başlık
- Planlanan tarih/saat
- Durum
- Son hata
- Düzenle
- Sil
- Planla
- İptal et
- Tekrar dene
- Manuel kontrol gerekli olarak işaretle

---

## 17. MEDYA KÜTÜPHANESİ

Kişisel kullanım için medya dosyaları iki şekilde saklanabilir:

Seçenek 1:
Local storage

Seçenek 2:
S3/R2 object storage

İlk MVP için local storage yeterlidir.

Ancak VPS yedekleme düzenli yapılmalıdır.

MediaFile içinde publicUrl tutulmamalıdır.

Dosya yolu veya storage key tutulmalıdır.

Instagram yayınında platformun görsele erişebilmesi için:

- APP_BASE_URL üzerinden kısa ömürlü erişilebilir medya URL’i üretilebilir.
- Ya da S3/R2 signed URL kullanılabilir.

WordPress için:

- Signed URL vermek yerine backend dosyayı okuyup binary upload yapmalıdır.

---

## 18. SCHEDULER / ZAMANLAYICI

Redis/BullMQ kullanılmayacaktır.

Next.js içinde setInterval kullanılmayacaktır.

Önerilen ana yöntem:

PM2 veya systemd ile çalışan ayrı bir scheduler.ts process.

Alternatif yöntem:

Sistem cron’u her dakika korumalı bir API route çağırabilir.

Önerilen:

scheduler.ts

Bu process her dakika çalışır.

Şu kartları bulur:

status = SCHEDULED
scheduledAt <= now
nextAttemptAt null veya nextAttemptAt <= now

Bulduğu kartları sırayla işler.

Kartı yayınlamadan önce atomik claim yapmalıdır.

Atomik claim:

Sadece status = SCHEDULED olan kart PUBLISHING yapılabilir.

Eğer kart claim edilemezse işlem yapılmaz.

Yayın başarılıysa:

status = PUBLISHED
publishedAt = now
externalPostId kaydedilir
externalPostUrl kaydedilir

Kalıcı hata varsa:

status = FAILED
errorCode kaydedilir
errorMessage kaydedilir
Telegram bildirimi gönderilir

Geçici hata varsa:

status = SCHEDULED
retryCount artırılır
nextAttemptAt belirlenir

Örnek retry mantığı:

1. hata: 5 dakika sonra tekrar dene
2. hata: 15 dakika sonra tekrar dene
3. hata: 60 dakika sonra tekrar dene
   3 denemeden sonra FAILED yap

Geçici hata örnekleri:

- Timeout
- 429 rate limit
- 500/502/503
- geçici bağlantı hatası

Kalıcı hata örnekleri:

- NO_MEDIA
- TOO_LONG
- INVALID_IMAGE_RATIO
- TOKEN_REVOKED
- PERMISSION_MISSING
- ACCOUNT_NOT_CONNECTED
- INVALID_CREDENTIALS
- CONTENT_INVALID

---

## 19. PUBLISHING'DE TAKILI KALAN KARTLAR

Bu konu çok önemlidir.

Bir kart PUBLISHING durumuna geçtiyse ve sistem platforma postu gönderdikten sonra çöktüyse, aynı kartı otomatik yeniden yayınlamak çift paylaşım oluşturabilir.

Bu yüzden PUBLISHING durumunda uzun süre kalan kartlar otomatik yeniden yayınlanmamalıdır.

Önerilen davranış:

- publishingStartedAt 10-15 dakikadan eskiyse
- status hâlâ PUBLISHING ise
- kart MANUAL_CHECK_REQUIRED durumuna alınır
- Telegram ile bildirim gönderilir

Bildirim örneği:

“Manuel kontrol gerekli: Instagram gönderisi PUBLISHING durumunda takılı kaldı. Platformda paylaşılmış olabilir. Lütfen hesabı kontrol et.”

Eğer mümkünse platformdan son gönderiler sorgulanarak externalPostId doğrulanabilir.

Ancak emin olunamıyorsa otomatik tekrar yayın yapılmamalıdır.

---

## 20. PUBLISHER STRATEGY PATTERN

Her platform için ayrı publisher servisi olmalıdır.

Ortak interface:

interface Publisher {
platform: Platform;
publish(ctx: PublishContext): Promise<PublishResult>;
}

Publisher servisleri:

- InstagramPublisher
- XPublisher
- WordPressPublisher

Scheduler şu mantıkla çalışmalıdır:

const publisher = publishers[card.platform];
await publisher.publish(ctx);

Yeni platform eklenirse yeni publisher eklenmelidir.

---

## 21. PUBLISH CONTEXT

Publisher servislerine ortak context verilmelidir.

PublishContext:

- card
- getValidToken()
- getMediaUrl()
- getMediaFile()
- log()
- sendTelegramAlert()
- getPlatformAccount()

getValidToken():

- ilgili hesabı bulur
- encrypted tokenı decrypt eder
- token süresini kontrol eder
- gerekiyorsa refresh eder
- güncel tokenı döndürür
- 401 alınırsa bir kez refresh + retry yapılmasını destekler

---

## 22. TOKEN REFRESH

Token refresh sistemi mutlaka yapılmalıdır.

X için:

- Access token kısa ömürlü olabilir.
- Refresh token saklanmalıdır.
- Yayın öncesi token geçerliliği kontrol edilmelidir.
- Token süresi dolmuşsa yenilenmelidir.
- API 401 dönerse token bir kez yenilenip işlem tekrar denenmelidir.

Instagram için:

- Long-lived token yönetimi yapılmalıdır.
- Token süresi yaklaşınca yenileme yapılmalıdır.
- Token expired olursa bağlantı durumu TOKEN_EXPIRED yapılmalıdır.
- Telegram bildirimi gönderilmelidir.

WordPress için:

- Application password test edilmelidir.
- Bağlantı hatalarında connectionStatus FAILED yapılmalıdır.

---

## 23. LOG SİSTEMİ

PublishLog tablosu tutulmalıdır.

Notification tablosu MVP’de gerekli değildir.

Panelde “Son Aktiviteler” PublishLog üzerinden gösterilebilir.

Loglanacak olaylar:

- PLAN_CREATED
- SCHEDULER_STARTED
- CLAIM_OK
- CLAIM_SKIPPED
- TOKEN_REFRESHED
- TOKEN_REFRESH_FAILED
- MEDIA_VALIDATED
- MEDIA_UPLOADED
- CONTAINER_CREATED
- CONTAINER_STATUS_CHECKED
- PUBLISH_STARTED
- PUBLISH_OK
- PUBLISH_FAILED
- RETRY_SCHEDULED
- PERMANENT_FAILURE
- MANUAL_CHECK_REQUIRED

Her logda:

- platform
- accountId
- contentCardId
- action
- status
- errorCode
- errorMessage
- apiResponse
- createdAt

bulunmalıdır.

API response içinde token, secret, authorization header gibi hassas veriler maskelenmelidir.

---

## 24. TELEGRAM BİLDİRİMLERİ

Telegram bildirimi çok önemlidir.

Sessiz hata olmamalıdır.

Ayarlar veya .env içinde:

TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID

bulunmalıdır.

Bildirim gönderilecek durumlar:

- Yayın başarılı
- Yayın başarısız
- Token expired
- Bağlantı yenileme gerekli
- Manuel kontrol gerekli
- Çoklu retry başarısız
- WordPress bağlantısı başarısız
- X API limiti veya credential hatası
- Instagram günlük limit uyarısı

Bildirim mesajları açık ve anlaşılır olmalıdır.

Örnek:

“@hisaradak Instagram gönderisi başarısız oldu.
Hata: TOKEN_EXPIRED
Çözüm: Instagram bağlantısını yenile.”

Örnek:

“Manuel kontrol gerekli.
Kart ID: 123
Platform: INSTAGRAM
Sebep: PUBLISHING durumunda takılı kaldı. Çift paylaşımı önlemek için otomatik tekrar denenmedi.”

---

## 25. YEDEKLEME

Bu proje kişisel olduğu için yedekleme unutulmamalıdır.

Eğer SQLite kullanılırsa:

- database.sqlite dosyası düzenli yedeklenmelidir.
- medya klasörü düzenli yedeklenmelidir.

Eğer PostgreSQL kullanılırsa:

- pg_dump ile düzenli yedek alınmalıdır.
- medya dosyaları ayrıca yedeklenmelidir.

Çok önemli:

ENCRYPTION_KEY de ayrıca yedeklenmelidir.

Çünkü tokenlar ENCRYPTION_KEY ile şifrelenmiştir.

ENCRYPTION_KEY kaybedilirse:

- DB yedeği işe yarar ama tokenlar çözülemez.
- Instagram hesaplarını yeniden bağlamak gerekir.
- X hesaplarını yeniden bağlamak gerekir.
- WordPress application password bilgilerini yeniden girmek gerekir.

Bu yüzden:

- ENCRYPTION_KEY güvenli bir yerde saklanmalıdır.
- DB yedeğiyle aynı yerde düz şekilde tutulmamalıdır.
- Sunucu değişirse aynı ENCRYPTION_KEY yeni sunucuya taşınmalıdır.
- .env dosyası güvenli şekilde yedeklenmelidir.

Öneri:

- Günlük veritabanı yedeği
- Haftalık medya yedeği
- .env ve ENCRYPTION_KEY için ayrı güvenli yedek
- Yedeklerin farklı bir konuma kopyalanması

---

## 26. DEPLOYMENT

Uygulama her zaman açık çalışan bir ortamda çalışmalıdır.

Laptop veya kişisel bilgisayarda çalıştırmak doğru değildir.

Çünkü bilgisayar kapalıyken zamanlanmış içerikler paylaşılmaz.

Önerilen deployment:

- Küçük VPS
- Docker veya PM2
- Nginx reverse proxy
- HTTPS
- Next.js web app
- Ayrı scheduler.ts process
- Düzenli backup

PM2 örnek süreçleri:

- content-panel-web
- content-panel-scheduler

APP_BASE_URL doğru ayarlanmalıdır.

Instagram gibi platformların medya URL’lerine erişebilmesi için gerekli durumlarda medya endpoint’leri dışarıdan erişilebilir olmalıdır.

---

## 27. GÜVENLİK

Kişisel proje olsa bile güvenlik önemlidir.

Çünkü uygulama sosyal medya hesap tokenlarını tutar ve benim adıma paylaşım yapabilir.

Kurallar:

- Secret bilgiler .env içinde olmalıdır.
- .env asla GitHub’a gönderilmemelidir.
- Tokenlar encrypted saklanmalıdır.
- ENCRYPTION_KEY güvenli saklanmalıdır.
- Şifre hashlenmelidir.
- Uygulama internete açıksa login zorunlu olmalıdır.
- HTTPS kullanılmalıdır.
- Rate limit eklenebilir.
- Telegram Bot Token gizli tutulmalıdır.
- Medya dosyaları kontrolsüz public olmamalıdır.
- API response loglarında secret/token maskelenmelidir.

---

## 28. AI MODÜLÜ

AI modülü ilk MVP’de zorunlu değildir.

İkinci aşamada eklenebilir.

AI özellikleri:

Instagram:

- Caption önerisi
- Hashtag önerisi
- Metni profesyonelleştirme

X:

- Kısa post önerisi
- Karakter sınırına göre kısaltma
- Alternatif post önerisi

WordPress:

- Blog başlığı
- SEO başlığı
- Meta açıklama
- İçerik taslağı
- Yazım düzeltme

AI hiçbir içeriği otomatik yayınlamamalıdır.

AI sadece öneri sunmalıdır.

Son karar kullanıcıda olmalıdır.

---

## 29. MVP GELİŞTİRME SIRASI

Aşama 1:

- Next.js proje kurulumu
- Prisma kurulumu
- SQLite veya PostgreSQL kararı
- Basit tek kullanıcı login sistemi
- Seed script veya ilk açılışta admin oluşturma
- .env yapılandırması
- TIMEZONE desteği

Aşama 2:

- Veritabanı modelleri
- Setting tablosu
- PublishLog tablosu
- ContentCard modeli
- Platform/status enumları

Aşama 3:

- Medya yükleme
- sharp ile görsel doğrulama
- Medya kütüphanesi

Aşama 4:

- Hesap bağlantıları
- InstagramAccount
- XAccount
- WordPressSite
- Bağlantı testleri
- Token encryption/decryption

Aşama 5:

- Instagram paneli
- Toplu metin
- Toplu görsel
- Görsel sıralama
- Eşleştirme önizlemesi
- Instagram günlük limit uyarısı
- Kart oluşturma
- Toplu planlama

Aşama 6:

- Ortak içerik deposu
- Kart düzenleme
- Kart silme
- Planlama
- İptal etme

Aşama 7:

- Ayrı scheduler.ts process
- Dakikalık polling
- Atomik claim
- Retry mantığı
- PUBLISHING takılı kalma kontrolü
- Timezone-aware scheduling

Aşama 8:

- Publisher interface
- InstagramPublisher
- WordPressPublisher
- XPublisher

Aşama 9:

- Telegram bildirimleri
- Hata mesajları
- Log ekranı

Aşama 10:

- Backup scriptleri
- Deployment
- Production testleri

AI ve gelişmiş özellikler ikinci aşamada yapılmalıdır.

---

## 30. MVP’DE OLMAYACAKLAR

İlk MVP’de şu özellikler yapılmayacaktır:

- SaaS kullanıcı sistemi
- Çoklu tenant
- Workspace
- Süper admin
- Plan/paket sistemi
- Ödeme sistemi
- Redis
- BullMQ
- Notification tablosu
- Gelişmiş AI
- Gelişmiş analytics
- Ekip üyeleri
- Mobil uygulama
- X thread
- Instagram Reels
- Instagram carousel
- Video upload

Önce tek görsel + metin + blog yayını + zamanlama + hata bildirimi sağlam kurulmalıdır.

---

## 31. KRİTİK KURALLAR

1. Proje SaaS değildir, kişisel kullanım içindir.
2. Workspace, tenant, plan, süper admin yapılmayacaktır.
3. Kayıt ekranı olmayacaktır.
4. Tek kullanıcı seed script veya ilk açılışta .env’den oluşturulacaktır.
5. API app secret bilgileri .env içinde tutulacaktır.
6. Hesap tokenları ilgili hesap tablolarında encrypted saklanacaktır.
7. ENCRYPTION_KEY kaybedilmemeli ve ayrıca yedeklenmelidir.
8. TIMEZONE=Europe/Istanbul zorunludur.
9. scheduledAt UTC saklanmalıdır.
10. Panelde tarih/saat yerel timezone ile gösterilmelidir.
11. Tek ContentCard modeli kullanılacaktır.
12. READY ve APPROVED statusları kullanılmayacaktır.
13. platformData JSON alanı Zod ile validate edilecektir.
14. Instagram, X ve WordPress için ayrı publisher servisleri olacaktır.
15. Redis/BullMQ kullanılmayacaktır.
16. Next.js içinde setInterval kullanılmayacaktır.
17. Ayrı scheduler.ts process veya sistem cron kullanılacaktır.
18. Scheduler atomik claim yapmalıdır.
19. Çift paylaşım engellenmelidir.
20. PUBLISHING durumunda takılı kalan kartlar otomatik tekrar yayınlanmamalıdır.
21. Telegram hata bildirimi zorunludur.
22. PublishLog tutulmalıdır.
23. Notification tablosu MVP’de yapılmayabilir.
24. sharp ile görsel doğrulama yapılmalıdır.
25. Instagram günlük/24 saatlik yayın limiti için uyarı sistemi olmalıdır.
26. Instagram publish akışı container oluşturma, status kontrolü ve publish adımlarını içermelidir.
27. X karakter sayımı text.length ile yapılmamalıdır.
28. X karakter sayımı son birleşik tweet metni üzerinden yapılmalıdır.
29. WordPress’in kendi future scheduling sistemi kullanılmayacaktır.
30. WordPress medya upload binary yapılmalıdır.
31. Instagram için medya URL erişimi doğru çözülmelidir.
32. Uygulama always-on VPS üzerinde çalışmalıdır.
33. Düzenli backup yapılmalıdır.
34. AI ikinci aşamadır.
35. Son karar kullanıcıda olmalıdır.
36. Sessiz başarısızlık olmamalıdır.

---

## 32. SONUÇ

Bu proje bana özel, tek kullanıcılı, Instagram, X/Twitter ve WordPress/web sitesi içeriklerini planlayıp otomatik yayınlayan kişisel bir içerik operasyon panelidir.

SaaS olmadığı için mimari sade tutulmalıdır.

Gereksiz tenant, workspace, admin, plan, Redis/BullMQ ve çok kullanıcı katmanları eklenmemelidir.

Ancak platform API’lerinden gelen gerçek karmaşıklıklar korunmalıdır:

- Instagram API gereksinimleri
- Instagram 24 saatlik yayın limiti kontrolü
- Instagram container oluşturma ve publish akışı
- X API token ve limitleri
- X doğru karakter sayımı
- WordPress REST API medya upload
- Token refresh
- Timezone-aware scheduling
- Görsel validasyonu
- Çift paylaşım engeli
- Telegram hata uyarısı
- ENCRYPTION_KEY yedekleme
- Düzenli backup
- Always-on sunucu

Amaç büyük ve karmaşık bir ürün yapmak değildir.

Amaç sade, güvenilir, kişisel kullanım için yeterli, hata olduğunda uyaran ve zamanı geldiğinde içerikleri doğru platforma gönderen sağlam bir web uygulaması geliştirmektir.
