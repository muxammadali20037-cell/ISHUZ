#!/usr/bin/env bash
# Prod holatini TASHQARIDAN tekshirish (faqat o'qiydi, hech narsani o'zgartirmaydi).
#
#   bash scripts/prod-check.sh                       # https://ishuz.vercel.app
#   BASE=http://localhost:3300 bash scripts/prod-check.sh
#
# Ixtiyoriy muhit o'zgaruvchilari (qiymatlar hech qachon chop etilmaydi):
#   CRON_SECRET         — /api/health?deep=1: prod bazada qaysi migratsiya yo'qligi
#   TELEGRAM_BOT_TOKEN  — api.telegram.org getWebhookInfo: webhook manzili, kutilayotgan yangilanishlar, oxirgi xato
#
# Chiqish kodi: 0 — hammasi PASS yoki WARN; 1 — kamida bitta FAIL.
set -u

BASE="${BASE:-https://ishuz.vercel.app}"
BASE="${BASE%/}"
UA="ishuz-prod-check/1"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fails=0
warns=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; warns=$((warns + 1)); }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fails=$((fails + 1)); }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Kerak: $1"; exit 2; }; }
need curl
need python3

# fetch METHOD URL [curl args...] → $TMP/body, echo "code time"
fetch() {
  local method="$1" url="$2"; shift 2
  curl -sS -L -X "$method" -A "$UA" -o "$TMP/body" -w '%{http_code} %{time_total}' --max-time 30 "$@" "$url" 2>"$TMP/err" || echo "000 0"
}

json() { python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(eval(sys.argv[2], {"d": d}))' "$TMP/body" "$1" 2>/dev/null; }

# Sahifa HTML'ida ko'rinadigan matnni tekshirish (skript/stil olib tashlanadi — tarjima lug'atlari chalg'itmasin).
page_has() {
  python3 - "$TMP/body" "$1" <<'EOF'
import re, sys, html
raw = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
raw = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.S)
text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
sys.exit(0 if sys.argv[2] in text else 1)
EOF
}

echo "Prod tekshiruvi: $BASE  ($(date -u +%Y-%m-%dT%H:%MZ))"

# 1. Health -----------------------------------------------------------------------
echo "1. Holat"
read -r code t < <(fetch GET "$BASE/api/health")
if [ "$code" = "200" ] && [ "$(json 'd["status"]')" = "ok" ]; then
  rel="$(json 'd.get("release")')"; dbms="$(json 'd["db"]["ms"]')"
  pass "/api/health → ok · reliz $rel · baza ${dbms} ms · jami ${t}s"
  if [ "${dbms:-0}" -gt 1500 ] 2>/dev/null; then warn "baza javobi ${dbms} ms — sekin (odatda < 300 ms; sovuq ulanish bo'lishi mumkin, qayta tekshiring)"; fi
else
  fail "/api/health → HTTP $code (kutilgan 200 {status:ok}); $(head -c 200 "$TMP/body" 2>/dev/null)"
fi

if [ -n "${CRON_SECRET:-}" ]; then
  read -r code _ < <(fetch GET "$BASE/api/health?deep=1" -H "Authorization: Bearer $CRON_SECRET")
  if [ "$code" = "200" ]; then
    pass "deep: baza kod bilan mos (yetishmagan migratsiya yo'q)"
  elif [ "$code" = "503" ]; then
    fail "deep: yetishmagan migratsiyalar — $(json 'd["schema"]["missing"]') · xatolar: $(json 'd["schema"]["errors"]')  → docs/RELEASE_CHECKLIST.md §3"
  elif [ "$code" = "401" ]; then
    fail "deep: CRON_SECRET noto'g'ri (401)"
  else
    fail "deep: HTTP $code"
  fi
else
  warn "deep tekshiruv o'tkazib yuborildi (CRON_SECRET berilmagan) — qaysi migratsiya yo'qligini bilish uchun kerak"
fi

# 2. Ochiq sahifalar ------------------------------------------------------------------
echo "2. Ochiq sahifalar"
check_page() { # path expect_text [fallback_text_that_means_db_problem]
  local path="$1" expect="$2" bad="${3:-}"
  read -r code t < <(fetch GET "$BASE$path" -H "Accept-Language: uz" -b "ib_consent=1")
  if [ "$code" != "200" ]; then fail "$path → HTTP $code"; return; fi
  if [ -n "$bad" ] && page_has "$bad"; then fail "$path → «$bad» (baza/migratsiya muammosi)"; return; fi
  if page_has "$expect"; then pass "$path → 200, «$expect» (${t}s)"; else warn "$path → 200, lekin «$expect» matni topilmadi (${t}s)"; fi
}
check_page "/"            "Ish topdim"
check_page "/start/til"   "Siz nima qidiryapsiz?"
check_page "/jobs"        "Ish qidirish"       "Nimadir xato ketdi"
check_page "/companies"   "Kompaniyalar"       "Ro'yxat vaqtincha ochilmadi"
check_page "/kasblar"     "Kasblar"            "Nimadir xato ketdi"
check_page "/for-employers" "Ish beruvchi"
check_page "/cookies"     "Cookie"
check_page "/privacy"     "Maxfiylik"
check_page "/ai"          "Ish topdim"

