#!/usr/bin/env bash
# E2E stendi: toza baza (barcha migratsiyalar + seed) → PostgREST → shlyuz (Auth/Storage emulyatsiyasi) → Next.js build + start.
# Tashqi xizmatlarga (AI, Telegram, to'lov) murojaat yo'q: ularning kalitlari bo'sh. JWT kaliti har safar tasodifiy.
#
#   bash e2e/stack/up.sh        # ko'tarish (E2E_SKIP_BUILD=1 — oldingi build'dan foydalanish)
#   npx playwright test -c e2e  # testlar
#   bash e2e/stack/down.sh      # to'xtatish
#
# Kerak: PostgreSQL 16 (E2E_PG), psql, postgrest binari (POSTGREST_BIN yoki PATH), Node 22.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ST="$ROOT/e2e/.stack"
mkdir -p "$ST/storage"

E2E_PG="${E2E_PG:-postgres://postgres:postgres@127.0.0.1:5432}"
E2E_DB="${E2E_DB:-ishuz_e2e}"
AUTH_PW="${E2E_AUTH_PASSWORD:-auth}"
APP_PORT="${E2E_APP_PORT:-3300}"
GATEWAY_PORT="${E2E_GATEWAY_PORT:-54331}"
PGRST_PORT="${E2E_PGRST_PORT:-3401}"
POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || echo /tmp/postgrest)}"

bash "$ROOT/e2e/stack/down.sh" >/dev/null 2>&1 || true

# Har yangi build — yangi tasodifiy JWT siri. Public (anon) kalit build ichiga yoziladi, shuning uchun
# E2E_SKIP_BUILD=1 da oldingi build bilan birga uning siri ham qayta ishlatiladi (faqat e2e/.stack ichida)
BUILD=1
if [ "${E2E_SKIP_BUILD:-0}" = "1" ] && [ -d "$ROOT/.next-e2e" ] && [ -s "$ST/jwt.secret" ]; then BUILD=0; fi
if [ "$BUILD" = "1" ]; then
  (umask 077; node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))' > "$ST/jwt.secret")
fi
SECRET="$(cat "$ST/jwt.secret")"

# PostgREST ulanadigan rol (Supabase'dagi kabi); bo'lmasa yaratiladi, borini o'zgartirmaydi
psql "$E2E_PG/postgres" -v ON_ERROR_STOP=1 -q <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password '$AUTH_PW';
  end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
SQL

echo "→ baza: $E2E_DB (barcha migratsiyalar)"
DATABASE_URL="$E2E_PG/$E2E_DB" bash scripts/db-local.sh >/dev/null
psql "$E2E_PG/$E2E_DB" -v ON_ERROR_STOP=1 -q -f e2e/stack/seed.sql
# 0056 pre-request (rol yangi yaratilgan bo'lsa ham)
psql "$E2E_PG/postgres" -q -c "alter role authenticator set pgrst.db_pre_request = 'public.api_pre_request'" >/dev/null

cat > "$ST/pgrst.conf" <<CONF
db-uri = "postgres://authenticator:$AUTH_PW@127.0.0.1:5432/$E2E_DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $PGRST_PORT
CONF

ANON_KEY="$(E2E_JWT_SECRET=$SECRET node e2e/stack/jwt.mjs role anon)"
SERVICE_KEY="$(E2E_JWT_SECRET=$SECRET node e2e/stack/jwt.mjs role service_role)"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({secret: process.argv[2], db: process.argv[3], app: process.argv[4]}))' \
  "$ST/env.json" "$SECRET" "$E2E_PG/$E2E_DB" "http://localhost:$APP_PORT"

echo "→ PostgREST :$PGRST_PORT"
(setsid nohup "$POSTGREST_BIN" "$ST/pgrst.conf" > "$ST/postgrest.log" 2>&1 < /dev/null & echo $! > "$ST/postgrest.pid")
echo "→ shlyuz :$GATEWAY_PORT"
(E2E_JWT_SECRET="$SECRET" GATEWAY_PORT="$GATEWAY_PORT" PGRST_PORT="$PGRST_PORT" STORAGE_DIR="$ST/storage" \
  setsid nohup node e2e/stack/gateway.mjs > "$ST/gateway.log" 2>&1 < /dev/null & echo $! > "$ST/gateway.pid")

# Ilova muhiti: faqat lokal stend; tashqi xizmat kalitlari ataylab bo'sh
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:$GATEWAY_PORT"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export NEXT_PUBLIC_APP_URL="http://localhost:$APP_PORT"
export APP_URL="http://localhost:$APP_PORT"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"
export CRON_SECRET="e2e-cron"
export SECURITY_PEPPER="e2e-pepper-not-secret-0123456789abcdef"
export GEMINI_API_KEY="" ANTHROPIC_API_KEY="" IMAGE_GEN_API_KEY="" TELEGRAM_BOT_TOKEN="" TELEGRAM_WEBHOOK_SECRET=""
export PAYME_KEY="" PAYME_MERCHANT_ID="" CLICK_SECRET_KEY="" CLICK_SERVICE_ID="" CLICK_MERCHANT_ID="" SUPER_ADMIN_PHONES="" ADMIN_HOST=""
export NEXT_DIST_DIR=".next-e2e"
export NEXT_TELEMETRY_DISABLED=1
# brend UI to'plami (/dev/ui) — faqat shu stendda: skrinshot va a11y tekshiruvi uchun (production'da 404)
export UI_KIT_PREVIEW=1

if [ "$BUILD" = "1" ]; then
  echo "→ build (.next-e2e)"
  npx next build > "$ST/build.log" 2>&1 || { tail -40 "$ST/build.log"; exit 1; }
fi
# so'rovlararo kesh (unstable_cache) har safar yangi bazadan to'ldirilsin — oldingi stend/boshqa bazadan qolgan
# ma'lumotnoma (masalan, boshqa loyiha kategoriyalari) testlarni chalg'itmasin
rm -rf "$ROOT/.next-e2e/cache/fetch-cache"
echo "→ ilova :$APP_PORT"
(setsid nohup npx next start -p "$APP_PORT" > "$ST/app.log" 2>&1 < /dev/null & echo $! > "$ST/app.pid")

for i in $(seq 1 60); do
  if curl -s -o /dev/null -m 3 "http://localhost:$APP_PORT/auth" && curl -s -o /dev/null -m 3 "http://localhost:$GATEWAY_PORT/rest/v1/" ; then
    echo "✓ E2E stendi tayyor: http://localhost:$APP_PORT"
    exit 0
  fi
  sleep 1
done
echo "stend ko'tarilmadi"; tail -20 "$ST/app.log" "$ST/postgrest.log" "$ST/gateway.log"; exit 1
