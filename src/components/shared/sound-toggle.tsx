"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { playSfx, setSfxEnabled, sfxEnabled, unlockSfx } from "@/lib/sfx";

function subscribe(cb: () => void) {
  window.addEventListener("ishuz:sfx", cb);
  return () => window.removeEventListener("ishuz:sfx", cb);
}

/** Ovoz va tebranishni yoqish/o'chirish (tanlov shu qurilmada saqlanadi) */
export function SoundToggle() {
  const { t } = useT();
  const on = useSyncExternalStore(subscribe, sfxEnabled, () => true);
  const toggle = () => {
    const next = !on;
    setSfxEnabled(next);
    if (next) {
      unlockSfx();
      playSfx("pop", 30);
    }
  };
  const label = on ? t("common.sound.off") : t("common.sound.on");
  return (
    <button
      type="button"
      onClick={toggle}
      data-sfx="none"
      aria-pressed={on}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {on ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
    </button>
  );
}
