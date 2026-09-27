import Link from "next/link";
import { FileUser, Megaphone, Search, Users } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { aiEnabled } from "@/lib/ai/client";

/** Bosh sahifadagi 4 ta katta tugma — har biri nima qilishi yozuvi bilan (mehmon uchun) */
export async function QuickActions() {
  const { t } = await getT();
  const items = [
    { href: "/jobs", icon: Search, label: t("welcome.quick.jobs"), tone: "bg-primary text-primary-foreground" },
    { href: "/auth?next=%2Fworkers", icon: Users, label: t("welcome.quick.workers"), tone: "bg-success text-success-foreground" },
    { href: aiEnabled() ? "/auth?next=%2Femployer%2Fvacancies%2Fnew%2Fai" : "/auth?next=%2Femployer%2Fvacancies%2Fnew", icon: Megaphone, label: t("welcome.quick.post"), tone: "bg-warning text-warning-foreground" },
    { href: "/auth?next=%2Fonboarding%2Fworker", icon: FileUser, label: t("welcome.quick.resume"), tone: "bg-[#7c3aed] text-white" },
  ];
  return (
    <section className="mx-auto mt-7 max-w-3xl" aria-label={t("welcome.quick.title")}>
      <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("welcome.quick.title")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-transform hover:-translate-y-0.5">
            <span className={`flex size-12 items-center justify-center rounded-2xl ${i.tone}`}>
              <i.icon className="size-6" />
            </span>
            <span className="text-sm font-semibold leading-tight">{i.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Ikkinchi rolga o'tish taklifi (bitta akkauntda ish ham, ishchi ham qidiriladi) */
export async function CrossRoleCard({ role }: { role: "worker" | "employer" }) {
  const { t } = await getT();
  const worker = role === "worker";
  return (
    <Link
      href={worker ? (aiEnabled() ? "/employer/vacancies/new/ai" : "/employer/vacancies/new") : "/jobs"}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{worker ? <Megaphone className="size-5" /> : <Search className="size-5" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t(worker ? "welcome.cross.worker_title" : "welcome.cross.employer_title")}</span>
        <span className="block text-sm text-muted-foreground">{t(worker ? "welcome.cross.worker_desc" : "welcome.cross.employer_desc")}</span>
      </span>
      <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">{t(worker ? "welcome.cross.worker_cta" : "welcome.cross.employer_cta")}</span>
    </Link>
  );
}
