import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getBenefits } from "@/lib/reference";
import { requireWorker } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { CvDocument } from "@/features/profile/components/cv/cv-document";
import { getMyContacts, getMyTelegram, getWorkerProfileFull } from "@/features/profile/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.meta.cv") };
}

/** /profile/cv — faqat o'z CV'si (boshqa nomzod CV'si /workers/[id] da) */
export default async function CvPage() {
  const session = await requireWorker("/profile/cv");
  const { name } = await getT();
  const [data, contacts, telegram, terms] = await Promise.all([
    getWorkerProfileFull(session.workerId),
    getMyContacts(session.userId),
    getMyTelegram(session.userId),
    getBenefits("official_term"),
  ]);
  if (!data) return null;
  const p = session.profile;
  return (
    <Shell>
      <CvDocument
        data={data}
        profile={{ first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url, birth_date: p.birth_date }}
        contacts={{ phone: contacts?.phone ?? null, email: contacts?.email ?? null, telegram: contacts?.telegram_username ?? telegram?.username ?? null }}
        officialTermNames={Object.fromEntries(terms.map((b) => [b.code, name(b)]))}
      />
    </Shell>
  );
}
