import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { makeT } from "@/lib/i18n/translate";
import { miniAppBaseUrl } from "@/lib/telegram/bot";
import { channelChatId, sendChannelMessage } from "./channel";
import { channelChatIdFrom } from "./media";
import { AUTOPOST_KEY, parseAutopost } from "./autopost-settings";
import { vacancyPost, workerPost, type ChannelPost } from "./autopost-format";

/**
 * Telegram kanalga avtomatik e'lon (0079): yangi chiqqan vakansiya — "ISH", ishchi e'loni (rezyume) — "ISHCHI".
 * Ega (2026-11-14): "har bir joylangan rezyume kanalga tashlansin; ish beruvchilar kanaliga — ishchi".
 *
 *  · Faqat oxirgi 24 soatda chiqqan/yangilangan va hozir ommaviy e'lonlar (eski e'lonlar to'plami kanalni to'ldirib
 *    yubormasin); har biri har kanalga BIR marta (channel_posts — unique).
 *  · Bir qadamda ko'pi bilan 4 ta post (Telegram cheklovi: kanalga daqiqasiga ~20); qolgani keyingi qadamda.
 *  · Muallifi bloklangan e'lon yuborilmaydi. Matnda telefon, ism, rasm, tavsif yo'q (autopost-format.ts).
 *  · Xato: 3 marta qayta urinadi; kanal darajasidagi xato (bot admin emas, kanal yo'q) — qadam to'xtaydi.
 * Ishga tushiruvchilar: fon navbati (tick) va sayt trafigi (moderation/sweep-trigger.ts).
 */
const FRESH_MS = 24 * 60 * 60 * 1000;
const PER_RUN = 4;
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MS = 10 * 60 * 1000;

type Db = ReturnType<typeof createAdminClient>;
type Entity = "vacancy" | "worker";

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
const join = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).join(", ") || null;

export interface AutopostResult {
  posted: number;
  failed: number;
  stopped?: string;
}

async function vacancyPosts(db: Db, ids: string[] | null, since: string): Promise<Map<string, ChannelPost>> {
  let q = db
    .from("vacancies")
    .select(
      "id, slug, title, salary_from, salary_to, salary_type, salary_negotiable, schedule, is_remote, custom_profession, company:companies!vacancies_company_id_fkey(name), region:regions!vacancies_region_id_fkey(name_uz), district:districts!vacancies_district_id_fkey(name_uz), profession:profession_nodes!vacancies_profession_node_id_fkey(name_uz), owner:profiles!vacancies_owner_profile_id_fkey(is_blocked)",
    )
    .eq("status", "active");
  q = ids ? q.in("id", ids) : q.gte("published_at", since).order("published_at", { ascending: false }).limit(50);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const t = makeT("uz");
  const base = miniAppBaseUrl();
  const out = new Map<string, ChannelPost>();
  for (const v of data ?? []) {
    if (one(v.owner)?.is_blocked) continue;
    out.set(
      v.id,
      vacancyPost(
        {
          slug: v.slug,
          title: v.title,
          company: one(v.company)?.name ?? null,
          place: join(one(v.district)?.name_uz, one(v.region)?.name_uz),
          remote: v.is_remote,
          salaryFrom: v.salary_from,
          salaryTo: v.salary_to,
          salaryType: v.salary_type,
          negotiable: v.salary_negotiable,
          schedule: v.schedule && v.schedule !== "negotiable" ? t(`enums.work_schedule.${v.schedule}`) : null,
          profession: v.custom_profession ?? one(v.profession)?.name_uz ?? null,
        },
        t,
        base,
      ),
    );
  }
  return out;
}

async function workerPosts(db: Db, ids: string[] | null, since: string): Promise<Map<string, ChannelPost>> {
  let q = db
    .from("worker_profiles")
    .select(
      "id, headline, custom_profession, experience_level, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_uz), region:regions!worker_profiles_region_id_fkey(name_uz), district:districts!worker_profiles_district_id_fkey(name_uz), prefs:worker_preferences(salary_expected, salary_min, salary_type, schedules), owner:profiles!worker_profiles_profile_id_fkey(is_blocked)",
    )
    .eq("is_public", true)
    .not("onboarding_completed_at", "is", null);
  q = ids ? q.in("id", ids) : q.gte("updated_at", since).order("updated_at", { ascending: false }).limit(50);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const t = makeT("uz");
  const base = miniAppBaseUrl();
  const out = new Map<string, ChannelPost>();
  for (const w of data ?? []) {
    if (one(w.owner)?.is_blocked) continue;
    const profession = w.custom_profession ?? one(w.profession)?.name_uz ?? null;
    // kasbi noma'lum e'lon — kanalda ma'nosiz ("ISHCHI" va bo'sh sarlavha)
    if (!profession) continue;
    const prefs = one(w.prefs);
    out.set(
      w.id,
      workerPost(
        {
          id: w.id,
          profession,
          headline: w.headline,
          place: join(one(w.district)?.name_uz, one(w.region)?.name_uz),
          experience: w.experience_level ? t(`enums.experience_level.${w.experience_level}`) : null,
          salary: prefs?.salary_expected ?? prefs?.salary_min ?? null,
          salaryType: prefs?.salary_type ?? null,
          schedules: (prefs?.schedules ?? []).filter((s) => s !== "negotiable").map((s) => t(`enums.work_schedule.${s}`)),
        },
        t,
        base,
      ),
    );
  }
  return out;
}

