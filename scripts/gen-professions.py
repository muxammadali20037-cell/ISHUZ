#!/usr/bin/env python3
"""supabase/seed/professions.txt → supabase/migrations/0031_profession_catalog_v2.sql

Kasblar daraxtini (TO'LIQ katalog: eski + yangi) ixcham, idempotent SQL ga aylantiradi.

* 0029_profession_seed.sql allaqachon productionda qo'llangan — u QAYTA YARATILMAYDI va
  o'zgartirilmaydi. Skript uni faqat o'qiydi: eski tugunlarning slug va sort_order qiymatlari
  aynan saqlanadi (kalit: soha + ota slug + name_uz), shunda yangi tugunlar qo'shilganda
  eski sluglar "siljimaydi".
* 0031 har bir tugun uchun bitta `select pg_temp._pn(...)` qatori. Slug to'qnashuvida faqat
  sinonimlar birlashtiriladi, name_en/icon esa bo'sh bo'lsagina to'ldiriladi. name_uz/name_ru/
  parent hech qachon ustidan yozilmaydi (admin paneldagi tahrirlar saqlanadi).
* Toza baza (0029 → 0031) va production (0029 allaqachon bor → 0031) bir xil holatga keladi.

Foydalanish:  python3 scripts/gen-professions.py
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "supabase/seed/professions.txt"
LOCK = ROOT / "supabase/migrations/0029_profession_seed.sql"   # faqat o'qiladi
OUT = ROOT / "supabase/migrations/0031_profession_catalog_v2.sql"

CATEGORY_EN = {
    "it": "IT & software", "sales": "Sales", "marketing": "Marketing & SMM", "design": "Design & media", "finance": "Accounting & finance",
    "driver": "Drivers", "logistics": "Logistics & warehouse", "courier": "Courier & delivery", "construction": "Construction",
    "craftsman": "Repair & handyman", "electrician": "Electrical", "plumber": "Plumbing", "mechanic": "Mechanics & machinery",
    "auto_service": "Automotive", "restaurant": "Restaurants & cafes", "call_center": "Call center", "office": "Office & administration",
    "education": "Education", "medicine": "Healthcare", "cleaning": "Cleaning & household", "security": "Security", "sewing": "Sewing & textiles",
    "beauty": "Beauty", "production": "Manufacturing", "agriculture": "Agriculture", "other": "Other",
}
REGION_EN = {
    "tashkent_city": "Tashkent city", "tashkent_region": "Tashkent region", "andijan": "Andijan region", "bukhara": "Bukhara region",
    "fergana": "Fergana region", "jizzakh": "Jizzakh region", "namangan": "Namangan region", "navoi": "Navoi region",
    "kashkadarya": "Kashkadarya region", "samarkand": "Samarkand region", "syrdarya": "Syrdarya region", "surkhandarya": "Surkhandarya region",
    "khorezm": "Khorezm region", "karakalpakstan": "Republic of Karakalpakstan",
}
# "usta" bitta kasbga olib bormasligi kerak — bir nechta guruhga mos keladi (qidiruvda umumiy so'z)
USTA_REMOVE_FROM = ["auto-service-car-mechanic", "craftsman-handyman", "construction-bricklayer"]


def q(s):
    return "'" + s.replace("'", "''") + "'"


def qn(s):
    return q(s) if s else "null"


def pg_array(items):
    """text[] literal: '{a,"b c"}'"""
    if not items:
        return "'{}'"
    out = []
    for a in items:
        if re.search(r'[\s,{}"\\]', a) or a.lower() == "null":
            a = '"' + a.replace("\\", "\\\\").replace('"', '\\"') + '"'
        out.append(a)
    return q("{" + ",".join(out) + "}")


def slugify(s):
    s = s.lower().replace("+", "plus").replace("#", "sharp").replace(".", "-").replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or "node"


def parse():
    cats, nodes = [], []
    cat = None
    stack = []  # (indent, node)
    for lineno, raw in enumerate(SRC.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.startswith("!category "):
            slug, uz, ru, en, icon = [x.strip() for x in raw[len("!category "):].split("|")]
            cats.append(dict(slug=slug, uz=uz, ru=ru, en=en, icon=icon))
            continue
        if raw.startswith("@"):
            cat = raw[1:].strip()
            stack = []
            continue
        indent_sp = len(raw) - len(raw.lstrip(" "))
        if indent_sp % 2:
            sys.exit(f"{lineno}: odd indent: {raw!r}")
        indent = indent_sp // 2
        parts = [x.strip() for x in raw.strip().split("|")]
        if len(parts) < 3 or not all(parts[:3]):
            sys.exit(f"{lineno}: bad line: {raw!r}")
        uz, ru, en = parts[0], parts[1], parts[2]
        flag_str = "|".join(parts[3:]) if len(parts) > 3 else ""
        alias_str = ""
        if "a=" in flag_str:
            flag_str, alias_str = flag_str.split("a=", 1)  # sinonimlar oxirida, ichida bo'shliq bo'lishi mumkin
        node = dict(cat=cat, uz=uz, ru=ru, en=en, group=False, pop=False, sub=None, icon=None, aliases=[], children=0, line=lineno)
        for f in flag_str.split():
            if f == "group": node["group"] = True
            elif f == "pop": node["pop"] = True
            elif f.startswith("sub="): node["sub"] = f[4:]
            elif f.startswith("icon="): node["icon"] = f[5:]
            else: sys.exit(f"{lineno}: unknown flag {f!r} in {raw!r}")
        seen = set()
        for a in alias_str.split(";"):
            a = a.strip()
            if a and a.lower() not in seen:
                seen.add(a.lower()); node["aliases"].append(a)
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if indent and (not stack or stack[-1][0] != indent - 1):
            sys.exit(f"{lineno}: bad indent: {raw!r}")
        parent = stack[-1][1] if stack else None
        node["parent"] = parent
        node["depth"] = indent + 1
        if parent: parent["children"] += 1
        nodes.append(node)
        stack.append((indent, node))
    return cats, nodes


UNQ = "((?:[^']|'')*)"
LOCK_RE = re.compile(
    r"select (?:null|\(select id from public\.profession_nodes where slug = '" + UNQ + r"'\)), c\.id, "
    r"(?:null|\(select s\.id from public\.subcategories s where s\.category_id = c\.id and s\.slug = '[^']*'\)), "
    r"'" + UNQ + r"', '(\w+)', '" + UNQ + r"', .* (\d+) from public\.categories c where c\.slug = '([^']+)' on conflict"
)


def load_lock():
    """0029 dagi tugunlar: (soha, ota slug, name_uz) → (slug, sort_order)"""
    lock = {}
    for line in LOCK.read_text(encoding="utf-8").splitlines():
        if not line.startswith("insert into public.profession_nodes"):
            continue
        m = LOCK_RE.search(line)
        if not m:
            sys.exit(f"cannot parse 0029 line: {line[:120]}")
        parent, slug, _kind, uz, order, cat = m.groups()
        un = lambda s: s.replace("''", "'") if s is not None else None
        lock[(cat, un(parent), un(uz))] = (un(slug), int(order))
    return lock


def assign(nodes, lock):
    used = {s for s, _ in lock.values()}
    matched = set()
    for n in nodes:
        key = (n["cat"], n["parent"]["slug"] if n["parent"] else None, n["uz"])
        if key in lock:
            n["slug"], n["order"] = lock[key]
            n["old"] = True
            matched.add(key)
            continue
        n["old"] = False
        base = f"{n['cat'].replace('_', '-')}-{slugify(n['en'])}"
        slug = base
        p = n["parent"]
        while slug in used and p is not None:
            slug = f"{base}-{slugify(p['en'])[:20]}"
            p = p["parent"]
        i = 2
        while slug in used:
            slug = f"{base}-{i}"; i += 1
        used.add(slug)
        n["slug"] = slug
    missing = set(lock) - matched
    if missing:
        sys.exit("0029 nodes missing from professions.txt (never delete/rename/move them):\n  " +
                 "\n  ".join(f"{c} / {p} / {u}" for c, p, u in sorted(missing, key=str)))
    # yangi tugunlar uchun tartib: oldingi eski qo'shnidan keyin (eski tartib o'zgarmaydi)
    sibs = {}
    for n in nodes:
        sibs.setdefault((n["cat"], id(n["parent"])), []).append(n)
    for lst in sibs.values():
        prev, k = 0, 0
        for i, n in enumerate(lst):
            if n["old"]:
                prev, k = n["order"], 0
                continue
            k += 1
            n["order"] = prev + k
            nxt = next((m["order"] for m in lst[i + 1:] if m["old"]), None)
            if nxt is not None and n["order"] >= nxt:
                print(f"warning: sort_order overlap at line {n['line']} ({n['uz']})", file=sys.stderr)


def check(nodes):
    seen = {}
    for n in nodes:
        k = n["uz"].lower()
        if k in seen and seen[k]["cat"] == n["cat"] and not (n["old"] and seen[k]["old"]):
            sys.exit(f"duplicate name_uz in one category: {n['uz']!r} (lines {seen[k]['line']} and {n['line']})")
        seen.setdefault(k, n)
    # bitta aniq sinonim ikki xil tanlanadigan kasbga olib bormasin (yangi qo'shilganlarda)
    owner = {}
    for n in nodes:
        if n["group"]:
            continue
        for a in n["aliases"]:
            a = a.lower()
            if a in owner and owner[a] is not n and not (owner[a]["old"] and n["old"]):
                print(f"warning: alias {a!r} on both {owner[a]['uz']!r} and {n['uz']!r}", file=sys.stderr)
            owner.setdefault(a, n)


HEADER = """-- AVTOMATIK YARATILGAN: scripts/gen-professions.py (manba: supabase/seed/professions.txt)
-- ISH.UZ · 0031 · Kasblar katalogi v2: TO'LIQ daraxt (0029 dagi eski tugunlar + yangilari), 42 yo'nalish.
-- Idempotent: qayta ishga tushirsa hech narsa o'zgarmaydi. Mavjud tugunlarning name_uz/name_ru/parent/sort_order
-- qiymatlari o'zgartirilmaydi; faqat sinonimlar birlashtiriladi va bo'sh name_en/icon to'ldiriladi.

