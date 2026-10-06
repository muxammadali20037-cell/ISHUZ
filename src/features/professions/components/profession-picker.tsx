"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Loader2, Search, Sparkles, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Category } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/components/shared/category-icon";
import type { PickedProfession, ProfessionNode, ProfessionSearchHit, TrailItem } from "../types";

const RECENT_KEY = "ishuz_recent_professions";

function readRecent(): PickedProfession[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as PickedProfession[]) : [];
    return Array.isArray(list) ? list.filter((x) => x && typeof x.id === "string" && Array.isArray(x.trail)).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecent(p: PickedProfession) {
  try {
    const next = [p, ...readRecent().filter((x) => x.id !== p.id)].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // brauzer xotirasi yopiq bo'lsa — shunchaki eslab qolinmaydi
  }
}

const toTrail = (n: { id: string; name_uz: string; name_ru: string; name_en: string | null }): TrailItem => ({ id: n.id, name_uz: n.name_uz, name_ru: n.name_ru, name_en: n.name_en });

/**
 * Kasb tanlash: soha → guruh → kasb → yo'nalish → ... (chuqurlik cheklanmagan, daraxt serverdan darajama-daraja keladi).
 * Tepada har doim qidiruv; yo'l (breadcrumb) bosiladigan; ommabop birinchi; bitta bolali guruh avtomatik o'tkaziladi.
 * Ishchi va ish beruvchi aynan shu komponentdan foydalanadi — bitta umumiy daraxt.
 */
