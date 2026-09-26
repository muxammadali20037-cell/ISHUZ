#!/usr/bin/env bash
# Lokal PostgreSQL da Supabase muhitini taqlid qilib migratsiyalarni qo'llaydi.
# Foydalanish: DATABASE_URL=postgres://postgres:postgres@127.0.0.1/ishuz_dev npm run db:local
set -euo pipefail
cd "$(dirname "$0")/.."
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/ishuz_dev}"
ADMIN_URL="${DATABASE_URL%/*}/postgres"
DBNAME="${DATABASE_URL##*/}"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DBNAME with (force);" -c "create database $DBNAME;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f scripts/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "✓ migratsiyalar qo'llandi: $DATABASE_URL"
