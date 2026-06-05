#!/bin/sh
# SQLite veritabani yedekleme scripti.
# Kullanim: ./scripts/backup-db.sh [hedef_klasor]
# Ortam: DATABASE_URL=file:./dev.db  (varsayilan)
set -eu

BACKUP_DIR="${1:-${BACKUP_PATH:-./backups}}"
DATABASE_URL="${DATABASE_URL:-file:./dev.db}"

case "$DATABASE_URL" in
  file:*) DB_PATH="${DATABASE_URL#file:}" ;;
  *)
    echo "Sadece SQLite (file:) veritabanlari desteklenir: $DATABASE_URL" >&2
    exit 1
    ;;
esac

if [ ! -f "$DB_PATH" ]; then
  echo "Veritabani bulunamadi: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/patlat-db-$TIMESTAMP.sqlite"

# Tutarli yedek icin sqlite3 .backup kullanilir (kilit guvenli).
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$TARGET'"
else
  cp "$DB_PATH" "$TARGET"
fi

echo "Veritabani yedegi olusturuldu: $TARGET"

# 14 gunden eski yedekleri temizle.
find "$BACKUP_DIR" -name "patlat-db-*.sqlite" -type f -mtime +14 -delete 2>/dev/null || true
