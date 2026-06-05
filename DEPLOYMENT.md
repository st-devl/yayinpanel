# Patlat Dağıtım (Deployment) Notları

Tek kullanıcılı, self-host bir panel için pratik dağıtım rehberi.

---

## 1. Ortam Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve doldurun:

```bash
cp .env.example .env
```

Kritik değerler:

- `ENCRYPTION_KEY`: 64 karakter hex (32 byte). Üretmek için:
  ```bash
  openssl rand -hex 32
  ```
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: en az 12 karakter parola.
- `APP_BASE_URL`: uygulamanın **dışarıdan erişilen** tam URL'i
  (örn. `https://panel.ornek.com`). Instagram signed media URL'leri ve
  OAuth dönüşleri bu değere göre üretilir; yanlışsa Instagram yayını başarısız olur.

---

## 2. Docker Compose ile Dağıtım (Önerilen)

### 2.1. Ön Gereksinimler (Ubuntu/Debian)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login gerektirir

# Docker Compose plugin
sudo apt-get install docker-compose-plugin
```

### 2.2. Projeyi sunucuya al

```bash
git clone <repo-url> /opt/patlat
cd /opt/patlat
cp .env.example .env
nano .env   # değerleri doldur
```

### 2.3. Başlat

```bash
docker compose up -d --build
docker compose logs -f   # logları izle
```

İki container çalışacak:
- `patlat-web` — Next.js web uygulaması (port 3000, sadece localhost)
- `patlat-scheduler` — Dakikalık yayın zamanlayıcısı (web healthy olduktan sonra başlar)

### 2.4. Güncelleme

Bu repo için tek komutlu production deploy:

```bash
npm run deploy
```

Bu komut değişiklikleri commit edip GitHub'a push eder, ardından
`root@yayinpanel.cloud` üzerindeki `/opt/patlat` dizininde aşağıdaki güncelleme
akışını çalıştırır. Farklı SSH kullanıcısı veya anahtarı gerekirse
`DEPLOY_HOST` ve `DEPLOY_KEY` ortam değişkenleriyle verilebilir.

Sunucuda elle çalıştırılacak karşılığı:

```bash
cd /opt/patlat
git pull --ff-only
docker compose up -d --build
```

---

## 3. Nginx + HTTPS

### 3.1. Nginx kurulumu

```bash
sudo apt-get install nginx certbot python3-certbot-nginx
```

### 3.2. Nginx yapılandırması

`/etc/nginx/sites-available/patlat` dosyasını oluşturun:

```nginx
server {
    listen 80;
    server_name panel.ornek.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name panel.ornek.com;

    ssl_certificate     /etc/letsencrypt/live/panel.ornek.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.ornek.com/privkey.pem;

    # Medya upload limiti (10 MB batch + pay)
    client_max_body_size 30m;

    # AI işleme 120 saniyeye kadar sürebilir
    proxy_read_timeout  150s;
    proxy_send_timeout  150s;
    proxy_connect_timeout 10s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/patlat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3.3. SSL sertifikası

```bash
sudo certbot --nginx -d panel.ornek.com
```

`APP_BASE_URL` mutlaka `https://` ile başlamalıdır (oturum çerezi `secure` olarak ayarlanır).

---

## 4. PM2 ile Dağıtım (Docker olmadan)

### 4.1. Ön Gereksinimler

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install nodejs

# PM2
npm i -g pm2
```

### 4.2. Kurulum

```bash
git clone <repo-url> /opt/patlat
cd /opt/patlat
cp .env.example .env
nano .env

npm ci
npx prisma migrate deploy
npm run seed
npm run build
```

### 4.3. Başlat

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # sistem açılışında otomatik başlatma
```

- `patlat-web`: Next.js (varsayılan port `APP_PORT` / 3000)
- `patlat-scheduler`: Dakikalık yayın zamanlayıcısı

Scheduler dry-run testi:

```bash
npm run scheduler:dry
```

---

## 5. Yedekleme

Düzenli yedek için cron örneği (her gece 03:00):

```bash
crontab -e
```

```cron
0 3 * * * cd /opt/patlat && DATABASE_URL=file:./prisma/dev.db ./scripts/backup-db.sh /opt/patlat-backups
15 3 * * * cd /opt/patlat && STORAGE_DIR=storage ./scripts/backup-media.sh /opt/patlat-backups
```

Docker kullanıyorsanız volume path'lerini kullanın:

```cron
0 3 * * * docker exec patlat-web sh -c 'cp /app/data/dev.db /app/data/backup-$(date +%Y%m%d).db'
```

Scriptler 14 günden eski yedekleri otomatik temizler.

### ⚠️ ENCRYPTION_KEY ve .env Yedekleme Uyarısı

- **`ENCRYPTION_KEY` kaybedilirse** veritabanındaki tüm şifreli token,
  API anahtarı ve platform credentials **kalıcı olarak çözülemez**.
- `.env` dosyasını ve `ENCRYPTION_KEY` değerini veritabanı yedeğinden
  **ayrı**, güvenli bir parola yöneticisinde / kasada saklayın.
- Yedekten geri dönüşte aynı `ENCRYPTION_KEY` kullanılmalıdır.
- `.env` dosyası repoya commit edilmemelidir (`.gitignore` içinde).

---

## 6. Sorun Giderme

### Container başlamıyor

```bash
docker compose logs web
docker compose logs scheduler
```

### Scheduler çalışmıyor

```bash
docker compose exec web npm run scheduler:dry
```

### Veritabanı migration hatası

```bash
docker compose exec web npx prisma migrate status
docker compose exec web npx prisma migrate deploy
```

### AI işleme timeout alıyor

Nginx `proxy_read_timeout` değerinin en az `150s` olduğunu doğrulayın.
API rotasının `export const maxDuration = 120` olarak ayarlı olduğunu kontrol edin.
