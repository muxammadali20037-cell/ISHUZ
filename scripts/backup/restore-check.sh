#!/usr/bin/env bash
# Zaxira nusxani ALOHIDA lokal bazaga tiklab tekshiradi (production'ga hech qachon yozmaydi).
#
#   AGE_IDENTITY=~/.ishuz-backup.key bash scripts/backup/restore-check.sh backups/ishuz-<vaqt>.dump.age
#
# - Shifrlangan (.age) bo'lsa AGE_IDENTITY — yopiq kalit fayli.
# - RESTORE_URL — sukut postgres://postgres:postgres@127.0.0.1:5432/ishuz_restore_check (faqat lokal).
# - Tiklangandan keyin: jadvallar soni, RLS yoqilgan jadvallar, asosiy jadvallardagi qatorlar soni chiqariladi.
#   EXPECT_COUNTS="profiles=123 vacancies=45" berilsa — solishtiriladi (farq bo'lsa xato).
set -euo pipefail
dump="${1:?zaxira fayli ko‘rsatilmagan}"
RESTORE_URL="${RESTORE_URL:-postgres://postgres:postgres@127.0.0.1:5432/ishuz_restore_check}"
case "$RESTORE_URL" in
  *@127.0.0.1:*|*@localhost:*|*@127.0.0.1/*|*@localhost/*) ;;
  *) echo "Tiklash faqat lokal bazaga (127.0.0.1/localhost)" >&2; exit 1 ;;
esac
if [[ -f "$dump.sha256" ]]; then sha256sum -c --quiet "$dump.sha256"; echo "✓ nazorat yig'indisi mos"; fi

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
plain="$tmp/restore.dump"
if [[ "$dump" == *.age ]]; then
  : "${AGE_IDENTITY:?shifrlangan fayl uchun AGE_IDENTITY (yopiq kalit fayli) kerak}"
  age -d -i "$AGE_IDENTITY" -o "$plain" "$dump"
else
  cp "$dump" "$plain"
fi

admin_url="${RESTORE_URL%/*}/postgres"
db="${RESTORE_URL##*/}"
psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "drop database if exists $db with (force);" -c "create database $db;" 2>/dev/null
# bo'sh baza: dump'dagi sxemalar to'qnashmasin; kengaytmalar Supabase'dagidek "extensions" sxemasida
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade;" \
  -c "create schema if not exists extensions;" \
  -c "create extension if not exists pgcrypto with schema extensions;" \
  -c "create extension if not exists pg_trgm with schema extensions;" \
  -c "create extension if not exists unaccent with schema extensions;"
# Supabase rollari (anon, authenticated, service_role ...) lokalda bo'lmasa — taqlid (scripts/supabase-stub.sql)
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -q -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end \$\$;"
started=$(date +%s)
pg_restore --no-owner --no-privileges --exit-on-error -d "$RESTORE_URL" "$plain"
echo "✓ tiklandi: $db ($(( $(date +%s) - started )) s — RTO o'lchovi uchun)"
psql "$RESTORE_URL" -Atc "select 'jadvallar: ' || count(*) || ', RLS yoqilgan: ' || count(*) filter (where c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'"
summary=""
for t in profiles worker_profiles employer_profiles vacancies applications notifications telegram_accounts audit_logs; do
  n="$(psql "$RESTORE_URL" -Atc "select count(*) from public.$t" 2>/dev/null || echo "-")"
  summary+="$t=$n "
done
echo "qatorlar: $summary"
if [[ -n "${EXPECT_COUNTS:-}" ]]; then
  for pair in $EXPECT_COUNTS; do
    if [[ " $summary " != *" $pair "* ]]; then echo "✗ kutilgan $pair, tiklangan: $summary" >&2; exit 1; fi
  done
  echo "✓ qatorlar soni manba bilan mos"
fi

# Funksional tekshiruv: tiklangan baza ilovadek ishlay oladimi (faqat o'qish so'rovlari)
fail=0
check() { if psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -Atc "$2" > /dev/null 2>&1; then echo "✓ $1"; else echo "✗ $1" >&2; fail=1; fi; }
check "ish qidiruvi (simple_search_vacancies)" "select count(*) from public.simple_search_vacancies()"
check "ishchi qidiruvi (simple_search_workers)" "select count(*) from public.simple_search_workers()"
check "kasblar daraxti qidiruvi" "select count(*) from public.search_profession_nodes(p_query => 'buxgalter', p_limit => 3)"
check "profil ↔ hisob bog'lanishi (auth.users)" "select count(*) from public.profiles p left join auth.users u on u.id = p.id where to_regclass('auth.users') is not null"
check "RLS yoqilgan (profiles, vacancies)" "select 1 where (select bool_and(relrowsecurity) from pg_class where oid in ('public.profiles'::regclass, 'public.vacancies'::regclass))"
[[ $fail -eq 0 ]] || { echo "✗ funksional tekshiruv o'tmadi" >&2; exit 1; }
echo "✓ funksional tekshiruv o'tdi"

