#!/bin/sh
# Medya klasoru yedekleme scripti.
# Kullanim: ./scripts/backup-media.sh [hedef_klasor]
# Ortam: STORAGE_DIR=storage (varsayilan)
set -eu

BACKUP_DIR="${1:-${BACKUP_PATH:-./backups}}"
STORAGE_DIR="${STORAGE_DIR:-storage}"

if [ ! -d "$STORAGE_DIR" ]; then
  echo "Medya klasoru bulunamadi: $STORAGE_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/patlat-media-$TIMESTAMP.tar.gz"

tar -czf "$TARGET" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"

echo "Medya yedegi olusturuldu: $TARGET"

# 14 gunden eski yedekleri temizle.
find "$BACKUP_DIR" -name "patlat-media-*.tar.gz" -type f -mtime +14 -delete 2>/dev/null || true
