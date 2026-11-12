import os, re, subprocess, sys
R = sys.argv[1]
os.chdir(R)
# ---------- ROUTES ----------
_px = open("src/proxy.ts", encoding="utf-8").read()
PROTECTED = re.findall(r'^\s*"(/[^"]+)",', _px[_px.index("PROTECTED_PREFIXES"):_px.index("];", _px.index("PROTECTED_PREFIXES"))], re.M)
pages = []
for root, _, files in os.walk("src/app"):
    for f in files:
        if f == "page.tsx":
            p = os.path.join(root, f)
            route = root[len("src/app"):] or "/"
            route = re.sub(r"/\([^)]*\)", "", route) or "/"
            src = open(p, encoding="utf-8").read()
            if route.startswith("/admin"):
                guard = "admin (rol + aal2)"
            elif "requireEmployer(" in src:
                guard = "ish beruvchi"
            elif "requireWorkerProfile(" in src or "requireWorker(" in src:
                guard = "ish izlovchi"
            elif "requireSession(" in src:
                guard = "kirgan foydalanuvchi"
            elif any(route == x or route.startswith(x + "/") for x in PROTECTED):
                guard = "kirgan foydalanuvchi (proxy)"
            elif "getSession(" in src:
                guard = "ochiq; mehmonga alohida ko'rinish"
            else:
                guard = "ochiq"
            pages.append((route, guard, p))
pages.sort()
def area(r):
    if r.startswith("/admin"): return "D. Admin paneli"
    if r.startswith(("/employer", "/company/settings", "/company/join", "/post/vacancy", "/workers", "/billing", "/pricing", "/onboarding/employer")): return "C. Ish beruvchi"
    if r.startswith(("/cabinet", "/profile", "/applications", "/saved", "/offers", "/ai-alerts", "/post/worker", "/onboarding/worker", "/listing")): return "B. Ish izlovchi"
    if r.startswith(("/auth", "/start", "/onboarding", "/blocked")): return "Kirish va onboarding"
    if r.startswith(("/messages", "/notifications", "/settings", "/ai", "/search", "/account-deletion", "/dev")): return "Umumiy (ikkala rol)"
    return "A. Ochiq sayt"
order = ["A. Ochiq sayt", "Kirish va onboarding", "B. Ish izlovchi", "C. Ish beruvchi", "Umumiy (ikkala rol)", "D. Admin paneli"]
apis = []
for root, _, files in os.walk("src/app"):
    for f in files:
        if f == "route.ts":
            apis.append(re.sub(r"/\([^)]*\)", "", root[len("src/app"):]))
apis.sort()
out = ["# Marshrutlar xaritasi (ROUTES_MAP)", "",
       "> Avtomatik yaratilgan: `src/app` dagi har bir `page.tsx` va `route.ts` dan (skript: `scripts/gen-docs.py`).",
       "> \"Kirish\" ustuni sahifa kodidagi himoya chaqiruvidan aniqlangan (`requireSession` / `requireEmployer` / `requireWorker`),",
       "> admin bo'limi `src/app/admin/(panel)/layout.tsx` da himoyalangan. Qo'lda tahrirlamang — skriptni qayta ishga tushiring.", "",
       f"Jami: **{len(pages)} sahifa**, **{len(apis)} API / maxsus marshrut**.", ""]
for a in order:
    rows = [p for p in pages if area(p[0]) == a]
    if not rows: continue
    out += [f"## {a} ({len(rows)})", "", "| Marshrut | Kirish | Fayl |", "| --- | --- | --- |"]
    out += [f"| `{r}` | {g} | `{f}` |" for r, g, f in rows]
    out.append("")
out += ["## API va maxsus marshrutlar", "", "| Marshrut |", "| --- |"] + [f"| `{a}` |" for a in apis] + [""]
open("docs/ROUTES_MAP.md", "w", encoding="utf-8").write("\n".join(out))

# ---------- DATABASE ----------
db = os.environ["DB"]
def q(sql):
    return [l.split("\t") for l in subprocess.check_output(["psql", db, "-AtF", "\t", "-c", sql], text=True).strip().split("\n") if l]
