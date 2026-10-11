#!/usr/bin/env bash
# Ma'lumotlar bazasining shifrlangan zaxira nusxasi (pg_dump custom format + age shifrlash).
#
#   SUPABASE_DB_URL="postgresql://postgres.<ref>:<parol>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
#   BACKUP_AGE_RECIPIENT="age1..." bash scripts/backup/db-backup.sh [chiqish_papkasi]
#
# - SUPABASE_DB_URL — Supabase → Connect → Session pooler (5432). Parol faqat muhit o'zgaruvchisida, faylga yozilmaydi.
# - BACKUP_AGE_RECIPIENT — `age-keygen` bilan yaratilgan OCHIQ kalit (age1...). Yopiq kalit faqat egasida, oflayn.
#   Shifrlanmagan nusxa faqat ALLOW_PLAINTEXT=1 bilan (lokal sinov uchun).
# - BACKUP_SCHEMAS — sukut: public auth storage (foydalanuvchilar va fayllar ro'yxati ham). Fayllarning o'zi
#   Storage'da — ular uchun alohida: docs/SECURITY_RUNBOOK.md "Zaxira nusxa".
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL kerak}"
out_dir="${1:-backups}"
schemas="${BACKUP_SCHEMAS:-public auth storage}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$out_dir"
umask 077

args=(--format=custom --no-owner --no-privileges --compress=9)
for s in $schemas; do args+=("--schema=$s"); done

base="$out_dir/ishuz-$stamp.dump"
toc="$out_dir/.toc-$stamp"
started=$(date +%s)
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  # dump diskka shifrlanmagan holda tushmaydi: to'g'ridan-to'g'ri age'ga uzatiladi; parallel ravishda mundarija (TOC) o'qiladi
  # (TOC o'qilgach qolgan oqim ham o'qib tugatiladi — aks holda tee SIGPIPE olib, zaxira yarim qolardi)
  pg_dump "${args[@]}" "$SUPABASE_DB_URL" | tee >(pg_restore --list > "$toc"; cat > /dev/null) | age -r "$BACKUP_AGE_RECIPIENT" -o "$base.age"
  file="$base.age"
elif [[ "${ALLOW_PLAINTEXT:-}" == "1" ]]; then
  pg_dump "${args[@]}" -f "$base" "$SUPABASE_DB_URL"
  pg_restore --list "$base" > "$toc"
  file="$base"
else
  echo "BACKUP_AGE_RECIPIENT yo'q: shifrlanmagan zaxira yozilmaydi (lokal sinov uchun ALLOW_PLAINTEXT=1)" >&2
  exit 1
fi
sleep 1 # tee'ning process substitution'i yozib bo'lishi uchun

# Yaxlitlik: fayl bo'sh emas, mundarija o'qildi va asosiy jadvallarning ma'lumoti nusxada bor
[[ -s "$file" ]] || { echo "✗ zaxira fayli bo'sh" >&2; exit 1; }
[[ -s "$toc" ]] || { echo "✗ zaxira mundarijasi (pg_restore --list) o'qilmadi" >&2; exit 1; }
missing=""
for t in profiles worker_profiles vacancies applications; do
  grep -Eq "TABLE DATA public $t " "$toc" || missing+="$t "
done
[[ -z "$missing" ]] || { echo "✗ nusxada jadval ma'lumoti yo'q: $missing" >&2; exit 1; }
entries=$(grep -cv '^;' "$toc" || true)
data_tables=$(grep -c "TABLE DATA" "$toc" || true)
rm -f "$toc"

sha256sum "$file" > "$file.sha256"
size=$(stat -c %s "$file")
cat > "$file.manifest.json" <<JSON
{"file":"$(basename "$file")","created_at":"$stamp","bytes":$size,"sha256":"$(cut -d' ' -f1 "$file.sha256")","toc_entries":$entries,"tables_with_data":$data_tables,"schemas":"$schemas","encrypted":$([[ "$file" == *.age ]] && echo true || echo false),"seconds":$(( $(date +%s) - started ))}
JSON
echo "✓ $file ($(du -h "$file" | cut -f1)), jadval ma'lumoti: $data_tables, sha256: $(cut -c1-16 "$file.sha256")…"
