#!/usr/bin/env bash
# Stend ilovasining IKKINCHI nusxasi — prod'dagidek kesh sozlamalari bilan (yuklama testi uchun).
# Oddiy stend (e2e/stack/up.sh) statistika keshini ataylab o'chiradi (MARKET_CACHE_SECONDS=0) — testlar o'z ma'lumotini
# darhol ko'rsin deb. Yuklama o'lchovida bu prod'ga o'xshamaydi, shuning uchun shu skript bir xil build va bazaga
# prod qiymatlari bilan ulanadi.
#
#   bash e2e/stack/up.sh                 # avval stend (baza, PostgREST, shlyuz, ilova :3300)
#   bash load/stand-app.sh               # ilova :3301, prod kesh (10 daqiqa)
#   BASE=http://localhost:3301 node load/http-load.mjs
#   bash load/stand-app.sh build          # kod o'zgargan bo'lsa: o'sha stend kalitlari bilan qayta build (.next-e2e)
#   bash load/stand-app.sh stop
set -euo pipefail
cd "$(dirname "$0")/.."
ST="e2e/.stack"
PORT="${LOAD_APP_PORT:-3301}"
PIDFILE="$ST/app-load.pid"

# setsid bilan ishga tushirilgan: pid = guruh; butun guruh (npx → next-server) to'xtatiladi
stop_group() { [ -s "$1" ] && { kill -- "-$(cat "$1")" 2>/dev/null || kill "$(cat "$1")" 2>/dev/null; rm -f "$1"; return 0; }; return 1; }

if [ "${1:-}" = "stop" ]; then
  stop_group "$PIDFILE" && echo "to'xtatildi" || echo "ishlamayapti"
  exit 0
fi
[ -s "$ST/env.json" ] || { echo "Stend yo'q: avval bash e2e/stack/up.sh"; exit 1; }
[ -d ".next-e2e" ] || { echo "Build yo'q (.next-e2e): avval bash e2e/stack/up.sh"; exit 1; }

SECRET="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).secret)' "$ST/env.json")"
GATEWAY="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).gateway)' "$ST/env.json")"
ANON_KEY="$(E2E_JWT_SECRET=$SECRET node e2e/stack/jwt.mjs role anon)"
SERVICE_KEY="$(E2E_JWT_SECRET=$SECRET node e2e/stack/jwt.mjs role service_role)"

export NEXT_PUBLIC_SUPABASE_URL="$GATEWAY"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"
export NEXT_PUBLIC_APP_URL="http://localhost:$PORT" APP_URL="http://localhost:$PORT"
export CRON_SECRET="e2e-cron" SECURITY_PEPPER="e2e-pepper-not-secret-0123456789abcdef"
export GEMINI_API_KEY="" ANTHROPIC_API_KEY="" IMAGE_GEN_API_KEY="" TELEGRAM_BOT_TOKEN="" TELEGRAM_WEBHOOK_SECRET=""
export PAYME_MERCHANT_ID="e2e-merchant" PAYME_KEY="e2e-payme-key-not-secret" PAYME_TEST=1
export CLICK_SERVICE_ID="e2e-service" CLICK_MERCHANT_ID="e2e-merchant" CLICK_SECRET_KEY="e2e-click-key-not-secret"
export SUPER_ADMIN_PHONES="" ADMIN_HOST="" SUPER_ADMIN_EMAILS="owner@e2e.uz"
# rasmiy ijtimoiy tarmoqlar (ochiq havolalar; prod'dagi bilan bir xil) — sayt pastki qismi, yon menyu, kabinet, yordam
export SOCIAL_TELEGRAM_URL="https://t.me/ish_topdim_uz" SOCIAL_INSTAGRAM_URL="https://www.instagram.com/ishtopdim/"
export NEXT_DIST_DIR=".next-e2e" NEXT_TELEMETRY_DISABLED=1
# prod'dagidek: statistika 10 daqiqa keshda
unset MARKET_CACHE_SECONDS

if [ "${1:-}" = "build" ]; then
  # build ichiga yoziladigan ommaviy manzil — asosiy stend (:3300), E2E shu build bilan ishlaydi
  export NEXT_PUBLIC_APP_URL="http://localhost:${E2E_APP_PORT:-3300}" APP_URL="http://localhost:${E2E_APP_PORT:-3300}"
  stop_group "$ST/app.pid" && echo "stend ilovasi (:3300) to'xtatildi — build'dan keyin qayta ko'taring" || true
  stop_group "$PIDFILE" || true
  npx next build > "$ST/build-load.log" 2>&1 || { tail -40 "$ST/build-load.log"; exit 1; }
  echo "✓ build (.next-e2e)"; exit 0
fi

stop_group "$PIDFILE" || true
(setsid nohup npx next start -p "$PORT" > "$ST/app-load.log" 2>&1 < /dev/null & echo $! > "$PIDFILE")
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:$PORT/api/health" && { echo "✓ ilova (prod kesh) → http://localhost:$PORT"; exit 0; }
  sleep 1
done
echo "ilova ko'tarilmadi:"; tail -20 "$ST/app-load.log"; exit 1