/** Bir turdagi e'lonlar: avval qayta urinishlar, keyin yangilari; har birini "band qilib" (unique) yuboradi */
async function runEntity(db: Db, entity: Entity, chatId: string, budget: number, res: AutopostResult): Promise<number> {
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const build = entity === "vacancy" ? vacancyPosts : workerPosts;

  // 1) qayta urinish: xato bo'lgan yoki "band qilingan"u yuborilmay qolgan (jarayon uzilgan) yozuvlar
  const { data: retry } = await db
    .from("channel_posts")
    .select("id, entity_id, status, attempts, created_at")
    .eq("entity_type", entity)
    .eq("chat_id", chatId)
    .in("status", ["failed", "claimed"])
    .lt("attempts", MAX_ATTEMPTS)
    .gte("created_at", since)
    .limit(10);
  const retriable = (retry ?? []).filter((r) => r.status === "failed" || Date.now() - new Date(r.created_at).getTime() > STALE_CLAIM_MS);

  // 2) yangilari: hali hech qachon yuborilmaganlar
  const fresh = await build(db, null, since);
  const known = fresh.size
    ? new Set(((await db.from("channel_posts").select("entity_id").eq("entity_type", entity).eq("chat_id", chatId).in("entity_id", [...fresh.keys()])).data ?? []).map((r) => r.entity_id))
    : new Set<string>();
  const queue: { id: string; post: ChannelPost; retryId?: number; attempts?: number }[] = [];
  if (retriable.length) {
    const again = await build(db, retriable.map((r) => r.entity_id), since);
    for (const r of retriable) {
      const post = again.get(r.entity_id);
      if (post) queue.push({ id: r.entity_id, post, retryId: r.id, attempts: r.attempts });
      // e'lon endi ommaviy emas (yopilgan, bloklangan) — qayta urinilmaydi
      else await db.from("channel_posts").update({ status: "failed", attempts: MAX_ATTEMPTS, error: "not_public" }).eq("id", r.id);
    }
  }
  for (const [id, post] of fresh) if (!known.has(id)) queue.push({ id, post });

  let used = 0;
  for (const item of queue) {
    if (used >= budget) break;
    let rowId = item.retryId;
    const attempts = (item.attempts ?? 0) + 1;
    if (rowId) {
      // boshqa server nusxasi ham shu yozuvni olmasin: holat va urinish soni bo'yicha shartli yangilash
      const { data: took } = await db
        .from("channel_posts")
        .update({ status: "claimed", attempts })
        .eq("id", rowId)
        .eq("attempts", item.attempts ?? 0)
        .select("id");
      if (!took?.length) continue;
    } else {
      const { data: claimed, error } = await db.from("channel_posts").insert({ entity_type: entity, entity_id: item.id, chat_id: chatId, status: "claimed", attempts }).select("id").maybeSingle();
      if (error || !claimed) continue; // allaqachon boshqa nusxa band qilgan (unique)
      rowId = claimed.id;
    }
    used += 1;
    const sent = await sendChannelMessage({ chatId, html: item.post.html, button: item.post.button });
    if (sent.ok) {
      await db.from("channel_posts").update({ status: "posted", message_id: sent.messageId, posted_at: new Date().toISOString(), error: null }).eq("id", rowId);
      res.posted += 1;
    } else {
      await db
        .from("channel_posts")
        .update({ status: "failed", error: sent.description.slice(0, 300) })
        .eq("id", rowId);
      res.failed += 1;
      if (sent.channelLevel) {
        // kanal sozlanmagan / bot huquqi yo'q — qolganlarini hozir urinmaymiz (admin "Telegram kanal" sahifasida ko'radi)
        res.stopped = sent.description;
        return budget;
      }
    }
  }
  return used;
}

/** Bir qadam: vakansiyalar va ishchi e'lonlari (sozlamaga ko'ra). Hech qachon xato otmaydi */
export async function runChannelAutopost(): Promise<AutopostResult> {
  const res: AutopostResult = { posted: 0, failed: 0 };
  if (!getServerEnv().TELEGRAM_BOT_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res;
  try {
    const db = createAdminClient();
    const { data: row } = await db.from("app_settings").select("value").eq("key", AUTOPOST_KEY).maybeSingle();
    const cfg = parseAutopost(row?.value);
    const main = channelChatId();
    let budget = PER_RUN;
    const jobsChat = channelChatIdFrom(cfg.jobsChat) ?? main;
    if (cfg.jobs && jobsChat) budget -= await runEntity(db, "vacancy", jobsChat, budget, res);
    const workersChat = channelChatIdFrom(cfg.workersChat) ?? main;
    if (cfg.workers && workersChat && budget > 0 && !res.stopped) await runEntity(db, "worker", workersChat, budget, res);
  } catch (e) {
    // 0079 qo'llanmagan (channel_posts yo'q) yoki tarmoq xatosi — keyingi qadamda yana
    console.error("[channel-autopost]", e instanceof Error ? e.message : e);
  }
  if (res.posted || res.failed) console.info("[channel-autopost]", res);
  return res;
}
