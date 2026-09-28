#!/usr/bin/env python3
"""supabase/seed/professions.txt → supabase/migrations/0029_profession_seed.sql

Boshlang'ich kasblar daraxtini SQL ga aylantiradi. Idempotent (on conflict do nothing):
qayta ishga tushirilsa admin paneldagi o'zgarishlar buzilmaydi.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "supabase/seed/professions.txt"
OUT = ROOT / "supabase/migrations/0029_profession_seed.sql"

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

def q(s):
    return "'" + s.replace("'", "''") + "'"

def slugify(s):
    s = s.lower().replace("+", "plus").replace("#", "sharp").replace(".", "-").replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or "node"

def parse():
    cats, nodes = [], []
    cat = None
    stack = []  # (indent, node)
    for raw in SRC.read_text(encoding="utf-8").splitlines():
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
        indent = (len(raw) - len(raw.lstrip(" "))) // 2
        parts = [x.strip() for x in raw.strip().split("|")]
        if len(parts) < 3:
            sys.exit(f"bad line: {raw!r}")
        uz, ru, en = parts[0], parts[1], parts[2]
        flag_str = parts[3] if len(parts) > 3 else ""
        alias_str = ""
        if "a=" in flag_str:
            flag_str, alias_str = flag_str.split("a=", 1)  # sinonimlar oxirida, ichida bo'shliq bo'lishi mumkin
        flags = flag_str.split()
        node = dict(cat=cat, uz=uz, ru=ru, en=en, group=False, pop=False, sub=None, icon=None, aliases=[], children=0)
        for f in flags:
            if f == "group": node["group"] = True
            elif f == "pop": node["pop"] = True
            elif f.startswith("sub="): node["sub"] = f[4:]
            elif f.startswith("icon="): node["icon"] = f[5:]
            else: sys.exit(f"unknown flag {f!r} in {raw!r}")
        node["aliases"] = [a.strip() for a in alias_str.split(";") if a.strip()]
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if indent and not stack:
            sys.exit(f"orphan indent: {raw!r}")
        parent = stack[-1][1] if stack else None
        node["parent"] = parent
        node["depth"] = indent + 1
        if parent: parent["children"] += 1
        node["order"] = sum(1 for n in nodes if n["parent"] is parent and n["cat"] == cat) * 10 + 10
        nodes.append(node)
        stack.append((indent, node))
    used = set()
    for n in nodes:
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
    return cats, nodes

def main():
    cats, nodes = parse()
    out = ["-- AVTOMATIK YARATILGAN: scripts/gen-professions.py (manba: supabase/seed/professions.txt)",
           "-- Boshlang'ich kasblar daraxti. Idempotent: mavjud tugunlar o'zgartirilmaydi.", ""]
    for i, c in enumerate(cats):
        out.append(f"insert into public.categories (slug, name_uz, name_ru, name_en, icon, sort_order) values ({q(c['slug'])}, {q(c['uz'])}, {q(c['ru'])}, {q(c['en'])}, {q(c['icon'])}, {300 + i * 10}) on conflict (slug) do nothing;")
    for slug, en in CATEGORY_EN.items():
        out.append(f"update public.categories set name_en = {q(en)} where slug = {q(slug)} and name_en is null;")
    for slug, en in REGION_EN.items():
        out.append(f"update public.regions set name_en = {q(en)} where slug = {q(slug)} and name_en is null;")
    out.append("")
    for n in nodes:
        kind = "group" if n["group"] else ("specialization" if n["parent"] is not None and not n["parent"]["group"] else "profession")
        parent = f"(select id from public.profession_nodes where slug = {q(n['parent']['slug'])})" if n["parent"] else "null"
        sub = f"(select s.id from public.subcategories s where s.category_id = c.id and s.slug = {q(n['sub'])})" if n["sub"] else "null"
        aliases = "array[" + ", ".join(q(a) for a in n["aliases"]) + "]::text[]" if n["aliases"] else "'{}'::text[]"
        icon = q(n["icon"]) if n["icon"] else "null"
        out.append(
            "insert into public.profession_nodes (parent_id, category_id, subcategory_id, slug, kind, name_uz, name_ru, name_en, icon, aliases, selectable, is_popular, sort_order) "
            f"select {parent}, c.id, {sub}, {q(n['slug'])}, {q(kind)}, {q(n['uz'])}, {q(n['ru'])}, {q(n['en'])}, {icon}, {aliases}, {str(not n['group']).lower()}, {str(n['pop']).lower()}, {n['order']} "
            f"from public.categories c where c.slug = {q(n['cat'])} on conflict (slug) do nothing;"
        )
    out += ["",
            "-- Eski yo'nalishlarning sinonimlari (svarchik, motorchi...) mos tugunlarga qo'shiladi",
            "update public.profession_nodes n set aliases = (select array(select distinct x from unnest(n.aliases || s.aliases) x))",
            "from public.subcategories s where s.id = n.subcategory_id and cardinality(s.aliases) > 0 and not (n.aliases @> s.aliases);",
            ""]
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{len(cats)} categories, {len(nodes)} nodes → {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