export function ProfessionPicker({
  categories,
  value,
  onChange,
  title,
  subtitle,
  initialQuery = "",
  onCustom,
}: {
  categories: Category[];
  value: PickedProfession | null;
  onChange: (picked: PickedProfession) => void;
  title?: string;
  subtitle?: string;
  /** masalan vakansiya nomi — qidiruv darhol mos kasblarni ko'rsatadi */
  initialQuery?: string;
  /** "Topilmadimi? O'zingiz yozing": asl matn + eng yaqin soha (berilmasa bu yo'l ko'rsatilmaydi) */
  onCustom?: (text: string, categoryId: string) => void;
}) {
  const { t, name } = useT();
  const [browsing, setBrowsing] = useState(!value);
  const [sectorId, setSectorId] = useState<string | null>(value?.categoryId ?? null);
  const [path, setPath] = useState<TrailItem[]>(value ? value.trail.slice(0, -1) : []);
  const [cache, setCache] = useState<Record<string, ProfessionNode[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(value ? "" : initialQuery.trim().slice(0, 80));
  const [hits, setHits] = useState<ProfessionSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<PickedProfession[]>([]);
  const topRef = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState<string | null>(null);
  const [customSector, setCustomSector] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setRecent(readRecent()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const sector = categories.find((c) => c.id === sectorId) ?? null;
  const current = path.at(-1) ?? null;
  const levelKey = current ? current.id : sectorId ? `cat:${sectorId}` : null;
  const nodes = levelKey ? cache[levelKey] : undefined;

  const load = useCallback(
    async (key: string) => {
      if (cache[key]) return cache[key];
      setLoadingKey(key);
      setFailed(false);
      try {
        const qs = key.startsWith("cat:") ? `category=${key.slice(4)}` : `parent=${key}`;
        const res = await fetch(`/api/professions/nodes?${qs}`);
        if (!res.ok) throw new Error(String(res.status));
        const { nodes: list } = (await res.json()) as { nodes: ProfessionNode[] };
        setCache((c) => ({ ...c, [key]: list }));
        return list;
      } catch {
        setFailed(true);
        return null;
      } finally {
        setLoadingKey((k) => (k === key ? null : k));
      }
    },
    [cache],
  );

  useEffect(() => {
    if (!browsing || !levelKey || cache[levelKey]) return;
    const id = window.setTimeout(() => void load(levelKey), 0);
    return () => window.clearTimeout(id);
  }, [browsing, levelKey, cache, load]);

  // Qidiruv (250 ms kechikish bilan)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const id = window.setTimeout(() => setHits(null), 0);
      return () => window.clearTimeout(id);
    }
    let cancelled = false;
    const id = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/professions/search?q=${encodeURIComponent(q)}`);
        const { results } = (await res.json()) as { results: ProfessionSearchHit[] };
        if (!cancelled) setHits(results ?? []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query]);

  const scrollTop = () => topRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });

  const select = (picked: PickedProfession) => {
    pushRecent(picked);
    setRecent(readRecent());
    setQuery("");
    setHits(null);
    setSectorId(picked.categoryId);
    setPath(picked.trail.slice(0, -1));
    setBrowsing(false);
    onChange(picked);
  };

  /** Tugunga kirish. Faqat bitta bolali navigatsiya guruhlari avtomatik o'tkaziladi (keraksiz bosish yo'q). */
  const enter = async (node: ProfessionNode | ProfessionSearchHit, basePath: TrailItem[]) => {
    let nextPath = [...basePath, toTrail(node)];
    let list = await load(node.id);
    let guard = 0;
    while (list && list.length === 1 && !list[0]!.selectable && list[0]!.has_children && guard < 8) {
      const only = list[0]!;
      nextPath = [...nextPath, toTrail(only)];
      list = await load(only.id);
      guard++;
    }
    setPath(nextPath);
    scrollTop();
  };

  const pickNode = (node: ProfessionNode, basePath: TrailItem[]) => {
    if (node.has_children) void enter(node, basePath);
    else if (node.selectable) select({ id: node.id, categoryId: node.category_id, trail: [...basePath, toTrail(node)] });
  };

  const openSector = (id: string) => {
    setSectorId(id);
    setPath([]);
    setQuery("");
    setHits(null);
    scrollTop();
  };

  const popular = useMemo(() => (nodes && nodes.length > 10 ? nodes.filter((n) => n.is_popular) : []), [nodes]);

  // ------------------------------------------------------------------ tanlangan holat
  if (!browsing && value) {
    return <SelectedCard value={value} categories={categories} onChange={select} onEdit={() => setBrowsing(true)} />;
  }

  // ------------------------------------------------------------------ qo'lda yozish
  if (custom !== null && onCustom) {
    const text = custom.trim();
    return (
      <div ref={topRef} className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{t("professions.custom_title")}</h2>
          <p className="mt-1 text-muted-foreground">{t("professions.custom_hint")}</p>
        </div>
        <Input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 120))} placeholder={t("professions.custom_placeholder")} aria-label={t("professions.custom_title")} className="h-14 rounded-2xl text-base" autoFocus />
        <p className="text-sm font-semibold">{t("professions.custom_sector")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={customSector === c.id}
              onClick={() => setCustomSector(c.id)}
              className={cn("flex items-center gap-2 rounded-2xl border p-3 text-left text-sm font-medium", customSector === c.id ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/50")}
            >
              <CategoryIcon name={c.icon} className="size-4 shrink-0 text-primary" /> {name(c)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCustom(null)} className="rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            {t("common.actions.back")}
          </button>
          <button
            type="button"
            disabled={text.length < 2 || !customSector}
            onClick={() => customSector && onCustom(text, customSector)}
            className="flex-1 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("professions.custom_save")}
          </button>
        </div>
      </div>
    );
  }

  const crumbs: { label: string; onClick: () => void }[] = [
    { label: t("professions.all_sectors"), onClick: () => (setSectorId(null), setPath([])) },
    ...(sector ? [{ label: name(sector), onClick: () => setPath([]) }] : []),
    ...path.map((p, i) => ({ label: name(p), onClick: () => setPath(path.slice(0, i + 1)) })),
  ];

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-4">
      {title ? (
        <div>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
        </div>
      ) : null}

      <Input
        type="search"
        leftIcon={searching ? <Loader2 className="animate-spin" /> : <Search />}
        placeholder={t("professions.search_placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("professions.search_placeholder")}
        className="h-14 rounded-2xl text-base"
      />

      {hits !== null ? (
        <section aria-live="polite" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("professions.search_results")}</p>
          {hits.length ? (
            <ul className="space-y-2">
              {hits.map((h) => {
                const sec = categories.find((c) => c.id === h.category_id);
                const trailText = [sec ? name(sec) : null, ...h.trail.map((x) => name(x))].filter(Boolean).join(" › ");
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (h.selectable && !h.has_children) select({ id: h.id, categoryId: h.category_id, trail: [...h.trail, toTrail(h)] });
                        else {
                          setSectorId(h.category_id);
                          setQuery("");
                          setHits(null);
                          if (h.selectable) select({ id: h.id, categoryId: h.category_id, trail: [...h.trail, toTrail(h)] });
                          else void enter(h, h.trail);
                        }
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <CategoryIcon name={h.icon ?? sec?.icon} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold leading-snug">{name(h)}</span>
                        {trailText ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{trailText}</span> : null}
                      </span>
                      <span className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold", h.selectable ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                        {h.selectable ? t("professions.select") : <ChevronRight className="size-5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{t("professions.no_results")}</p>
          )}
          {onCustom ? (
            <button type="button" onClick={() => setCustom(query.trim())} className="w-full rounded-2xl border border-dashed border-primary/40 p-4 text-left text-sm font-semibold text-primary hover:bg-primary-soft/40">
              {t("professions.custom_cta", { text: query.trim() })}
            </button>
          ) : null}
        </section>
      ) : (
        <>
          {sector ? (
            <nav aria-label="breadcrumb" className="-mx-1 flex flex-wrap items-center gap-1 text-sm">
              {crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" /> : null}
                  <button
                    type="button"
                    onClick={c.onClick}
                    disabled={i === crumbs.length - 1}
                    className={cn("rounded-lg px-1.5 py-1", i === crumbs.length - 1 ? "font-semibold text-foreground" : "text-primary hover:bg-primary-soft")}
                  >
                    {c.label}
                  </button>
                </span>
              ))}
            </nav>
          ) : null}

          {!sector ? (
            <div key="sectors" className="animate-fade-in space-y-5">
              {recent.length ? (
                <section>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="size-3.5" /> {t("professions.recent")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => {
                      const last = r.trail.at(-1);
                      return last ? (
                        <button key={r.id} type="button" onClick={() => select(r)} className="rounded-full border border-primary/30 bg-primary-soft/50 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-soft">
                          {name(last)}
                        </button>
                      ) : null;
                    })}
                  </div>
                </section>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openSector(c.id)}
                    className="flex min-h-[112px] flex-col items-start justify-between gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                      <CategoryIcon name={c.icon} className="size-6" />
                    </span>
                    <span className="text-[15px] font-semibold leading-snug">{name(c)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div key={levelKey ?? "x"} className="animate-fade-in space-y-4">
              <h3 className="text-xl font-bold leading-snug">{t("professions.which_in", { name: current ? name(current) : name(sector) })}</h3>

              {current && nodeIsSelectable(current.id, path, cache, sectorId) ? (
                <>
                  <button
                    type="button"
                    onClick={() => select({ id: current.id, categoryId: sector.id, trail: path })}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft/60 p-4 text-left transition-colors hover:bg-primary-soft"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Check className="size-6" strokeWidth={3} />
                    </span>
                    <span className="text-base font-semibold">{t("professions.choose_this", { name: name(current) })}</span>
                  </button>
                  <p className="text-sm text-muted-foreground">{t("professions.or_more_precise")}</p>
                </>
              ) : null}

              {nodes === undefined || loadingKey === levelKey ? (
                failed ? (
                  <button type="button" onClick={() => levelKey && void load(levelKey)} className="w-full rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    {t("common.errors.generic")} · {t("common.actions.retry")}
                  </button>
                ) : (
                  <div className="space-y-2" aria-busy>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />
                    ))}
                  </div>
                )
              ) : (
                <>
                  {popular.length ? (
                    <section>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Sparkles className="size-3.5" /> {t("professions.popular")}
                      </p>
                      <NodeList nodes={popular} onPick={(n) => pickNode(n, path)} />
                      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("professions.all")}</p>
                    </section>
                  ) : null}
                  <NodeList nodes={nodes} onPick={(n) => pickNode(n, path)} />
                </>
              )}

              <button
                type="button"
                onClick={() => (path.length ? setPath(path.slice(0, -1)) : (setSectorId(null), setPath([])))}
                className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" /> {t("common.actions.back")}
              </button>
            </div>
          )}
        </>
      )}
      {onCustom && hits === null ? (
        <button type="button" onClick={() => setCustom(query.trim())} className="text-sm font-medium text-primary hover:underline">
          {t("professions.custom_link")}
        </button>
      ) : null}
    </div>
  );
}

/** Joriy tugun tanlanadigan kasbmi — ota darajasining keshidan aniqlanadi */
function nodeIsSelectable(id: string, path: TrailItem[], cache: Record<string, ProfessionNode[]>, sectorId: string | null): boolean {
  const parentKey = path.length > 1 ? path[path.length - 2]!.id : sectorId ? `cat:${sectorId}` : null;
  const list = parentKey ? cache[parentKey] : undefined;
  return !!list?.find((n) => n.id === id)?.selectable;
}

function NodeList({ nodes, onPick }: { nodes: ProfessionNode[]; onPick: (n: ProfessionNode) => void }) {
  const { name } = useT();
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {nodes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onPick(n)}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40 active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1 text-base font-medium leading-snug">{name(n)}</span>
            {n.has_children ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" /> : <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Tanlangan kasb: to'liq yo'l + o'zgartirish + o'xshash yo'nalishlar (faqat taklif, avtomatik almashtirilmaydi) */
function SelectedCard({ value, categories, onChange, onEdit }: { value: PickedProfession; categories: Category[]; onChange: (p: PickedProfession) => void; onEdit: () => void }) {
  const { t, name } = useT();
  const [siblings, setSiblings] = useState<ProfessionNode[]>([]);
  const sector = categories.find((c) => c.id === value.categoryId);
  const last = value.trail.at(-1);
  const parent = value.trail.at(-2) ?? null;

  useEffect(() => {
    let cancelled = false;
    const qs = parent ? `parent=${parent.id}` : `category=${value.categoryId}`;
    fetch(`/api/professions/nodes?${qs}`)
      .then((r) => r.json())
      .then(({ nodes }: { nodes: ProfessionNode[] }) => {
        if (!cancelled) setSiblings((nodes ?? []).filter((n) => n.id !== value.id && n.selectable).slice(0, 8));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [parent, value.categoryId, value.id]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border-2 border-primary bg-primary-soft/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("professions.selected")}</p>
        <div className="mt-2 flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <CategoryIcon name={sector?.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold leading-snug">{last ? name(last) : ""}</p>
            <p className="mt-1 text-sm text-muted-foreground">{[sector ? name(sector) : null, ...value.trail.slice(0, -1).map((x) => name(x))].filter(Boolean).join(" › ")}</p>
          </div>
          <button type="button" onClick={onEdit} className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft">
            <X className="size-4" /> {t("professions.change")}
          </button>
        </div>
      </div>
      {siblings.length ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("professions.similar")}</p>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange({ id: s.id, categoryId: s.category_id, trail: [...value.trail.slice(0, -1), toTrail(s)] })}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm hover:border-primary/50"
              >
                {name(s)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
