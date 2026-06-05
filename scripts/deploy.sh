#!/usr/bin/env bash
#
# Tek komutla deploy: commit + push + production sunucusunda Docker restart.
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
DEPLOY_HOST="${DEPLOY_HOST:-root@yayinpanel.cloud}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/patlat}"
DEPLOY_APP_URL="${DEPLOY_APP_URL:-https://yayinpanel.cloud}"

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=4
)

DEPLOY_SSH_BATCH_MODE="${DEPLOY_SSH_BATCH_MODE:-auto}"
if [[ "$DEPLOY_SSH_BATCH_MODE" == "yes" ]] ||
  [[ "$DEPLOY_SSH_BATCH_MODE" == "auto" && ! -t 0 ]]; then
  SSH_OPTS+=(-o BatchMode=yes)
fi

if [[ -n "${DEPLOY_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_KEY" -o IdentitiesOnly=yes)
fi

if [[ -n "${DEPLOY_PORT:-}" ]]; then
  SSH_OPTS+=(-p "$DEPLOY_PORT")
fi

echo "▶ 1/4  Değişiklikler commit ediliyor..."
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MSG"
  echo "  ✓ Commit: $MSG"
else
  echo "  • Commit edilecek değişiklik yok, mevcut sürümle devam"
fi

echo "▶ 2/4  GitHub'a push ediliyor (origin/$BRANCH)..."
git push origin "$BRANCH"
echo "  ✓ Push tamam"

echo "▶ 3/4  Production sunucusu güncelleniyor ($DEPLOY_HOST:$DEPLOY_PATH)..."
if ! ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" \
  "DEPLOY_PATH=$(printf '%q' "$DEPLOY_PATH") DEPLOY_BRANCH=$(printf '%q' "$BRANCH") DEPLOY_APP_URL=$(printf '%q' "$DEPLOY_APP_URL") bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

cd "$DEPLOY_PATH"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "HATA: $DEPLOY_PATH bir git repository'si değil."
  exit 1
fi

REMOTE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$REMOTE_BRANCH" != "$DEPLOY_BRANCH" ]]; then
  echo "HATA: Sunucu branch'i '$REMOTE_BRANCH', beklenen '$DEPLOY_BRANCH'."
  exit 1
fi

git fetch origin "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"

if [[ -f .env ]]; then
  APP_BASE_URL_VALUE="$(grep -E '^APP_BASE_URL=' .env | tail -n 1 | cut -d= -f2- || true)"
  if [[ -n "$APP_BASE_URL_VALUE" && "$APP_BASE_URL_VALUE" != "$DEPLOY_APP_URL" ]]; then
    echo "UYARI: Sunucudaki APP_BASE_URL '$APP_BASE_URL_VALUE'. Beklenen: '$DEPLOY_APP_URL'."
  fi
else
  echo "UYARI: Sunucuda .env bulunamadı; production ayarlarını kontrol et."
fi

docker compose up -d --build

echo "▶ 4/4  Production servis durumu:"
docker compose ps
REMOTE_SCRIPT
then
  cat <<EOF
HATA: Production sunucusuna SSH ile deploy çalışmadı.
Host: $DEPLOY_HOST
Path: $DEPLOY_PATH

Bu makineden sunucuya SSH erişimi tanımlı olmalı. Gerekirse:
  DEPLOY_HOST=user@yayinpanel.cloud npm run deploy
  DEPLOY_KEY=/path/to/key npm run deploy
EOF
  exit 1
fi

echo "✅ Deploy tamamlandı."
