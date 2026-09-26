"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, BadgeCheck, Phone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Constants } from "@/types/database.types";
import { formatPhone, formatPhoneAsYouType, initials, normalizePhone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { savePersonal, sendPhoneChangeCode, verifyPhoneChangeCode } from "../../actions";
import { personalSchema, type PersonalInput } from "../../schema";
import type { DraftContacts, DraftProfile } from "../../types";
import { birthDateBounds } from "../../utils";
import { AvatarUpload } from "../file-upload";
import { WizardFooter, errorMessage, fieldError, singleValue, useStepSubmit } from "../wizard-shell";

export function Step1Personal({ userId, profile, contacts }: { userId: string; profile: DraftProfile; contacts: DraftContacts | null }) {
  const { t, tEnum } = useT();
  const { pending, submit } = useStepSubmit();
  const bounds = birthDateBounds();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInput>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      birth_date: profile.birth_date ?? "",
      gender: profile.gender ?? undefined,
      telegram_username: contacts?.telegram_username ?? "",
    },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => submit(() => savePersonal(values)))} className="space-y-6">
      <AvatarUpload userId={userId} url={profile.avatar_url} fallback={initials(profile.first_name, profile.last_name)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("onboarding.worker.personal.first_name")} htmlFor="first_name" required error={fieldError(t, errors.first_name)}>
          <Input id="first_name" autoComplete="given-name" placeholder={t("onboarding.worker.personal.first_name_placeholder")} invalid={!!errors.first_name} {...register("first_name")} />
        </Field>
        <Field label={t("onboarding.worker.personal.last_name")} htmlFor="last_name" required error={fieldError(t, errors.last_name)}>
          <Input id="last_name" autoComplete="family-name" placeholder={t("onboarding.worker.personal.last_name_placeholder")} invalid={!!errors.last_name} {...register("last_name")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("onboarding.worker.personal.birth_date")} htmlFor="birth_date" required error={fieldError(t, errors.birth_date)} description={t("onboarding.worker.personal.birth_date_hint")}>
          <Input id="birth_date" type="date" min={bounds.min} max={bounds.max} invalid={!!errors.birth_date} {...register("birth_date")} />
        </Field>
        <Field label={t("onboarding.worker.personal.gender")} required error={fieldError(t, errors.gender)}>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <ChipGroup
                size="lg"
                options={Constants.public.Enums.gender.map((g) => ({ value: g, label: tEnum("gender", g) }))}
                value={field.value ?? null}
                onChange={(v) => field.onChange(singleValue(v))}
              />
            )}
          />
        </Field>
      </div>

      <PhoneField contacts={contacts} />

      <Field
        label={t("onboarding.worker.personal.telegram")}
        htmlFor="telegram_username"
        hint={t("common.labels.optional")}
        error={fieldError(t, errors.telegram_username)}
        description={t("onboarding.worker.personal.telegram_hint")}
      >
        <Input id="telegram_username" leftIcon={<AtSign />} placeholder="username" autoCapitalize="none" autoCorrect="off" invalid={!!errors.telegram_username} {...register("telegram_username")} />
      </Field>

      <WizardFooter step={1} pending={pending} />
    </form>
  );
}

/**
 * Telefon: bor bo'lsa faqat o'qish (RLS o'zgartirishga yo'l qo'ymaydi).
 * Yo'q bo'lsa (Telegram orqali kirganlar) — Supabase Auth "phone change" OTP orqali qo'shiladi.
 */
function PhoneField({ contacts }: { contacts: DraftContacts | null }) {
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
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="tracking-[0.3em]"
            />
            <Button type="button" onClick={verify} loading={pending} disabled={code.length < 4} className="shrink-0">
              {t("auth.verify")}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs">
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStage("idle"); setCode(""); setError(null); }}>
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
