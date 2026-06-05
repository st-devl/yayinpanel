#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [ -z "${ENCRYPTION_KEY:-}" ]; then
  echo "ENCRYPTION_KEY is required" >&2
  exit 1
fi

case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    case "$DB_PATH" in
      /*) ;;
      *) DB_PATH="/app/$DB_PATH" ;;
    esac
    mkdir -p "$(dirname "$DB_PATH")"
    if [ ! -f "$DB_PATH" ]; then
      sqlite3 "$DB_PATH" "PRAGMA user_version;" >/dev/null
    fi
    ;;
esac

npx prisma migrate deploy
npm run seed

exec "$@"
