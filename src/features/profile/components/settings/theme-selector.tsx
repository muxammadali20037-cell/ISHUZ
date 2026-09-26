"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { ChipGroup } from "@/components/ui/chip";
import { setTheme } from "../../actions";
import { resolveDark, THEMES, type Theme } from "../../pure";
import { useAction } from "../use-action";

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", resolveDark(theme, prefersDark));
}

/** Mavzu: cookie (server action) + <html class="dark"> (client) */
export function ThemeSelector({ initial }: { initial: Theme }) {
  const { t } = useT();
  const { pending, run } = useAction();
  const [theme, setThemeState] = useState<Theme>(initial);

  // system: prefers-color-scheme o'zgarishini kuzatish
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const icons = { system: <Monitor />, light: <Sun />, dark: <Moon /> } as const;

  const change = (next: Theme | Theme[] | null) => {
    if (!next || Array.isArray(next) || next === theme) return;
    const prev = theme;
    setThemeState(next);
    run(() => setTheme({ theme: next }), { onError: () => setThemeState(prev) });
  };

  return (
    <ChipGroup
      options={THEMES.map((v) => ({ value: v, label: t(`profile.settings.theme_${v}`), icon: icons[v] }))}
      value={theme}
      onChange={change}
      className={pending ? "opacity-70" : undefined}
    />
  );
}
