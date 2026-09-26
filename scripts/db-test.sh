#!/usr/bin/env bash
# Migratsiyalarni toza bazaga qo'llab, SQL testlarni ishga tushiradi.
set -euo pipefail
cd "$(dirname "$0")/.."
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/ishuz_test}"
DATABASE_URL="$DATABASE_URL" bash scripts/db-local.sh
for f in supabase/tests/*.sql; do
  echo "→ $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -E "^(NOTICE|psql|ERROR|✓)" | sed 's/^NOTICE:  //' || true
  # psql grep orqali exit kodini yo'qotmaslik uchun qayta tekshiramiz
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null 2>&1
done
echo "✓ SQL testlar o'tdi"
