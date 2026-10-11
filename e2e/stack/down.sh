#!/usr/bin/env bash
# E2E stendini to'xtatish (faqat up.sh ishga tushirgan jarayonlar — pid fayllari bo'yicha)
ST="$(cd "$(dirname "$0")/.." && pwd)/.stack"
for name in app gateway postgrest; do
  f="$ST/$name.pid"
  [ -f "$f" ] || continue
  pid="$(cat "$f")"
  # setsid bilan ochilgan — butun guruh (npx → next-server) to'xtatiladi
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  rm -f "$f"
done