# 3. Texnik fayllar ----------------------------------------------------------------------
echo "3. Texnik fayllar"
read -r code _ < <(fetch GET "$BASE/robots.txt");            [ "$code" = "200" ] && pass "/robots.txt" || fail "/robots.txt → $code"
read -r code _ < <(fetch GET "$BASE/sitemap.xml");           [ "$code" = "200" ] && pass "/sitemap.xml" || fail "/sitemap.xml → $code"
read -r code _ < <(fetch GET "$BASE/manifest.webmanifest");  [ "$code" = "200" ] && pass "/manifest.webmanifest" || fail "/manifest.webmanifest → $code"
read -r code _ < <(fetch GET "$BASE/.well-known/assetlinks.json")
if [ "$code" = "200" ]; then
  n="$(json 'len(d)')"
  if [ "${n:-0}" -gt 0 ] 2>/dev/null; then pass "assetlinks.json: $n ta yozuv (paket $(json 'd[0]["target"]["package_name"]'))"; else warn "assetlinks.json bo'sh — Play ilovasi uchun ANDROID_PACKAGE_NAME / ANDROID_SHA256_CERT_FINGERPRINTS hali sozlanmagan (docs/PLAY_MARKET.md)"; fi
else fail "/.well-known/assetlinks.json → $code"; fi

# 4. Webhook va to'lov kirish nuqtalari (deploy bo'lgani va himoyalanganini tekshiradi) ---------------
echo "4. Telegram va to'lov kirish nuqtalari"
read -r code _ < <(fetch POST "$BASE/api/telegram/webhook" -H "Content-Type: application/json" --data '{}')
case "$code" in
  401) pass "/api/telegram/webhook — deploy bo'lgan, sirsiz so'rov rad etiladi (401)";;
  404) fail "/api/telegram/webhook → 404 (deploy bo'lmagan)";;
  *)   warn "/api/telegram/webhook → $code (kutilgan 401)";;
esac
read -r code _ < <(fetch POST "$BASE/api/payments/payme" -H "Content-Type: application/json" --data '{"id":1,"method":"CheckPerformTransaction","params":{}}')
if [ "$code" = "200" ] && [ "$(json 'd.get("error",{}).get("code")')" = "-32504" ]; then pass "/api/payments/payme — deploy bo'lgan, imzosiz so'rov rad etiladi (-32504)"
elif [ "$code" = "404" ]; then fail "/api/payments/payme → 404"; else warn "/api/payments/payme → $code"; fi
read -r code _ < <(fetch POST "$BASE/api/payments/click" --data 'click_trans_id=1&merchant_trans_id=x&amount=1&action=0&sign_time=x&sign_string=x&merchant_prepare_id=')
if [ "$code" = "200" ] && [ "$(json 'd.get("error")')" != "None" ]; then pass "/api/payments/click — deploy bo'lgan, imzosiz so'rov rad etiladi (error $(json 'd.get("error")'))"
elif [ "$code" = "404" ]; then fail "/api/payments/click → 404"; else warn "/api/payments/click → $code"; fi

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  read -r code _ < <(fetch GET "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")
  if [ "$code" = "200" ] && [ "$(json 'd["ok"]')" = "True" ]; then
    url="$(json 'd["result"].get("url","")')"; pending="$(json 'd["result"].get("pending_update_count",0)')"; lasterr="$(json 'd["result"].get("last_error_message","")')"
    if [ "$url" = "$BASE/api/telegram/webhook" ]; then pass "Telegram webhook → $url"; else fail "Telegram webhook «$url» ≠ $BASE/api/telegram/webhook (POST /api/telegram/setup bilan sozlang)"; fi
    [ "${pending:-0}" -gt 20 ] 2>/dev/null && warn "Telegram: $pending ta yetkazilmagan yangilanish kutmoqda"
    [ -n "$lasterr" ] && warn "Telegram oxirgi xato: $lasterr ($(json 'd["result"].get("last_error_date")'))"
  else fail "getWebhookInfo → HTTP $code"; fi
else
  warn "Telegram getWebhookInfo o'tkazib yuborildi (TELEGRAM_BOT_TOKEN berilmagan) — bot /start ga javob berishini qo'lda tekshiring"
fi

# 5. Xavfsizlik sarlavhalari -------------------------------------------------------------
echo "5. Sarlavhalar"
curl -sS -I -A "$UA" --max-time 30 "$BASE/" -o "$TMP/head" 2>/dev/null
hdrs="content-security-policy x-content-type-options referrer-policy"
case "$BASE" in https://*) hdrs="strict-transport-security $hdrs";; esac   # HSTS faqat https'da yuboriladi
for h in $hdrs; do
  grep -qi "^$h:" "$TMP/head" && pass "$h" || fail "$h sarlavhasi yo'q"
done

echo
echo "Natija: FAIL=$fails  WARN=$warns"
[ "$fails" -eq 0 ]
