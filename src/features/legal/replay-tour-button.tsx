"use client";

import { PlayCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { WELCOME_COOKIE } from "@/components/shared/welcome-cookie";

/** Qisqa turni qayta ko'rsatish: belgini o'chiradi va bosh sahifaga qaytaradi */
export function ReplayTourButton() {
  const { t } = useT();
  return (
    <Button
      size="lg"
      onClick={() => {
        document.cookie = `${WELCOME_COOKIE}=; path=/; max-age=0; samesite=lax`;
        window.location.href = "/";
      }}
    >
      <PlayCircle className="size-5" /> {t("welcome.help.replay_tour")}
    </Button>
  );
}
