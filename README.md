# Patlat

Kisisel icerik planlama ve otomatik yayinlama paneli. MVP kapsaminda
Instagram, X ve WordPress icerikleri tek kullanicili bir panelden hazirlanir,
ortak depoda saklanir, scheduler ile yayinlanir ve loglanir.

## Hizli Baslangic

```bash
cp .env.example .env
openssl rand -hex 32
```

Uretilen 64 karakter hex degeri `.env` icindeki `ENCRYPTION_KEY` alanina
yazin. `ADMIN_EMAIL`, `ADMIN_PASSWORD` ve `APP_BASE_URL` degerlerini de
ortaminiza gore guncelleyin.

```bash
npm ci
npx prisma migrate deploy
npm run seed
npm run dev
```

Local web adresi varsayilan olarak:

```text
http://localhost:3000
```

Scheduler web processinden ayridir ve ikinci terminalde calismalidir:

```bash
npm run scheduler
npm run scheduler:dry
```

## Demo Veri

Paneli gercek platform tokenlari olmadan gezmek icin opsiyonel demo seed:

```bash
npm run seed:demo
```

Demo seed sahte hesaplari `DISCONNECTED` durumunda olusturur. Bu sayede
hesap, medya, ortak icerik, dashboard ve log ekranlari dolu gorunur; otomatik
yayinlanabilecek yakin tarihli sahte kart uretilmez.

## Komutlar

| Komut                    | Aciklama                                     |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Gelistirme sunucusu                          |
| `npm run build`          | Production build                             |
| `npm run start`          | Production web process                       |
| `npm run scheduler`      | Dakikalik polling yapan bagimsiz scheduler   |
| `npm run scheduler:dry`  | Scheduler kontrolu, yayin yapmaz             |
| `npm run seed`           | Admin kullanici ve varsayilan ayarlari ekler |
| `npm run seed:demo`      | Opsiyonel gezilebilir demo veri ekler        |
| `npm run lint`           | ESLint                                       |
| `npm run typecheck`      | TypeScript kontrolu                          |
| `npm test`               | Unit + integration testler                   |
| `npm run test:ui`        | Playwright desktop/mobile UI smoke testleri  |
| `npm run compare:design` | Design screenshot audit raporu               |

Tasarim karsilastirma komutu calisan bir web sunucusu bekler. Raporlar
`test-results/design-comparison` altina yazilir.

## Mimari

- Next.js App Router + React + TypeScript.
- Tailwind tabanli yerel tasarim sistemi.
- Prisma + SQLite; token ve application password degerleri
  `ENCRYPTION_KEY` ile AES-256-GCM olarak saklanir.
- Tek `ContentCard` modeli; platforma ozel alanlar `platformData` validation
  katmanindan gecer.
- Publisher katmani Instagram, X ve WordPress icin ortak arayuz kullanir.
- Scheduler Next.js icinde `setInterval` kullanmaz; ayri Node process olarak
  atomik claim, retry/backoff, manual-check ve Telegram bildirimlerini yonetir.

## Docker

```bash
docker compose up --build
```

Container acilisinda migration ve seed uygulanir. Kalici volume'lar:

- `patlat-data`: SQLite veritabani
- `patlat-storage`: medya dosyalari

## Deployment

PM2, Nginx/HTTPS, Docker, scheduler ve cron backup notlari
[DEPLOYMENT.md](./DEPLOYMENT.md) icindedir. Production icin `APP_BASE_URL`
mutlaka disaridan erisilen HTTPS adresi olmalidir.

Canli sunucuya deploy:

```bash
npm run deploy
```

## Backup

SQLite ve medya yedekleri ayri scriptlerle alinir:

```bash
DATABASE_URL=file:./prisma/dev.db ./scripts/backup-db.sh ./backups
STORAGE_DIR=storage ./scripts/backup-media.sh ./backups
```

Scriptler 14 gunden eski kendi yedeklerini temizler. `.env` ve
`ENCRYPTION_KEY` veritabani yedeginden ayri, guvenli bir yerde saklanmalidir.

## Bilinen Sinirlar

- MVP tek kullanicilidir; tenant, ekip, odeme ve SaaS akislari yoktur.
- Video yukleme MVP disidir; medya kutuphanesi JPG, PNG ve WEBP destekler.
- Gercek yayin icin platform API credentiallari ve hesap baglantilari gerekir.
- WordPress future scheduling kullanilmaz; zamanlama uygulama scheduler
  kuyruğundan yonetilir.
- Demo hesaplar yayin yapmaz; gercek hesaplarla degistirilmelidir.

## Guvenlik ve Performans Notlari

- `.env` repoya commit edilmemelidir.
- Tokenlar API response ve loglarda maskelenir; veritabaninda plain text
  saklanmaz.
- `ENCRYPTION_KEY` kaybolursa sifreli hesap credentiallari geri acilamaz.
- Scheduler sorgulari status ve tarih indexleri uzerinden calisir.
- Medya binaryleri API uzerinden kisitli cache headerlariyla servis edilir.
- Yakin donem buyumede SQLite yerine PostgreSQL'e gecis degerlendirilmelidir.
