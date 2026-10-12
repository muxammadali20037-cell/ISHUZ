#!/usr/bin/env bash
# "Oldin" skrinshotlari uchun: eski commit'ni o'sha E2E bazasi va shlyuziga ulangan holda :3301 da ko'tarish.
#   bash e2e/stack/up.sh                       # avval joriy stend (baza, PostgREST, shlyuz, :3300)
#   bash e2e/screens/old-build.sh <commit>      # eski build → http://localhost:3301
#   node e2e/screens/capture.mjs http://localhost:3301 before home-full /tmp/shots
#   bash e2e/screens/old-build.sh <commit> stop # to'xtatish va vaqtinchalik nusxani o'chirish
# Vaqtinchalik nusxa repo yonida (<repo>-old-<commit>) git worktree sifatida turadi; asosiy daraxtga tegmaydi.
set -euo pipefail
REV="${1:?commit kerak}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WT="$(dirname "$ROOT")/$(basename "$ROOT")-old-$REV"
ST="$ROOT/e2e/.stack"
PORT="${E2E_OLD_PORT:-3301}"

if [ "${2:-}" = "stop" ]; then
  # setsid — butun jarayon guruhini to'xtatamiz (npx → next-server)
  if [ -f "$ST/old-$REV.pid" ]; then pid="$(cat "$ST/old-$REV.pid")"; kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true; fi
  rm -f "$ST/old-$REV.pid"
  git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
  echo "✓ to'xtatildi: $REV"
  exit 0
fi

if [ ! -d "$WT" ]; then
  git -C "$ROOT" worktree add -q --detach "$WT" "$REV"
  ln -s "$ROOT/node_modules" "$WT/node_modules"
  # node_modules havolasi nusxa ildizidan tashqarida — Turbopack ildizini umumiy ota papkaga kengaytiramiz (faqat shu nusxada)
  sed -i "s|^const nextConfig: NextConfig = {|const nextConfig: NextConfig = {\n  turbopack: { root: \"$(dirname "$ROOT")\" },|" "$WT/next.config.ts"
fi

SECRET="$(cat "$ST/jwt.secret")"
cd "$WT"
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:${E2E_GATEWAY_PORT:-54331}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(E2E_JWT_SECRET=$SECRET node "$ROOT/e2e/stack/jwt.mjs" role anon)"
export SUPABASE_SERVICE_ROLE_KEY="$(E2E_JWT_SECRET=$SECRET node "$ROOT/e2e/stack/jwt.mjs" role service_role)"
export NEXT_PUBLIC_APP_URL="http://localhost:$PORT" APP_URL="http://localhost:$PORT"
export CRON_SECRET="e2e-cron" SECURITY_PEPPER="e2e-pepper-not-secret-0123456789abcdef"
export GEMINI_API_KEY="" ANTHROPIC_API_KEY="" IMAGE_GEN_API_KEY="" TELEGRAM_BOT_TOKEN="" TELEGRAM_WEBHOOK_SECRET=""
export PAYME_KEY="" PAYME_MERCHANT_ID="" CLICK_SECRET_KEY="" CLICK_SERVICE_ID="" CLICK_MERCHANT_ID="" SUPER_ADMIN_PHONES="" ADMIN_HOST=""
export NEXT_DIST_DIR=".next-old" NEXT_TELEMETRY_DISABLED=1 UI_KIT_PREVIEW=1

[ -d .next-old ] || npx next build > "$ST/old-$REV-build.log" 2>&1 || { tail -30 "$ST/old-$REV-build.log"; exit 1; }
(setsid nohup npx next start -p "$PORT" > "$ST/old-$REV-app.log" 2>&1 < /dev/null & echo $! > "$ST/old-$REV.pid")
for _ in $(seq 1 60); do
  if curl -s -o /dev/null -m 3 "http://localhost:$PORT/auth"; then echo "✓ eski build ($REV): http://localhost:$PORT"; exit 0; fi
  sleep 1
done
echo "ishga tushmadi"; tail -20 "$ST/old-$REV-app.log"; exit 1
