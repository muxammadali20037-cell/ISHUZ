#!/usr/bin/env bash
# supabase/prod/pending.sql ni prod'ga o'xshash bazada sinaydi (prod'ga TEGMAYDI — faqat lokal/CI Postgres):
#   1) toza baza + faqat prod'da bor migratsiyalar (0001…APPLIED_UNTIL);
#   2) pending.sql — xatosiz qo'llanadi, holat jadvalida hammasi "bor";
#   3) pending.sql YANA BIR MARTA — xatosiz, sxema o'zgarmaydi (takror ishga tushirish xavfsiz);
#   4) natija sxemasi barcha migratsiyalar ketma-ket qo'llangan baza bilan bir xil.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/ishuz_test}"
ADMIN="${BASE%/*}/postgres"
SIM="${BASE%/*}/ishuz_prodsim"
FULL="${BASE%/*}/ishuz_prodfull"
UNTIL="$(node -e 'import("./scripts/gen-prod-pending.mjs").then((m) => console.log(m.APPLIED_UNTIL))')"

node scripts/gen-prod-pending.mjs --check

fresh() { # $1 = baza URL, $2 = oxirgi migratsiya raqami (shu jumladan)
  psql "$ADMIN" -v ON_ERROR_STOP=1 -q -c "drop database if exists ${1##*/} with (force);" -c "create database ${1##*/};" 2> /dev/null
  psql "$1" -v ON_ERROR_STOP=1 -q -f scripts/supabase-stub.sql > /dev/null 2>&1
  for f in $(ls supabase/migrations/*.sql | sort); do
    n="$(basename "$f" | cut -c1-4)"
    if [ "$((10#$n))" -le "$2" ]; then psql "$1" -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null 2>&1 || { echo "XATO: $f"; exit 1; }; fi
  done
}
schema() { psql "$1" -v ON_ERROR_STOP=1 -At -f scripts/schema-fingerprint.sql; }

fresh "$SIM" "$UNTIL"
echo "→ prod'ga o'xshash baza: 0001…$(printf '%04d' "$UNTIL")"

psql "$SIM" -v ON_ERROR_STOP=1 -q -f supabase/prod/pending.sql > /tmp/pending-1.out 2>&1 || { echo "XATO: pending.sql (1-marta)"; grep -m3 ERROR /tmp/pending-1.out; exit 1; }
if grep -q "YO'Q" /tmp/pending-1.out; then echo "XATO: holat jadvalida YO'Q bor"; grep "YO'Q" /tmp/pending-1.out; exit 1; fi
echo "→ pending.sql qo'llandi: holat jadvalida hammasi \"bor\""
schema "$SIM" > /tmp/pending-schema-1.sql

psql "$SIM" -v ON_ERROR_STOP=1 -q -f supabase/prod/pending.sql > /tmp/pending-2.out 2>&1 || { echo "XATO: pending.sql (takror)"; grep -m3 ERROR /tmp/pending-2.out; exit 1; }
schema "$SIM" > /tmp/pending-schema-2.sql
diff -q /tmp/pending-schema-1.sql /tmp/pending-schema-2.sql > /dev/null || { echo "XATO: takror ishga tushirish sxemani o'zgartirdi"; diff /tmp/pending-schema-1.sql /tmp/pending-schema-2.sql | head -20; exit 1; }
echo "→ takror ishga tushirish: xatosiz, sxema o'zgarmadi"

fresh "$FULL" 9999
schema "$FULL" > /tmp/pending-schema-full.sql
diff -q /tmp/pending-schema-1.sql /tmp/pending-schema-full.sql > /dev/null || { echo "XATO: pending.sql natijasi to'liq migratsiyalar bazasidan farq qiladi"; diff /tmp/pending-schema-1.sql /tmp/pending-schema-full.sql | head -20; exit 1; }
echo "→ natija sxemasi barcha migratsiyalar qo'llangan baza bilan bir xil"

psql "$ADMIN" -q -c "drop database if exists ${SIM##*/} with (force);" -c "drop database if exists ${FULL##*/} with (force);" 2> /dev/null
echo "✓ pending.sql sinovdan o'tdi"
