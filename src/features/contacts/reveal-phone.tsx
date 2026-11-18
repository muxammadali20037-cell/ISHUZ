"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, LogIn, Phone, RotateCw } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatPhone } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { revealListingPhone, type RevealedPhones } from "./reveal-actions";

type State = { phase: "idle" | "loading" } | { phase: "shown"; phones: RevealedPhones } | { phase: "error"; error: string };

/**
 * Mehmon uchun "Raqamni ko'rsatish" (ega, 2026-11-18: raqam hammaga — tugma bosilganda). Bosilganda server IP limiti
 * bilan e'londagi ochiq raqamni beradi; ko'rsatilgach — katta "Qo'ng'iroq qilish", raqam va nusxa olish.
 * Raqam yo'q / limit — kirish taklifi (kirgan foydalanuvchi so'rov yuborishi yoki o'z limiti bilan ko'rishi mumkin).
 */
export function RevealPhone({ kind, id, loginHref }: { kind: "vacancy" | "worker"; id: string; loginHref: string }) {
  const { t } = useT();
  const [state, setState] = useState<State>({ phase: "idle" });

  const reveal = async () => {
    setState({ phase: "loading" });
    const res = await revealListingPhone({ kind, id }).catch(() => null);
    if (res?.ok && res.data) setState({ phase: "shown", phones: res.data });
    else setState({ phase: "error", error: res && !res.ok ? res.error : "unavailable" });
  };

  if (state.phase === "shown") {
    const { phone, phone2 } = state.phones;
    return (
      <div className="space-y-2" data-revealed-phone>
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          data-contact="call"
          className="press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success px-4 text-lg font-bold text-success-foreground shadow-sm hover:opacity-90"
        >
          <Phone className="size-6" aria-hidden /> {t("contacts.call")}
        </a>
        <div className="flex items-center justify-between gap-2">
          <span className="tabular text-lg font-bold">{formatPhone(phone)}</span>
          <CopyButton value={phone} />
        </div>
        {phone2 ? (
          <a
            href={`tel:${phone2.replace(/[^\d+]/g, "")}`}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-semibold hover:bg-secondary"
          >
            <Phone className="size-5" aria-hidden /> <span className="tabular">{formatPhone(phone2)}</span>
          </a>
        ) : null}
      </div>
    );
  }

  if (state.phase === "error") {
    const retry = state.error === "unavailable";
    return (
      <div className="space-y-2" data-reveal-error={state.error}>
        <p className="text-base">{t(`contacts.reveal.${state.error === "none" || state.error === "limit" ? state.error : "unavailable"}`)}</p>
        {retry ? (
          <button type="button" onClick={reveal} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-base font-semibold hover:bg-secondary">
            <RotateCw className="size-4" aria-hidden /> {t("contacts.reveal.retry")}
          </button>
        ) : (
          <Link href={loginHref} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card text-md font-semibold text-primary-ink hover:bg-primary-soft/40">
            <LogIn className="size-4" aria-hidden /> {t("contacts.guest_login")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={reveal}
      disabled={state.phase === "loading"}
      data-reveal-phone
      className="press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success px-4 text-lg font-bold text-success-foreground shadow-sm hover:opacity-90 disabled:opacity-70"
    >
      {state.phase === "loading" ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Phone className="size-6" aria-hidden />} {t("contacts.reveal.show")}
    </button>
  );
}
