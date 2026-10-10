#!/usr/bin/env bash
# Repozitoriyga tushib qolgan sirlarni qidiradi (CI va lokal). Topilsa — fayl:qator (qiymat yashirilgan) va xato kodi.
# Qo'shimcha vosita kerak emas: git grep. Faqat kuzatiladigan (tracked) fayllar tekshiriladi.
set -euo pipefail
cd "$(dirname "$0")/../.."
patterns=(
  'sb_secret_[A-Za-z0-9_-]{20,}'                                              # Supabase secret key
  'eyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'   # JWT (legacy anon/service_role)
  'AIza[0-9A-Za-z_-]{35}'                                                     # Google / Gemini API key
  'sk-ant-[A-Za-z0-9_-]{20,}'                                                 # Anthropic API key
  '[0-9]{8,10}:AA[0-9A-Za-z_-]{33}'                                           # Telegram bot token
  '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'                                     # private key
  'AGE-SECRET-KEY-1[0-9A-Z]{50,}'                                             # age private key
  'postgres(ql)?://[^:@/[:space:]]+:[^@[:space:]]{8,}@[^/[:space:]]*supabase' # DB URL with password
)
found=0
for p in "${patterns[@]}"; do
  # o'zi (shu skript) va lockfile'lar hisobga olinmaydi
  if out="$(git grep -nIE -e "$p" -- . ':!scripts/security/secret-scan.sh' ':!package-lock.json' 2>/dev/null)"; then
    while IFS= read -r line; do
      echo "✗ sir topildi: ${line%%:*}:$(echo "$line" | cut -d: -f2) (naqsh: ${p:0:24}…)"
      found=1
    done <<< "$out"
  fi
done
if [[ $found -ne 0 ]]; then
  echo "Sirni repodan olib tashlang VA kalitni provayderda bekor qilib almashtiring (docs/SECURITY_RUNBOOK.md → \"Kalit sizib chiqdi\")." >&2
  exit 1
fi
echo "✓ sir topilmadi (${#patterns[@]} naqsh)"
