"use client";

import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Loader2, MapPin, Search } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { latinToCyrillic } from "@/lib/i18n/translit";
import { cn } from "@/lib/utils";
import { chatProfessions, type ChatProfession } from "../actions";

/** Chatdagi tanlov tugmasi (viloyat, kasb, "aynan qaysi biri") — korporativ: to'rtburchak, ingichka chiziq */
export interface PickItem {
  key: string;
  label: string;
  onClick: () => void;
  /** guruh sarlavhasi ("Chet tillari") — "Hammasi" ochilganda shu bo'yicha guruhlanadi */
  group?: string | null;
}

const FIRST = 3;

/** qidiruv uchun: kichik harf, apostrof turlari bir xil, lotin/kirill farqi yo'q */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ʻʼ’‘`´']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function matches(label: string, q: string): boolean {
  const l = fold(label);
  const f = fold(q);
  return l.includes(f) || fold(latinToCyrillic(label)).includes(f);
}

export function PickButton({ item, icon, attr }: { item: PickItem; icon?: ReactNode; attr: string }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      className="press flex min-h-11 max-w-full items-center gap-1.5 rounded-lg border border-border-strong bg-card px-3.5 py-2 text-left text-sm font-semibold text-foreground shadow-sm hover:border-primary/50 hover:bg-primary-soft/40"
      {...{ [`data-${attr}`]: item.key }}
    >
      {icon}
      <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
    </button>
  );
}

function Row({ items, icon, attr }: { items: PickItem[]; icon?: ReactNode; attr: string }) {
  return (
    <ul className="flex flex-wrap gap-2" {...{ [`data-${attr}s`]: "" }}>
      {items.map((it) => (
        <li key={it.key} className="flex max-w-full">
          <PickButton item={it} icon={icon} attr={attr} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Tanlov (ega, 2026-11-22: "boshida 3 tasi ko'rinsin, «Tanlash» bosilsa hammasi chiqsin, yoki qidiruvga yozsin — qidirsa
 * chiqadi, tanlaydi"): avval birinchi 3 tasi, "Hammasini ko'rish · N ta" — hammasi (guruh bo'lsa — guruhlab), pastda
 * qidiruv maydoni — yozilgani bo'yicha darhol saralanadi. `remote` — ro'yxatda yo'qlarini serverdan ham qidiradi (kasblar).
 */
export function ChoicePicker({
  items,
  attr,
  icon,
  moreLabel,
  searchPlaceholder,
  remote,
  featured,
}: {
  items: PickItem[];
  attr: string;
  icon?: ReactNode;
  /** "Hammasini ko'rish · {count} ta" */
  moreLabel?: (count: number) => string;
  searchPlaceholder: string;
  remote?: { search: (q: string) => Promise<PickItem[]> };
  /** yopiq holatda ko'rinadigan 3 tasi (bo'lmasa — ro'yxat boshidagi 3 tasi); masalan, har yo'nalishdan bittadan */
  featured?: PickItem[];
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  /** serverdan topilgani — qaysi so'rov uchunligi bilan (eski javob yangi so'rovga aralashmaydi) */
  const [remoteRes, setRemoteRes] = useState<{ q: string; items: PickItem[] } | null>(null);
  const seq = useRef(0);

  const query = q.trim();
  const local = useMemo(() => (query ? items.filter((i) => matches(i.label, query)) : []), [items, query]);
  const wantRemote = !!remote && query.length >= 2;
  const found = wantRemote && remoteRes?.q === query ? remoteRes.items : null;
  const busy = wantRemote && remoteRes?.q !== query;

  useEffect(() => {
    if (!remote || query.length < 2) return;
    const n = ++seq.current;
    const timer = setTimeout(() => {
      remote.search(query).then(
        (r) => n === seq.current && setRemoteRes({ q: query, items: r }),
        () => n === seq.current && setRemoteRes({ q: query, items: [] }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [remote, query]);

  const results = query ? [...local, ...(found ?? []).filter((f) => !local.some((l) => l.label.toLowerCase() === f.label.toLowerCase()))] : [];
  const groups = useMemo(() => {
    if (!items.some((i) => i.group)) return null;
    const out: { title: string | null; items: PickItem[] }[] = [];
    for (const it of items) {
      const g = it.group ?? null;
      const last = out.at(-1);
      if (last && last.title === g) last.items.push(it);
      else out.push({ title: g, items: [it] });
    }
    return out;
  }, [items]);
  const hidden = items.length - FIRST;
  // yopiq holatdagi 3 tasi: tanlanganlari (bo'lsa), yetmasa — ro'yxat boshidan
  const collapsed = featured?.length ? [...featured, ...items.filter((i) => !featured.some((f) => f.key === i.key))].slice(0, FIRST) : items.slice(0, FIRST);

  return (
    <div className="space-y-2.5" data-choice-picker={attr}>
      {query ? (
        results.length ? (
          <Row items={results} icon={icon} attr={attr} />
        ) : busy ? null : (
          <p className="px-1 text-sm text-muted-foreground" data-choice-none>
            {t("easy.guided.pick_none")}
          </p>
        )
      ) : open && groups ? (
        groups.map((g, i) => (
          <div key={g.title ?? i} className="space-y-2">
            {g.title ? <p className="px-1 text-sm font-semibold text-muted-foreground">{g.title}</p> : null}
            <Row items={g.items} icon={icon} attr={attr} />
          </div>
        ))
      ) : (
        <Row items={open ? items : collapsed} icon={icon} attr={attr} />
      )}

      {!query && hidden > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="press flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-bold text-primary-ink hover:bg-primary-soft/40"
          data-choice-all
        >
          <span>{open ? t("easy.guided.pick_less") : (moreLabel ?? ((n) => t("easy.guided.pick_all", { count: n })))(items.length)}</span>
          {open ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </button>
      ) : null}

      {items.length > FIRST || remote ? (
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
          {busy ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
            data-choice-search
          />
        </label>
      ) : null}
    </div>
  );
}

export const PlaceIcon = <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />;

const popularCache = new Map<string, Promise<ChatProfession[]>>();

/**
 * Kasb tanlash (chatda): ommabop kasblar (avval 3 tasi) va qidiruv — butun kasblar daraxtidan. Yozish maydoniga yozish ham
 * ishlaydi (yozilgan so'z tushuniladi).
 */
/**
 * `lead` — ro'yxat boshidagi qo'shimcha tanlov ("Hamma ishlar" / "Hamma ishchilar": kasbsiz qidiruv — ega, 2026-11-22:
 * "«ish kerak», «работа» deb yozsa ham natija topilsin"); e'lon berishda yo'q
 */
export function ProfessionChoices({
  mode,
  onPick,
  attr = "guided-prof",
  lead,
}: {
  mode: "jobs" | "workers";
  onPick: (p: ChatProfession) => void;
  attr?: string;
  lead?: PickItem;
}) {
  const { t } = useT();
  const [list, setList] = useState<ChatProfession[] | null>(null);
  useEffect(() => {
    let alive = true;
    let p = popularCache.get(mode);
    if (!p) {
      p = chatProfessions({ mode }).catch(() => []);
      popularCache.set(mode, p);
    }
    p.then((r) => alive && setList(r));
    return () => {
      alive = false;
    };
  }, [mode]);
  const toItem = (p: ChatProfession): PickItem => ({ key: p.id, label: p.name, onClick: () => onPick(p) });
  const remote = useMemo(
    () => ({ search: (q: string) => chatProfessions({ mode, q }).then((r) => r.map(toItem)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPick har renderda yangi; qidiruv faqat rejimga bog'liq
    [mode],
  );
  if (!list) {
    return (
      <p className="inline-flex items-center gap-2 px-1 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("easy.guided.thinking")}
      </p>
    );
  }
  const items = list.map(toItem);
  return (
    <ChoicePicker
      items={lead ? [lead, ...items] : items}
      attr={attr}
      moreLabel={(n) => t("easy.guided.pick_all", { count: lead ? n - 1 : n })}
      searchPlaceholder={t("easy.guided.pick_search_prof")}
      remote={remote}
    />
  );
}

/** "Endi nima qilamiz?" va bo'sh ekrandagi katta tugma — ikki qatorli (asosiysi — to'ldirilgan rangda); `href` — havola */
export function NextOption({
  icon,
  title,
  sub,
  primary,
  href,
  className,
  ...rest
}: { icon: ReactNode; title: string; sub: string; primary?: boolean; href?: string; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(
    "press flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm",
    primary ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover" : "border-border-strong bg-card text-foreground hover:border-primary/50",
    className,
  );
  const inner = (
    <>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5", primary ? "bg-primary-foreground/15" : "bg-primary-soft text-primary-ink")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-extrabold leading-snug">{title}</span>
        <span className={cn("mt-0.5 block text-sm font-medium", primary ? "text-primary-foreground/80" : "text-muted-foreground")}>{sub}</span>
      </span>
    </>
  );
  if (href) {
    const data = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith("data-")));
    return (
      <Link href={href} className={cls} {...data}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {inner}
    </button>
  );
}
