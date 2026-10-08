import "server-only";

import { getServerEnv } from "@/lib/env";
import { escapeHtml, miniAppBaseUrl, type ReplyMarkup } from "@/lib/telegram/bot";
import { localizedName, makeT, makeTEnum } from "@/lib/i18n/translate";
import { formatSalaryRange } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables, TablesUpdate } from "@/types/database.types";
import { renderNotification } from "./render";
import { isTelegramBlockedError, resolveTelegramLocale } from "./telegram";
import { employerMatchHtml, workerMatchHtml, type MatchReasonLite, type VacancyMatchItem, type WorkerMatchItem } from "./match-message";

type AdminClient = ReturnType<typeof createAdminClient>;
type Row = Tables<"notifications">;

export interface TelegramSendResult {
  ok: boolean;
  /** Telegram error_code (403 = bot bloklangan) yoki HTTP status; tarmoq xatosi → 0 */
  code: number;
  description?: string;
  transient: boolean;
  /** 429 bo'lsa — necha soniyadan keyin qayta urinish */
  retryAfter?: number;
}

/**
 * sendMessage — `@/lib/telegram/bot`.sendTelegramMessage bilan bir xil payload, lekin
 * error_code va retry_after qaytaradi (403 → yuborish to'xtatiladi, 429 → kutiladi).
 */
export async function sendTelegramHtml(chatId: number, html: string, keyboard?: ReplyMarkup): Promise<TelegramSendResult> {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, code: 0, description: "telegram_not_configured", transient: false };
  const base = (process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", reply_markup: keyboard, disable_web_page_preview: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as { ok: boolean; error_code?: number; description?: string; parameters?: { retry_after?: number } } | null;
    if (data?.ok) return { ok: true, code: 200, transient: false };
    const code = data?.error_code ?? res.status;
    console.warn(`[telegram] sendMessage: ${data?.description ?? res.status}`);
    return { ok: false, code, description: data?.description, transient: code === 429 || code >= 500, retryAfter: data?.parameters?.retry_after };
  } catch (e) {
    console.warn("[telegram] sendMessage network", e instanceof Error ? e.message : e);
    return { ok: false, code: 0, transient: true };
  }
}

export interface DispatchCounts {
  scanned: number;
  sent: number;
  blocked: number;
  failed: number;
  skipped: number;
}

const MATCH_TYPES = new Set(["new_matching_vacancy", "new_matching_worker"]);
const MAX_ATTEMPTS = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rec(p: Json): Record<string, unknown> {
  return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

function trackedUrl(token: string, all = false) {
  return `${miniAppBaseUrl()}/r/${token}${all ? "?all=1" : ""}`;
}

function keyboard(rows: { text: string; url: string }[][]): ReplyMarkup {
  return { inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, web_app: { url: b.url } }))) };
}

