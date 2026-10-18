"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Save } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeEmail, passwordProblem } from "@/features/auth/admin-login";
import { setAdminLogin } from "../actions/account";
import { useAdminAction } from "./use-admin-action";

/** O'z hisobiga email + parol (zaxira kirish). Qoidalar formada ham, serverda ham bir xil (passwordProblem). */
export function LoginMethodsForm({ initialEmail }: { initialEmail: string }) {
  const { t } = useT();
  const { pending, run } = useAdminAction();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeEmail(email);
    if (!clean) return setError(t("admin.errors.invalid_email"));
    const problem = passwordProblem(password, clean);
    if (problem) return setError(t(`admin.errors.password_${problem}`));
    if (password !== confirm) return setError(t("admin.errors.password_mismatch"));
    setError(null);
    run(() => setAdminLogin({ email: clean, password, confirm }), {
      success: t("admin.account.saved"),
      onOk: () => {
        setPassword("");
        setConfirm("");
      },
    });
  };

  const eye = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? t("auth.admin.hide_password") : t("auth.admin.show_password")}
      aria-pressed={show}
      className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
    >
      {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
    </button>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {/* parol menejeri hisobni to'g'ri bog'lashi uchun */}
      <div>
        <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold">
          {t("admin.account.email_label")}
        </label>
        <Input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          leftIcon={<Mail />}
          placeholder={t("auth.admin.email_placeholder")}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold">
          {t("admin.account.password_label")}
        </label>
        <Input
          id="login-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          leftIcon={<Lock />}
          rightSlot={eye}
          value={password}
          aria-describedby="login-password-hint"
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
        />
        <p id="login-password-hint" className="mt-1.5 text-sm text-muted-foreground">
          {t("admin.account.password_hint")}
        </p>
      </div>
      <div>
        <label htmlFor="login-confirm" className="mb-1.5 block text-sm font-semibold">
          {t("admin.account.confirm_label")}
        </label>
        <Input
          id="login-confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          leftIcon={<Lock />}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending}>
        <Save className="size-4" aria-hidden /> {t("admin.account.save")}
      </Button>
    </form>
  );
}
