#!/usr/bin/env bash
#
# Tek komutla deploy: commit + push + Docker yeniden build & restart.
#
# Kullanım:
#   npm run deploy                # otomatik commit mesajı (tarih/saat)
#   npm run deploy "mesajım"      # kendi commit mesajınla
#
set -euo pipefail

# Proje köküne geç (script nereden çağrılırsa çağrılsın)
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

echo "▶ 1/4  Değişiklikler commit ediliyor..."
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MSG"
  echo "  ✓ Commit: $MSG"
else
  echo "  • Commit edilecek değişiklik yok, mevcut sürümle devam"
fi

echo "▶ 2/4  GitHub'a push ediliyor (origin/$BRANCH)..."
# Push başarısız olursa (örn. internet yok) deploy yine de devam etsin;
# Docker imajı yerel dosyalardan build edildiği için canlı yine güncellenir.
if git push origin "$BRANCH"; then
  echo "  ✓ Push tamam"
else
  echo "  ⚠ Push başarısız — deploy yerel kodla devam ediyor (sonra push edebilirsin)"
fi

echo "▶ 3/4  Docker imajı yeniden build edilip çalıştırılıyor..."
docker compose up -d --build

echo "▶ 4/4  Servis durumu:"
docker compose ps

echo "✅ Deploy tamamlandı."
