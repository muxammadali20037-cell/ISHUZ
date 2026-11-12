import "server-only";

import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { getHomePlace, getNewWorkers, getSeekerFeed } from "@/features/landing/home-queries";
import { getWorkerDashboardStats } from "@/features/jobs/queries";
import { getDashboardStats } from "@/features/employer/queries";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import type { JobRow, WorkerRow } from "@/features/find/queries";
import type { Enums } from "@/types/database.types";

type ApplicationStatus = Enums<"application_status">;

/**
 * /ai sahifasining boshlang'ich ma'lumoti — FAQAT bazadan (soxta raqam, foiz, kompaniya yo'q):
 *  - "Bugungi ishlar": profilga mos vakansiyalar soni, profil to'liqligi, ko'rib chiqilayotgan arizalar (ish izlovchi);
 *    yangi arizalar va faol vakansiyalar (ish beruvchi); mehmonga — kirish va qidiruv.
 *  - "Sizga mos ishlar" / "Yangi nomzodlar": bosh sahifadagi ro'yxat bilan bir xil manba (home-queries).
 * So'rov xato bersa — o'sha qator ko'rsatilmaydi (sahifa ishlayveradi).
 */

export type BriefIcon = "jobs" | "profile" | "applications" | "candidates" | "vacancies" | "login" | "post" | "profession";

export interface BriefItem {
  key: string;
  icon: BriefIcon;
  text: string;
  href: string;
  cta: string;
}

export type WorkspaceFeed =
  | {
      kind: "jobs";
      title: string;
      subtitle: string;
      items: JobRow[];
      saved: string[];
      applied: Record<string, ApplicationStatus>;
      total: number;
      href: string;
    }
  | { kind: "workers"; title: string; subtitle: string; items: WorkerRow[]; images: Record<string, string>; saved: string[]; total: number; href: string };

export interface WorkspaceData {
  items: BriefItem[];
  feed: WorkspaceFeed | null;
}

type T = (key: string, params?: Record<string, string | number>) => string;
type NameFn = (row: { name_uz: string; name_ru: string; name_en?: string | null; name_oz?: string | null } | null | undefined) => string;

const FEED_LIMIT = 4;

export async function getWorkspaceData(session: SessionContext | null, mode: AppMode | null, t: T, name: NameFn): Promise<WorkspaceData> {
  const employer = mode === "employer";
  const place = await getHomePlace();
  const items: BriefItem[] = [];

  if (employer) {
    if (!session) {
      items.push({ key: "login", icon: "login", text: t("easy.aiws.brief.login_employer"), href: "/auth?next=%2Fai", cta: t("easy.aiws.brief.cta_login") });
    } else if (!session.employerOnboarded) {
      items.push({ key: "company", icon: "post", text: t("easy.aiws.brief.finish_company"), href: "/post/vacancy", cta: t("easy.aiws.brief.cta_continue") });
    } else {
      const stats = await getDashboardStats().catch(() => null);
      if (stats) {
        if (stats.new_applications > 0) {
          items.push({ key: "applications", icon: "applications", text: t("easy.aiws.brief.new_applications", { count: stats.new_applications }), href: "/employer/applications", cta: t("easy.aiws.brief.cta_view") });
        }
        if (stats.active_vacancies > 0) {
          items.push({ key: "vacancies", icon: "vacancies", text: t("easy.aiws.brief.active_vacancies", { count: stats.active_vacancies }), href: "/employer/vacancies", cta: t("easy.aiws.brief.cta_view") });
        } else {
          items.push({ key: "post", icon: "post", text: t("easy.aiws.brief.no_vacancy"), href: "/employer/vacancies/new", cta: t("easy.aiws.brief.cta_post") });
        }
      }
    }
    const feed = await getNewWorkers(place, FEED_LIMIT);
    if (feed.ok) {
      const saved = await savedIdSet(session, "worker", feed.items.map((w) => w.id));
      return {
        items,
        feed: {
          kind: "workers",
          title: t("easy.aiws.feed.workers_title"),
          subtitle: feed.region ? t("easy.aiws.feed.in_place", { place: name(feed.region) }) : t("easy.location.whole_country"),
          items: feed.items,
          images: feed.images,
          saved: [...saved],
          total: feed.total,
          href: feed.allHref,
        },
      };
    }
    return { items, feed: null };
  }

  // ish izlovchi yoki mehmon
  const feed = await getSeekerFeed(session, place);
  if (!session) {
    items.push({ key: "login", icon: "login", text: t("easy.aiws.brief.login_worker"), href: "/auth?next=%2Fai", cta: t("easy.aiws.brief.cta_login") });
  } else if (!session.workerId) {
    items.push({ key: "profile", icon: "post", text: t("easy.aiws.brief.create_profile"), href: "/post/worker", cta: t("easy.aiws.brief.cta_start") });
  } else {
    if (feed.ok && feed.kind === "match" && feed.total > 0) {
      items.push({ key: "matches", icon: "jobs", text: t("easy.aiws.brief.matches", { count: feed.total, profession: name(feed.profession) }), href: feed.allHref, cta: t("easy.aiws.brief.cta_view") });
    } else if (feed.ok && !feed.profession && !feed.noMatchFor) {
      items.push({ key: "profession", icon: "profession", text: t("easy.aiws.brief.pick_profession"), href: "/profile/profession", cta: t("easy.aiws.brief.cta_choose") });
    }
    const stats = await getWorkerDashboardStats().catch(() => null);
    if (stats) {
      if (stats.completeness < 100) {
        items.push({ key: "completeness", icon: "profile", text: t("easy.aiws.brief.completeness", { percent: Math.max(0, Math.min(100, Math.round(stats.completeness))) }), href: "/profile/edit", cta: t("easy.aiws.brief.cta_continue") });
      }
      if (stats.active_applications > 0) {
        items.push({ key: "applications", icon: "applications", text: t("easy.aiws.brief.my_applications", { count: stats.active_applications }), href: "/applications", cta: t("easy.aiws.brief.cta_view") });
      }
    }
  }
  if (!feed.ok) return { items, feed: null };
  const jobs = feed.items.slice(0, FEED_LIMIT);
  const ids = jobs.map((j) => j.id);
  const [saved, applied] = await Promise.all([savedIdSet(session, "vacancy", ids), myApplicationStatuses(session?.workerId ?? null, ids)]);
  const where = feed.region ? (feed.district ? `${name(feed.region)} · ${name(feed.district)}` : name(feed.region)) : t("easy.location.whole_country");
  return {
    items,
    feed: {
      kind: "jobs",
      title: feed.kind === "match" ? t("easy.start.match_title") : t("easy.start.new_title"),
      subtitle: feed.kind === "match" ? t("easy.start.match_reason", { profession: name(feed.profession), place: where }) : t("easy.start.new_reason", { place: where }),
      items: jobs,
      saved: [...saved],
      applied: Object.fromEntries(applied),
      total: feed.total,
      href: feed.allHref,
    },
  };
}
