"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellPlus, BellRing } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { deleteSavedSearch, saveJobsSearch } from "../actions";

/** "Qidiruvni saqlash" — yangi mos vakansiyalar chiqsa kuniga bir marta xabar keladi */
export function SaveSearchButton({ query, savedId, loggedIn }: { query: string; savedId: string | null; loggedIn: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!loggedIn) {
    return (
      <Button asChild size="sm" variant="soft">
        <Link href={`/auth?next=${encodeURIComponent(`/jobs?${query}`)}`}>
          <BellPlus className="size-4" /> {t("saved.searches.save")}
        </Link>
      </Button>
    );
  }

  const toggle = () =>
    startTransition(async () => {
      const res = savedId ? await deleteSavedSearch({ id: savedId }) : await saveJobsSearch({ query });
      if (!res.ok) {
        const key = `saved.searches.errors.${res.error}`;
        const msg = t(key);
        toast.error(msg === key ? t("common.errors.generic") : msg);
        return;
      }
      if (savedId) toast.info(t("saved.searches.removed"));
      else toast.success(t("saved.searches.saved"), t("saved.searches.saved_desc"));
      router.refresh();
    });

  return (
    <Button type="button" size="sm" variant={savedId ? "secondary" : "soft"} onClick={toggle} loading={pending} aria-pressed={!!savedId}>
      {savedId ? <BellRing className="size-4" /> : <BellPlus className="size-4" />}
      {savedId ? t("saved.searches.saved_short") : t("saved.searches.save")}
    </Button>
  );
}
