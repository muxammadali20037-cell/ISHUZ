"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogIn, MessageCircle, Phone, RotateCw } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatMoney, formatPhone, telHref } from "@/lib/format";
import { toast } from "@/components/ui/toast";
import { requestPayment } from "@/features/billing/components/payment-dialog";
import { CopyButton } from "./copy-button";
import { openContactChat, revealPhone, type RevealOutcome } from "./reveal-actions";

export type RevealState = { phase: "idle" | "loading" } | RevealOutcome;
type State = RevealState;

/** to'lov oynasi (hamyondan to'langach) shu hodisa bilan xabar beradi — tugma raqamni qayta so'raydi */
export const CONTACT_UNLOCKED_EVENT = "ib:contact-unlocked";

/**
 * "Raqamni ko'rsatish" / "Raqamni ochish · 5 000 so'm" (ega, 2026-11-22, A varianti — narx tugmaning o'zida).
 * Bosilganda server raqamni beradi (bepul rejim — limit bilan; ishchi raqami — juftlik yoziladi, chat ochiladi) yoki narxni:
 * kirgan foydalanuvchiga to'lov oynasi (hamyon / Payme / Click), mehmonga — avval kirish.
 * Ko'rsatilgach — katta "Qo'ng'iroq qilish", raqam, nusxa olish va (ishchi raqami ochilgan bo'lsa) "Chatda yozish".
 */
export function RevealPhone({
  kind,
  id,
  loginHref,
  initial,
  price = null,
}: {
  kind: "vacancy" | "worker";
  id: string;
  /** null — kirgan foydalanuvchi ("Kirish" tugmasi ko'rsatilmaydi) */
  loginHref: string | null;
  /** oldindan olingan natija (yordamchi kartasi: "E'lonni to'liq ko'rish" bosilganda raqam ham birga ochiladi) */
  initial?: RevealState;
  /** ishchi raqami pullik bo'lsa — narx (tugmada ko'rsatiladi); null — bepul */
  price?: number | null;
}) {
  const { t } = useT();
  const [state, setState] = useState<State>(initial ?? { phase: "idle" });

  const reveal = async () => {
    setState({ phase: "loading" });
    const res = await revealPhone({ kind, id }).catch(() => null);
    setState(res ?? { phase: "error", error: "unavailable" });
  };

  // to'lov oynasida hamyondan to'landi — raqam endi ochiq
  useEffect(() => {
    const onUnlocked = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) void reveal();
    };
    window.addEventListener(CONTACT_UNLOCKED_EVENT, onUnlocked);
    return () => window.removeEventListener(CONTACT_UNLOCKED_EVENT, onUnlocked);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reveal faqat id ga bog'liq
  }, [id]);

  if (state.phase === "shown") {
    const { phone, phone2, unlocked } = state.phones;
    return (
      <div className="space-y-2" data-revealed-phone>
        <a
          href={telHref(phone)}
          data-contact="call"
          className="press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success px-4 text-lg font-bold text-success-foreground shadow-sm hover:opacity-90"
        >
          <Phone className="size-6" aria-hidden /> {t("contacts.call")}
        </a>
        <div className="flex items-center justify-between gap-2">
          <a href={telHref(phone)} data-tel className="tabular text-lg font-bold underline-offset-4 hover:underline">{formatPhone(phone)}</a>
          <CopyButton value={phone} />
        </div>
        {phone2 ? (
          <a
            href={telHref(phone2)}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-semibold hover:bg-secondary"
          >
            <Phone className="size-5" aria-hidden /> <span className="tabular">{formatPhone(phone2)}</span>
          </a>
        ) : null}
        {kind === "worker" && unlocked && !loginHref ? <ChatButton workerId={id} /> : null}
      </div>
    );
  }

  if (state.phase === "pay") {
    return <UnlockButton price={state.price} workerId={id} loginHref={loginHref} />;
  }

  if (state.phase === "error") {
    const retry = state.error === "unavailable";
    return (
      <div className="space-y-2" data-reveal-error={state.error}>
        <p className="text-base">{t(`contacts.reveal.${state.error}`)}</p>
        {retry ? (
          <button type="button" onClick={reveal} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-base font-semibold hover:bg-secondary">
            <RotateCw className="size-4" aria-hidden /> {t("contacts.reveal.retry")}
          </button>
        ) : state.error === "limit" && loginHref ? (
          <Link href={loginHref} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card text-md font-semibold text-primary-ink hover:bg-primary-soft/40">
            <LogIn className="size-4" aria-hidden /> {t("contacts.guest_login")}
          </Link>
        ) : null}
      </div>
    );
  }

  // pullik rejim (ishchi raqami): narx birinchi qarashdayoq tugmada
  if (kind === "worker" && price !== null) return <UnlockButton price={price} workerId={id} loginHref={loginHref} />;

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

/**
 * "Raqamni ochish · 5 000 so'm": kirgan — to'lov oynasi (hamyon / Payme / Click; narx va huquq serverda), mehmon — kirish
 * (kirgach shu e'longa qaytadi).
 */
function UnlockButton({ price, workerId, loginHref }: { price: number; workerId: string; loginHref: string | null }) {
  const { t, locale } = useT();
  const inner = (
    <>
      <Lock className="size-6 shrink-0" aria-hidden />
      <span className="min-w-0 text-left">{t("contacts.unlock.button")}</span>
      <span className="ml-auto whitespace-nowrap rounded-lg bg-success-foreground/20 px-2 py-0.5 text-base font-extrabold tabular" data-unlock-price>
        {formatMoney(price, locale)}
      </span>
    </>
  );
  const cls = "press flex min-h-14 w-full items-center gap-2 rounded-2xl bg-success px-4 py-2 text-lg font-bold leading-tight text-success-foreground shadow-sm hover:opacity-90";
  return (
    <div className="space-y-2" data-unlock>
      {loginHref ? (
        <Link href={loginHref} className={cls} data-unlock-button>
          {inner}
        </Link>
      ) : (
        <button type="button" className={cls} data-unlock-button onClick={() => requestPayment({ purpose: "contact_unlock", targetId: workerId })}>
          {inner}
        </button>
      )}
      <p className="text-sm text-muted-foreground">{t("contacts.unlock.note")}</p>
    </div>
  );
}

/** "Chatda yozish": raqami ochilgan ishchi bilan suhbat (0088) */
export function ChatButton({ workerId, className }: { workerId: string; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      data-contact="chat"
      data-open-chat
      onClick={() =>
        start(async () => {
          const res = await openContactChat({ workerId }).catch(() => null);
          if (res?.ok && res.data) router.push(`/messages/${res.data.conversationId}`);
          else toast.error(t("contacts.unlock.chat_failed"));
        })
      }
      className={
        className ??
        "press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-card px-4 text-base font-semibold text-primary-ink hover:bg-primary-soft/40 disabled:opacity-70"
      }
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />} {t("contacts.unlock.chat")}
    </button>
  );
}
