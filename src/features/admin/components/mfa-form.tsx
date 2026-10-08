"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { kind: "loading" } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "verify"; factorId: string } | { kind: "error"; message: string };

/** TOTP: birinchi marta — QR kod va kalit (autentifikator ilovaga qo'shish), keyin — 6 xonali kod */
export function MfaForm() {
  const { t } = useT();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (!alive) return;
      if (listError) return setState({ kind: "error", message: t("admin.mfa.load_failed") });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setState({ kind: "verify", factorId: verified.id });
      // tugallanmagan eski urinishlar o'chiriladi (bitta foydalanuvchiga cheklangan son)
      for (const f of data.all.filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `admin-${Date.now()}` });
      if (!alive) return;
      if (enrollError || !enrolled) return setState({ kind: "error", message: t("admin.mfa.load_failed") });
      setState({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "enroll" && state.kind !== "verify") return;
    if (!/^\d{6}$/.test(code)) return setError(t("admin.mfa.code_format"));
    setError(null);
    start(async () => {
      const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: state.factorId, code });
      if (verifyError) {
        setError(t("admin.mfa.wrong_code"));
        return;
      }
      router.replace("/admin");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-8 text-primary" aria-hidden />
        <div>
          <h1 className="text-xl font-bold">{t("admin.mfa.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.mfa.subtitle")}</p>
        </div>
      </div>
      {state.kind === "loading" ? <p className="text-sm text-muted-foreground">{t("admin.mfa.loading")}</p> : null}
      {state.kind === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}
      {state.kind === "enroll" ? (
        <div className="space-y-3">
          <p className="text-sm">{t("admin.mfa.enroll_hint")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase qaytargan SVG data URI */}
          <img src={state.qr} alt={t("admin.mfa.qr_alt")} className="mx-auto size-48 rounded-lg bg-white p-2" />
          <p className="break-all rounded-lg bg-secondary p-2 text-center font-mono text-xs" aria-label={t("admin.mfa.secret")}>
            {state.secret}
          </p>
        </div>
      ) : null}
      {state.kind === "enroll" || state.kind === "verify" ? (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="mfa-code" className="block text-sm font-medium">
            {t("admin.mfa.code_label")}
          </label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            invalid={!!error}
            className="text-center font-mono text-2xl tracking-[0.4em]"
          />
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" fullWidth disabled={pending} aria-busy={pending}>
            {t("admin.mfa.submit")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