create or replace function pg_temp._pn(p text, cat text, sub text, sl text, k text, uz text, ru text, en text, ic text,
  al text[], sel boolean, pop boolean, so int) returns void language sql as $$
  insert into public.profession_nodes (parent_id, category_id, subcategory_id, slug, kind, name_uz, name_ru, name_en, icon, aliases, selectable, is_popular, sort_order)
  select (select id from public.profession_nodes where slug = p), c.id,
    (select s.id from public.subcategories s where s.category_id = c.id and s.slug = sub),
    sl, case k when 'g' then 'group' when 's' then 'specialization' else 'profession' end, uz, ru, en, ic, al, sel, pop, so
  from public.categories c where c.slug = cat
  on conflict (slug) do update set
    aliases = (select array(select distinct x from unnest(profession_nodes.aliases || excluded.aliases) x)),
    name_en = coalesce(profession_nodes.name_en, excluded.name_en),
    icon = coalesce(profession_nodes.icon, excluded.icon)
  where not (profession_nodes.aliases @> excluded.aliases)
     or (profession_nodes.name_en is null and excluded.name_en is not null)
     or (profession_nodes.icon is null and excluded.icon is not null);
$$;
"""


def main():
    cats, nodes = parse()
    lock = load_lock()
    assign(nodes, lock)
    check(nodes)
    out = [HEADER, "-- Sohalar (yangilari qo'shiladi, mavjudlari o'zgarmaydi)"]
    for i, c in enumerate(cats):
        out.append(f"insert into public.categories (slug, name_uz, name_ru, name_en, icon, sort_order) values ({q(c['slug'])}, {q(c['uz'])}, {q(c['ru'])}, {q(c['en'])}, {q(c['icon'])}, {300 + i * 10}) on conflict (slug) do nothing;")
    for c in cats:
        out.append(f"update public.categories set name_en = {q(c['en'])} where slug = {q(c['slug'])} and name_en is null;")
    for slug, en in CATEGORY_EN.items():
        out.append(f"update public.categories set name_en = {q(en)} where slug = {q(slug)} and name_en is null;")
    for slug, en in REGION_EN.items():
        out.append(f"update public.regions set name_en = {q(en)} where slug = {q(slug)} and name_en is null;")
    out += ["", "-- Tugunlar: _pn(ota slug, soha, eski yo'nalish, slug, tur g/p/s, uz, ru, en, ikonka, sinonimlar, tanlanadi, ommabop, tartib)"]
    for n in nodes:
        kind = "g" if n["group"] else ("s" if n["parent"] is not None and not n["parent"]["group"] else "p")
        out.append("select pg_temp._pn(" + ", ".join([
            qn(n["parent"]["slug"] if n["parent"] else None), q(n["cat"]), qn(n["sub"]), q(n["slug"]), q(kind),
            q(n["uz"]), q(n["ru"]), q(n["en"]), qn(n["icon"]), pg_array(n["aliases"]),
            "true" if not n["group"] else "false", "true" if n["pop"] else "false", str(n["order"]),
        ]) + ");")
    out += ["",
            "-- Eski yo'nalishlarning sinonimlari (svarchik, motorchi...) mos tugunlarga qo'shiladi ('usta'dan tashqari)",
            "update public.profession_nodes n set aliases = (select array(select distinct x from unnest(n.aliases || array_remove(s.aliases, 'usta')) x))",
            "from public.subcategories s where s.id = n.subcategory_id and cardinality(array_remove(s.aliases, 'usta')) > 0",
            "  and not (n.aliases @> array_remove(s.aliases, 'usta'));",
            "",
            "-- \"usta\" bitta kasbga olib bormaydi: umumiy so'z, bir nechta guruhga mos keladi",
            "update public.profession_nodes set aliases = array_remove(aliases, 'usta')",
            f"where 'usta' = any(aliases) and slug in ({', '.join(q(s) for s in USTA_REMOVE_FROM)});",
            "",
            "drop function pg_temp._pn(text, text, text, text, text, text, text, text, text, text[], boolean, boolean, int);",
            ""]
    OUT.write_text("\n".join(out), encoding="utf-8")
    new = sum(1 for n in nodes if not n["old"])
    print(f"{len(cats)} new-category lines, {len(nodes)} nodes ({len(nodes) - new} from 0029, {new} new), "
          f"max depth {max(n['depth'] for n in nodes)} → {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
