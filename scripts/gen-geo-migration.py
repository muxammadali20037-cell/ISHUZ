#!/usr/bin/env python3
"""supabase/seed/geo_uz.json → supabase/migrations/0034_geo_soato.sql (idempotent).
Mavjud qatorlarga SOATO kodi, turi (tuman/shahar) va rasmiy nomlar qo'shiladi; yetishmaganlar qo'shiladi.
Ikki ma'noli nomlar ("Qarshi" kabi, tuman ham shahar ham bor) — mavjud qator SHAHARga bog'lanadi, tuman yangi qator bo'ladi."""
import json, re

d = json.load(open("supabase/seed/geo_uz.json"))
units = d["units"]

def q(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"

# ikki ma'noli: tumanga moslangan existing_slug ni shu nomdagi shaharga ko'chirish
by_region = {}
for u in units:
    by_region.setdefault(u["region_slug"], []).append(u)
for u in units:
    note = u.get("match_note") or ""
    if u["type"] == "district" and u["existing_slug"] and note.startswith("ambiguous"):
        base = re.sub(r"\s+tumani$", "", u["name_uz"]).strip().lower()
        city = next((c for c in by_region[u["region_slug"]] if c["type"] == "city" and not c["existing_slug"] and re.sub(r"\s+shahri$", "", c["name_uz"]).strip().lower() == base), None)
        if city:
            city["existing_slug"], u["existing_slug"] = u["existing_slug"], None

def slugify(name, kind):
    s = name.lower().replace("ʻ", "").replace("'", "").replace("’", "").replace("ʼ", "")
    s = re.sub(r"\s+(tumani|shahri)$", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s + ("_city" if kind == "city" else "_district")

out = ["-- ISH BERUVCHI · 0034 · Hududlar: SOATO kodlari, tur (tuman/shahar), rasmiy nomlar (lotin/kirill/rus).",
       "-- AVTOMATIK: scripts/gen-geo-migration.py (manba: supabase/seed/geo_uz.json, docs/GEO_COVERAGE.md).",
       "-- Mavjud ID/slug o'zgarmaydi (arizalar, profillar havolalari buzilmaydi). Qayta ishga tushirish dublikat bermaydi.",
       "",
       "alter table public.regions add column if not exists soato text unique;",
       "alter table public.regions add column if not exists name_oz text;",
       "alter table public.districts add column if not exists soato text unique;",
       "alter table public.districts add column if not exists kind text not null default 'district' check (kind in ('district', 'city'));",
       "alter table public.districts add column if not exists name_oz text;",
       "alter table public.districts add column if not exists source text;",
       "alter table public.districts add column if not exists source_updated_at date;",
       "alter table public.regions add column if not exists country_code text not null default 'UZ';",
       ""]
for r in d["regions"]:
    out.append(f"update public.regions set soato = {q(r['soato'])}, name_oz = {q(r.get('name_oz'))} where slug = {q(r['slug'])};")
out.append("")
for u in sorted(units, key=lambda x: (x["region_slug"], x["type"] != "city", x["name_uz"])):
    vals = f"soato = {q(u['soato'])}, kind = {q(u['type'])}, name_uz = {q(u['name_uz'])}, name_ru = {q(u['name_ru'])}, name_oz = {q(u.get('name_oz'))}, source = 'soato:mimaxuz+laravel-region', source_updated_at = date '2026-10-06'"
    if u["existing_slug"]:
        out.append(f"update public.districts d set {vals} from public.regions r where r.id = d.region_id and r.slug = {q(u['region_slug'])} and d.slug = {q(u['existing_slug'])} and (d.soato is null or d.soato = {q(u['soato'])});")
    else:
        slug = slugify(u["name_uz"], u["type"])
        out.append(
            "insert into public.districts (region_id, slug, name_uz, name_ru, name_oz, soato, kind, source, source_updated_at, sort_order) "
            f"select r.id, {q(slug)}, {q(u['name_uz'])}, {q(u['name_ru'])}, {q(u.get('name_oz'))}, {q(u['soato'])}, {q(u['type'])}, 'soato:mimaxuz+laravel-region', date '2026-10-06', {50 if u['type']=='city' else 100} "
            f"from public.regions r where r.slug = {q(u['region_slug'])} and not exists (select 1 from public.districts x where x.soato = {q(u['soato'])}) "
            "on conflict (region_id, slug) do nothing;")
out.append("")
out.append("-- Shaharlar ro'yxatda tepada")
out.append("update public.districts set sort_order = 50 where kind = 'city' and sort_order = 100;")
open("supabase/migrations/0034_geo_soato.sql", "w").write("\n".join(out) + "\n")
print("units", len(units), "inserts", sum(1 for u in units if not u["existing_slug"]))
