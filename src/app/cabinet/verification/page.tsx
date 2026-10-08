import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock3, ShieldX } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { VerificationForm } from "@/features/verification/components/verification-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.verification.title"), robots: { index: false } };
}

/**
 * /cabinet/verification — ish beruvchini tasdiqlash. Holatlar: tekshirilmagan, tekshiruvda, tasdiqlangan, rad etilgan, to'xtatilgan.
 * "Tasdiqlangan" belgisi aynan nima tekshirilganini ko'rsatadi (telefon tasdig'i va tashkilot tekshiruvi alohida).
 */
export default async function Page() {
  const session = await requireSession("/cabinet/verification");
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: ep }, { data: req }, { data: contact }] = await Promise.all([
    supabase.from("employer_profiles").select("employer_type, display_name, verification_status, verification_checks, verified_at, verification_note, identity_number, companies(name)").eq("profile_id", session.userId).maybeSingle(),
    supabase.from("verification_requests").select("status, review_note, created_at").eq("profile_id", session.userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profile_contacts").select("phone, phone_verified_at").eq("profile_id", session.userId).maybeSingle(),
  ]);

  if (!ep) {
    return (
      <Shell>
        <div className="container-narrow space-y-4 py-8 text-lg">
          <h1 className="text-3xl font-extrabold">{t("easy.verification.title")}</h1>
          <p className="text-muted-foreground">{t("easy.verification.no_employer")}</p>
          <Button asChild size="xl" className="h-14 w-full text-lg">
            <Link href="/post/vacancy">{t("easy.home.employer_cta")}</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const status = ep.verification_status;
  const Icon = status === "verified" ? BadgeCheck : status === "rejected" || status === "suspended" ? ShieldX : Clock3;
  const needsId = ep.employer_type === "company" || ep.employer_type === "government" || ep.employer_type === "individual_entrepreneur";
  const canSubmit = status === "unverified" || status === "rejected" || status === "pending";
  return (
    <Shell>
      <div className="container-narrow space-y-6 py-6 text-lg sm:py-8">
        <div>
          <h1 className="text-3xl font-extrabold">{t("easy.verification.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("easy.verification.intro")}</p>
        </div>
        <div className="space-y-3 rounded-3xl border-2 border-border bg-card p-5">
          <p className="flex items-center gap-2 text-xl font-bold">
            <Icon className={status === "verified" ? "size-7 text-success" : status === "rejected" || status === "suspended" ? "size-7 text-destructive" : "size-7 text-warning"} aria-hidden />
            {t(`easy.verification.status.${status}`)}
          </p>
          <p className="text-base text-muted-foreground">{t(`easy.verification.status_desc.${status}`)}</p>
          {ep.verification_note && (status === "rejected" || status === "suspended") ? <p className="rounded-2xl bg-destructive/5 p-3 text-base">{ep.verification_note}</p> : null}
          {req?.status === "rejected" && req.review_note && req.review_note !== "superseded" && status === "rejected" ? <p className="rounded-2xl bg-destructive/5 p-3 text-base">{req.review_note}</p> : null}
          <ul className="space-y-1 text-base">
            <li>{contact?.phone_verified_at ? `✓ ${t("easy.verification.check.phone")}` : `• ${t("easy.verification.check.phone_missing")}`}</li>
            {status === "verified"
              ? ep.verification_checks.map((c) => <li key={c}>✓ {t(`easy.verification.check.${c}`)}</li>)
              : null}
            {status === "verified" && ep.verified_at ? <li className="text-muted-foreground">{t("easy.verification.verified_on", { date: formatDate(ep.verified_at, locale) })}</li> : null}
          </ul>
        </div>
        {canSubmit ? <VerificationForm userId={session.userId} needsId={needsId} initialId={ep.identity_number} /> : null}
      </div>
    </Shell>
  );
}
