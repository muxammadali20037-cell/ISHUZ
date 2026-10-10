#!/usr/bin/env bash
# 1 mln foydalanuvchilik yuklama testi: toza lokal baza → migratsiyalar → sintetik ma'lumot → so'rovlar vaqti.
# Foydalanish: npm run db:load   (yoki DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ishuz_load bash scripts/load-test.sh)
# Faqat lokal Postgres: masofaviy (Supabase) bazaga ulanmaydi.
set -euo pipefail
cd "$(dirname "$0")/.."
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/ishuz_load}"
case "$DATABASE_URL" in
  *@127.0.0.1:*|*@localhost:*|*@127.0.0.1/*|*@localhost/*) ;;
  *) echo "Faqat lokal baza (127.0.0.1/localhost) — yuklama testi masofaviy bazada ishlatilmaydi" >&2; exit 1 ;;
esac
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
echo "→ toza baza va migratsiyalar"
if ! DATABASE_URL="$DATABASE_URL" bash scripts/db-local.sh > "$log" 2>&1; then cat "$log" >&2; exit 1; fi
echo "→ 1 mln profil, 700 ming ishchi, 600 ming vakansiya, 3 mln bildirishnoma, 500 ming ariza (1–3 daqiqa)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f scripts/load/seed-1m.sql > /dev/null
PGOPTIONS="-c random_page_cost=1.1" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/load/bench.sql 2>&1 | grep -o "NOTICE:.*" | sed 's/^NOTICE:  //'
