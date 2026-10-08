import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { CabinetPage } from "@/features/cabinet/components/cabinet-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.cabinet.title"), robots: { index: false } };
}

/** /cabinet — "Kabinetim": e'lonlarim va hisob boshqaruvi. Mehmonga — hisobga kirish taklifi (yo'naltirish yo'q) */
export default async function Cabinet() {
  const session = await getSession();
  if (session?.profile.is_blocked) redirect("/blocked");
  return (
    <Shell>
      <CabinetPage session={session} />
    </Shell>
  );
}