/** Moslik xabarlari uchun ma'lumot (yuborish paytida qayta o'qiladi va tekshiriladi) */
async function loadMatchContext(admin: AdminClient, rows: Row[]) {
  const vacancyIds = new Set<string>();
  const workerIds = new Set<string>();
  const profiles = new Set<string>();
  for (const r of rows) {
    if (!MATCH_TYPES.has(r.type)) continue;
    profiles.add(r.profile_id);
    const p = rec(r.payload);
    if (typeof p.vacancy_id === "string") vacancyIds.add(p.vacancy_id);
    if (typeof p.worker_id === "string") workerIds.add(p.worker_id);
    for (const v of Array.isArray(p.vacancies) ? p.vacancies : []) if (typeof rec(v as Json).vacancy_id === "string") vacancyIds.add(rec(v as Json).vacancy_id as string);
    for (const w of Array.isArray(p.workers) ? p.workers : []) if (typeof rec(w as Json).worker_id === "string") workerIds.add(rec(w as Json).worker_id as string);
  }
  if (!profiles.size) return null;
  const [subs, vacs, workers] = await Promise.all([
    admin.from("match_subscriptions").select("profile_id, role, enabled, telegram_confirmed_at, vacancy_ids").in("profile_id", [...profiles]),
    vacancyIds.size
      ? admin
          .from("vacancies")
          .select("id, title, status, salary_from, salary_to, salary_negotiable, owner_profile_id, companies(name), regions!vacancies_region_id_fkey(name_uz, name_ru, name_en, name_oz), districts!vacancies_district_id_fkey(name_uz, name_ru, name_en, name_oz)")
          .in("id", [...vacancyIds])
      : Promise.resolve({ data: [] as never[] }),
    workerIds.size
      ? admin
          .from("worker_profiles")
          .select("id, is_public, status, headline, experience_level, profile_id, profiles!worker_profiles_profile_id_fkey(first_name, last_name), profession_nodes(name_uz, name_ru, name_en), regions!worker_profiles_region_id_fkey(name_uz, name_ru, name_en, name_oz), districts!worker_profiles_district_id_fkey(name_uz, name_ru, name_en, name_oz)")
          .in("id", [...workerIds])
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const owners = new Set((vacs.data ?? []).map((v) => v.owner_profile_id).filter((x): x is string => !!x));
  const employers = owners.size
    ? (await admin.from("employer_profiles").select("profile_id, display_name").in("profile_id", [...owners])).data ?? []
    : [];
  const matchKeys = { w: [...workerIds], v: [...vacancyIds] };
  const matches =
    matchKeys.w.length || matchKeys.v.length
      ? (await admin.from("matches").select("worker_id, vacancy_id, score, reasons").or(`worker_id.in.(${matchKeys.w.join(",") || "00000000-0000-0000-0000-000000000000"}),vacancy_id.in.(${matchKeys.v.join(",") || "00000000-0000-0000-0000-000000000000"})`)).data ?? []
      : [];
  return {
    subs: subs.data ?? [],
    vacancies: new Map((vacs.data ?? []).map((v) => [v.id, v])),
    workers: new Map((workers.data ?? []).map((w) => [w.id, w])),
    employers: new Map(employers.map((e) => [e.profile_id, e.display_name])),
    matches: new Map(matches.map((m) => [`${m.worker_id}:${m.vacancy_id}`, m])),
  };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof loadMatchContext>>>;

function reasonsOf(ctx: Ctx, workerId: string, vacancyId: string): { score: number | null; reasons: MatchReasonLite[] } {
  const m = ctx.matches.get(`${workerId}:${vacancyId}`);
  if (!m) return { score: null, reasons: [] };
  const reasons = Array.isArray(m.reasons) ? (m.reasons as unknown as MatchReasonLite[]) : [];
  return { score: m.score, reasons };
}

function subscriptionOk(ctx: Ctx, profileId: string, role: "worker" | "employer", vacancyId?: string) {
  const s = ctx.subs.find((x) => x.profile_id === profileId && x.role === role);
  if (!s || !s.enabled || !s.telegram_confirmed_at) return false;
  if (role === "employer" && vacancyId && s.vacancy_ids.length && !s.vacancy_ids.includes(vacancyId)) return false;
  return true;
}

/**
 * Outbox (notifications.tg_status) bo'yicha Telegram yuborish:
 *  - navbat ijara bilan olinadi (ikki parallel yuboruvchi bitta xabarni ikki marta yubormaydi);
 *  - yuborishdan oldin qayta tekshiriladi: Telegram bog'langanmi, obuna yoqilganmi, e'lon hali faolmi;
 *  - bir foydalanuvchiga bir nechta moslik — bitta jamlangan xabar (eng moslari);
 *  - 403 (bot bloklangan) → cheksiz urinish yo'q; 429 → retry_after; 5xx/tarmoq → ortib boruvchi kutish, 6 urinishdan keyin "failed".
 */
export async function dispatchTelegramNotifications(admin: AdminClient, opts: { limit?: number; budgetMs?: number } = {}): Promise<DispatchCounts> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 40_000;
  const counts: DispatchCounts = { scanned: 0, sent: 0, blocked: 0, failed: 0, skipped: 0 };
  const { data, error } = await admin.rpc("telegram_outbox_claim", { p_limit: Math.min(Math.max(opts.limit ?? 200, 1), 500) });
  if (error) throw new Error(`outbox claim: ${error.message}`);
  const rows = (data ?? []) as Row[];
  counts.scanned = rows.length;
  if (!rows.length) return counts;

  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const [{ data: accounts }, { data: profs }] = await Promise.all([
    admin.from("telegram_accounts").select("profile_id, telegram_user_id, bot_started, language_code").in("profile_id", profileIds),
    admin.from("profiles").select("id, locale").in("id", profileIds),
  ]);
  const ctx = await loadMatchContext(admin, rows);
  const nowIso = () => new Date().toISOString();

  const mark = async (ids: number[], patch: TablesUpdate<"notifications">) => {
    if (!ids.length) return;
    const { error: e } = await admin.from("notifications").update(patch).in("id", ids);
    if (e) console.error("[telegram] mark", e.message);
  };
  const release = async (list: Row[], at: string) => mark(list.map((r) => r.id), { tg_next_at: at });

  const byProfile = new Map<string, Row[]>();
  for (const r of rows) byProfile.set(r.profile_id, [...(byProfile.get(r.profile_id) ?? []), r]);
  const pending = [...byProfile.entries()];

  for (let i = 0; i < pending.length; i += 1) {
    const [profileId, list] = pending[i]!;
    if (Date.now() - started > budget) {
      await release(pending.slice(i).flatMap(([, l]) => l), nowIso());
      break;
    }
    const tg = (accounts ?? []).find((a) => a.profile_id === profileId);
    if (!tg || !tg.bot_started) {
      counts.skipped += list.length;
      await mark(list.map((r) => r.id), { tg_status: "skipped", tg_error: "no_telegram" });
      continue;
    }
    const locale = resolveTelegramLocale([(profs ?? []).find((p) => p.id === profileId)?.locale, tg.language_code]);
    const t = makeT(locale);
    const tEnum = makeTEnum(t);

    // xabarlar: moslik (jamlanadi) + boshqalar (alohida)
    type Msg = { rows: Row[]; html: string; markup: ReplyMarkup };
    const messages: Msg[] = [];
    const skippedIds: number[] = [];

    const workerSide = list.filter((r) => r.type === "new_matching_vacancy");
    const employerSide = list.filter((r) => r.type === "new_matching_worker");
    const others = list.filter((r) => !MATCH_TYPES.has(r.type));

    if (workerSide.length && ctx) {
      const items: (VacancyMatchItem & { slug?: string })[] = [];
      const valid: Row[] = [];
      for (const r of workerSide) {
        const p = rec(r.payload);
        const workerId = String(p.worker_id ?? "");
        const refs = Array.isArray(p.vacancies) ? (p.vacancies as Json[]).map((x) => String(rec(x).vacancy_id)) : [String(p.vacancy_id ?? "")];
        let any = false;
        if (subscriptionOk(ctx, profileId, "worker")) {
          for (const vid of refs) {
            const v = ctx.vacancies.get(vid);
            if (!v || v.status !== "active") continue;
            const m = reasonsOf(ctx, workerId, vid);
            items.push({
              title: v.title,
              employer: v.companies?.name ?? (v.owner_profile_id ? (ctx.employers.get(v.owner_profile_id) ?? "") : ""),
              place: [localizedName(locale, v.regions), localizedName(locale, v.districts)].filter(Boolean).join(", "),
              salary: v.salary_negotiable || (!v.salary_from && !v.salary_to) ? t("notifications.match.negotiable") : formatSalaryRange(v.salary_from, v.salary_to, locale, { negotiable: t("notifications.match.negotiable"), from: "", to: "" }),
              score: m.score ?? Number(p.score ?? 0),
              reasons: m.reasons,
            });
            any = true;
          }
        }
        if (any) valid.push(r);
        else skippedIds.push(r.id);
      }
      if (items.length) {
        items.sort((a, b) => b.score - a.score);
        const all = items.length > 1;
        messages.push({
          rows: valid,
          html: workerMatchHtml(t, items, items.length),
          markup: keyboard([[{ text: t(all ? "notifications.match.btn_all" : "notifications.match.btn_job"), url: trackedUrl(valid[0]!.open_token, all) }], [{ text: t("notifications.match.btn_settings"), url: `${miniAppBaseUrl()}/cabinet/alerts` }]]),
        });
      }
    } else skippedIds.push(...workerSide.map((r) => r.id));

    if (employerSide.length && ctx) {
      // vakansiya bo'yicha guruhlanadi
      const byVacancy = new Map<string, Row[]>();
      for (const r of employerSide) {
        const vid = String(rec(r.payload).vacancy_id ?? "");
        byVacancy.set(vid, [...(byVacancy.get(vid) ?? []), r]);
      }
      for (const [vid, group] of byVacancy) {
        const v = ctx.vacancies.get(vid);
        if (!v || v.status !== "active" || !subscriptionOk(ctx, profileId, "employer", vid)) {
          skippedIds.push(...group.map((r) => r.id));
          continue;
        }
        const items: WorkerMatchItem[] = [];
        for (const r of group) {
          for (const x of Array.isArray(rec(r.payload).workers) ? (rec(r.payload).workers as Json[]) : []) {
            const wid = String(rec(x).worker_id ?? "");
            const w = ctx.workers.get(wid);
            if (!w || !w.is_public || w.status === "not_looking") continue;
            const m = reasonsOf(ctx, wid, vid);
            const first = w.profiles?.first_name ?? "";
            const initial = (w.profiles?.last_name ?? "").slice(0, 1);
            items.push({
              name: [first, initial ? `${initial}.` : ""].filter(Boolean).join(" "),
              profession: w.profession_nodes ? localizedName(locale, w.profession_nodes) : (w.headline ?? ""),
              place: [localizedName(locale, w.regions), localizedName(locale, w.districts)].filter(Boolean).join(", "),
              experience: w.experience_level ? tEnum("experience_level", w.experience_level) : "",
              score: m.score ?? Number(rec(x).score ?? 0),
              reasons: m.reasons,
            });
          }
        }
        if (!items.length) {
          skippedIds.push(...group.map((r) => r.id));
          continue;
        }
        items.sort((a, b) => b.score - a.score);
        const all = items.length > 1;
        messages.push({
          rows: group,
          html: employerMatchHtml(t, v.title, items, items.length),
          markup: keyboard([[{ text: t(all ? "notifications.match.btn_candidates" : "notifications.match.btn_candidate"), url: trackedUrl(group[0]!.open_token, all) }], [{ text: t("notifications.match.btn_settings"), url: `${miniAppBaseUrl()}/cabinet/alerts` }]]),
        });
      }
    } else skippedIds.push(...employerSide.map((r) => r.id));

    for (const r of others) {
      const rendered = renderNotification(r.type, r.payload, t, locale);
      const html = rendered.body ? `<b>${escapeHtml(rendered.title)}</b>\n${escapeHtml(rendered.body)}` : `<b>${escapeHtml(rendered.title)}</b>`;
      messages.push({ rows: [r], html, markup: keyboard([[{ text: t("notifications.telegram.open"), url: trackedUrl(r.open_token) }]]) });
    }

    if (skippedIds.length) {
      counts.skipped += skippedIds.length;
      await mark(skippedIds, { tg_status: "skipped", tg_error: "not_eligible" });
    }

    for (let m = 0; m < messages.length; m += 1) {
      const msg = messages[m]!;
      const result = await sendTelegramHtml(tg.telegram_user_id, msg.html, msg.markup);
      const ids = msg.rows.map((r) => r.id);
      if (result.ok) {
        counts.sent += ids.length;
        await mark(ids, { tg_status: "sent", telegram_sent_at: nowIso(), tg_error: null, tg_attempts: (msg.rows[0]?.tg_attempts ?? 0) + 1 });
      } else if (isTelegramBlockedError(result.code, result.description)) {
        counts.blocked += list.length;
        await admin.rpc("telegram_blocked", { p_profile_id: profileId });
        await mark(list.map((r) => r.id), { tg_status: "dead", tg_error: "bot_blocked" });
        break;
      } else if (result.code === 429) {
        // Telegram limiti: shu va qolgan xabarlar ko'rsatilgan vaqtdan keyin
        const at = new Date(Date.now() + Math.max(1, result.retryAfter ?? 5) * 1000).toISOString();
        counts.failed += ids.length;
        await release([...messages.slice(m).flatMap((x) => x.rows), ...pending.slice(i + 1).flatMap(([, l]) => l)], at);
        return counts;
      } else {
        counts.failed += ids.length;
        const attempts = (msg.rows[0]?.tg_attempts ?? 0) + 1;
        const dead = !result.transient || attempts >= MAX_ATTEMPTS;
        await mark(ids, {
          tg_status: dead ? "failed" : "queued",
          tg_attempts: attempts,
          tg_error: (result.description ?? `code_${result.code}`).slice(0, 200),
          tg_next_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString(),
        });
      }
      await sleep(40); // ~25 xabar/soniya
    }
  }
  return counts;
}
