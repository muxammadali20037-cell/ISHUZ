"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Phone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatPhone, formatPhoneAsYouType, normalizePhone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Question, QuestionProgress, useQuestionFlow } from "@/components/shared/question-flow";
import { savePersonal, sendPhoneChangeCode, verifyPhoneChangeCode } from "../../actions";
import { TelegramPhoneShare } from "@/features/contacts/telegram-phone-share";
import { useTelegram } from "@/lib/telegram/provider";
import { onboardingPersonalSchema, type OnboardingPersonalInput } from "../../schema";
import type { DraftContacts, DraftProfile } from "../../types";
import { WizardFooter, errorMessage, fieldError, useStepSubmit } from "../wizard-shell";

export function Step1Personal({ profile, contacts }: { userId: string; profile: DraftProfile; contacts: DraftContacts | null }) {
  const { t } = useT();
  const { pending, submit } = useStepSubmit();
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<OnboardingPersonalInput>({
    resolver: zodResolver(onboardingPersonalSchema),
    defaultValues: {
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
    },
  });

  // Sodda: ism → familiya → telefon (hammasi majburiy). Tug'ilgan sana, jins, rasm — keyin profilda.
  const flow = useQuestionFlow<OnboardingPersonalInput>(
    [
      { id: "first_name", fields: ["first_name"] },
      { id: "last_name", fields: ["last_name"] },
      { id: "phone", hidden: !!contacts?.phone },
    ],
    trigger,
  );

  return (
    <form noValidate onSubmit={flow.bindSubmit(handleSubmit((values) => submit(() => savePersonal(values)), flow.onInvalid))} className="space-y-6">
      <QuestionProgress flow={flow} />

      <Question show={flow.is("first_name")}>
        <Field size="lg" label={t("onboarding.worker.personal.first_name")} htmlFor="first_name" required error={fieldError(t, errors.first_name)}>
          <Input id="first_name" autoFocus autoComplete="given-name" placeholder={t("onboarding.worker.personal.first_name_placeholder")} invalid={!!errors.first_name} {...register("first_name")} />
        </Field>
      </Question>

      <Question show={flow.is("last_name")}>
        <Field size="lg" label={t("onboarding.worker.personal.last_name")} htmlFor="last_name" required error={fieldError(t, errors.last_name)}>
          <Input id="last_name" autoFocus autoComplete="family-name" placeholder={t("onboarding.worker.personal.last_name_placeholder")} invalid={!!errors.last_name} {...register("last_name")} />
        </Field>
      </Question>

      <Question show={flow.is("phone")}>
        <PhoneField contacts={contacts} />
      </Question>

      <WizardFooter step={1} pending={pending} onBack={flow.isFirst ? undefined : flow.back} continueLabel={flow.isLast ? undefined : t("common.actions.next")} />
    </form>
  );
}

/**
 * Telefon: bor bo'lsa faqat o'qish (RLS o'zgartirishga yo'l qo'ymaydi).
 * Yo'q bo'lsa (Telegram orqali kirganlar) — Supabase Auth "phone change" OTP orqali qo'shiladi.
 */
export function PhoneField({ contacts }: { contacts: DraftContacts | null }) {
  const { t } = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("+998 ");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const { webApp } = useTelegram();
  const tgShare = !!webApp?.requestContact;
  const [showSms, setShowSms] = useState(!tgShare);

  if (contacts?.phone) {
    return (
      <Field label={t("common.labels.phone")} htmlFor="phone" description={t("onboarding.worker.personal.phone_locked_hint")}>
        <Input
          id="phone"
          value={formatPhone(contacts.phone)}
          readOnly
          disabled
          leftIcon={<Phone />}
          rightSlot={
            contacts.phone_verified_at ? (
              <Badge variant="success">
                <BadgeCheck />
                {t("common.labels.verified")}
              </Badge>
            ) : null
          }
        />
      </Field>
    );
  }

  const send = () => {
    setError(null);
    if (!normalizePhone(phone)) {
      setError(t("auth.errors.invalid_phone"));
      return;
    }
    startTransition(async () => {
      const res = await sendPhoneChangeCode({ phone });
      if (!res.ok) {
        setError(errorMessage(t, res.error));
        return;
      }
      setStage("code");
      setCode("");
      setCountdown(60);
    });
  };

  const verify = () => {
    setError(null);
    startTransition(async () => {
      const res = await verifyPhoneChangeCode({ phone, token: code.trim() });
      if (!res.ok) {
        setError(errorMessage(t, res.error));
        return;
      }
      toast.success(t("onboarding.worker.personal.phone_verified"));
      router.refresh();
    });
  };

  if (!showSms) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{t("contacts.share.title")}</h2>
          <p className="mt-1 text-muted-foreground">{t("contacts.share.why")}</p>
        </div>
        <TelegramPhoneShare
          onShared={() => {
            toast.success(t("onboarding.worker.personal.phone_verified"));
            router.refresh();
          }}
        />
        <button type="button" onClick={() => setShowSms(true)} className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground">
          {t("contacts.share.other_way")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
      <p className="text-sm font-semibold">{t("onboarding.worker.personal.phone_add_title")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("onboarding.worker.personal.phone_add_hint")}</p>
      {stage === "idle" ? (
        <div className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1">
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              leftIcon={<Phone />}
              placeholder={t("auth.phone_placeholder")}
              value={phone}
              invalid={!!error}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
              onChange={(e) => {
                const raw = e.target.value;
                setPhone(raw.length < phone.length ? raw : formatPhoneAsYouType(raw.startsWith("+") ? raw : `+${raw}`));
              }}
            />
          </div>
          <Button type="button" variant="secondary" onClick={send} loading={pending} className="shrink-0">
            {t("auth.send_code")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">{t("auth.code_sent", { phone: formatPhone(normalizePhone(phone)) })}</p>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder={t("auth.code_placeholder")}
              value={code}
              invalid={!!error}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (code.length >= 4) verify();
                }
              }}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="tracking-[0.3em]"
            />
            <Button type="button" onClick={verify} loading={pending} disabled={code.length < 4} className="shrink-0">
              {t("auth.verify")}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStage("idle");
                setCode("");
                setError(null);
              }}
            >
              {t("auth.change_phone")}
            </button>
            {countdown > 0 ? (
              <span className="tabular text-muted-foreground">{t("auth.resend_in", { seconds: countdown })}</span>
            ) : (
              <button type="button" className="font-medium text-primary" onClick={send} disabled={pending}>
                {t("auth.resend")}
              </button>
            )}
          </div>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