tables = q("""select c.relname,
  (select count(*) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
  case when c.relrowsecurity then 'ha' else 'YO''Q' end,
  (select count(*) from pg_policy p where p.polrelid=c.oid),
  (select count(*) from pg_constraint k where k.conrelid=c.oid and k.contype='f'),
  (select count(*) from pg_index i where i.indrelid=c.oid)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1""")
enums = q("""select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid=t.oid
  join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname order by 1""")
nfun = q("select count(*) from pg_proc where pronamespace='public'::regnamespace")[0][0]
mods = [
 ("Hisob va rollar", r"^(profiles|profile_contacts|profile_interests|user_roles|admin_users|login_codes|web_login_requests|telegram_accounts|telegram_link_tokens|device_tokens)$"),
 ("Ish izlovchi profili (Skill Passport asosi)", r"^worker_"),
 ("Kasb va katalog", r"^(profession_nodes|profession_images|categories|subcategories|skills|skill_questions|skill_question_options|languages|benefits|regions|districts|custom_occupation_requests)$"),
 ("Kompaniya va ish beruvchi", r"^(companies|company_members|company_invites|employer_profiles)$"),
 ("Vakansiyalar", r"^vacanc"),
 ("Arizalar va yollash", r"^(applications|application_events|application_notes|job_offers|contact_requests|contact_grants|contact_reveals)$"),
 ("Moslash va tavsiyalar", r"^(match|matches|ai_)"),
 ("Saqlanganlar va qidiruv", r"^(saved_|search_logs)"),
 ("Xabarlar va bildirishnomalar", r"^(conversations|conversation_members|messages|notifications|bot_sessions|telegram_updates)$"),
 ("Ishonch, moderatsiya, xavfsizlik", r"^(reports|reviews|moderation_checks|verification_requests|security_events|security_restrictions|rate_limits|audit_logs)$"),
 ("To'lov", r"^(payments|wallets|wallet_ledger|billing_usage)$"),
 ("Tizim va analitika", r"^(app_settings|analytics_events)$"),
]
def mod(t):
    for name, rx in mods:
        if re.search(rx, t): return name
    return "Boshqa"
out = ["# Ma'lumotlar bazasi tuzilishi (DATABASE_SCHEMA)", "",
       "> Avtomatik yaratilgan: barcha migratsiyalar (`supabase/migrations`) qo'llangan lokal bazadan (skript: `scripts/gen-docs.py`).",
       "> Prod baza bilan farq bo'lishi mumkin: prod'dagi holatni `scripts/prod-migration-check.sql` ko'rsatadi.", "",
       f"Jami: **{len(tables)} jadval** (RLS yoqilgan: {sum(1 for t in tables if t[2]=='ha')}), **{nfun} funksiya**, **{len(enums)} enum**.", "",
       "Ustunlar: `ust.` — ustunlar soni, `RLS` — qator darajasidagi himoya, `sit.` — siyosatlar, `FK` — tashqi kalitlar, `ind.` — indekslar.", ""]
for name, _ in mods + [("Boshqa", "")]:
    rows = [t for t in tables if mod(t[0]) == name]
    if not rows: continue
    out += [f"## {name} ({len(rows)})", "", "| Jadval | ust. | RLS | sit. | FK | ind. |", "| --- | --- | --- | --- | --- | --- |"]
    out += [f"| `{t[0]}` | {t[1]} | {t[2]} | {t[3]} | {t[4]} | {t[5]} |" for t in rows]
    out.append("")
out += ["## Enum turlari", "", "| Enum | Qiymatlar |", "| --- | --- |"] + [f"| `{e[0]}` | {e[1]} |" for e in enums] + [""]
open("docs/DATABASE_SCHEMA.md", "w", encoding="utf-8").write("\n".join(out))
print(len(pages), len(apis), len(tables), nfun, len(enums))
print([t[0] for t in tables if mod(t[0]) == "Boshqa"])
