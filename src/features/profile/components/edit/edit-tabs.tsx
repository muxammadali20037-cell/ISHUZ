"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { EDIT_SECTIONS, type EditSection } from "../../pure";

/** Bo'limlar bo'ylab yopishqoq (sticky) gorizontal tab chizig'i: anchor'larga o'tadi, faolini kuzatadi */
export function EditTabs() {
  const { t } = useT();
  const [active, setActive] = useState<EditSection>(EDIT_SECTIONS[0]);

  useEffect(() => {
    const els = EDIT_SECTIONS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (!visible.size) return;
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top && (EDIT_SECTIONS as readonly string[]).includes(top[0])) setActive(top[0] as EditSection);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: [0, 0.2] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  return (
    <nav className="sticky top-14 z-30 -mx-4 border-b border-border/70 bg-background/95 backdrop-blur sm:-mx-6" aria-label={t("profile.edit.sections_nav")}>
      <ul className="flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-none sm:px-6">
        {EDIT_SECTIONS.map((id) => (
          <li key={id}>
            <a
              href={`#${id}`}
              data-tab={id}
              onClick={() => setActive(id)}
              className={cn(
                "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors",
                active === id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground border border-border",
              )}
            >
              {t(`profile.sections.${id}`)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
