"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Constants, type Tables } from "@/types/database.types";
import { updatePersonal } from "../../actions";
import { useAction } from "../use-action";
import { AvatarUpload } from "./avatar-upload";
import { EditSectionCard } from "./section-card";
import { fieldError } from "./form-utils";

const formSchema = z.object({
  first_name: z.string().trim().min(2, "min_length").max(60, "max_length"),
  last_name: z.string().trim().min(1, "required").max(60, "max_length"),
  birth_date: z.string(),
  gender: z.enum(["", ...Constants.public.Enums.gender]),
});
type FormValues = z.infer<typeof formSchema>;

function isoDaysAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export function PersonalForm({ profile }: { profile: Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "birth_date" | "gender" | "avatar_url"> }) {
  const { t, tEnum } = useT();
  const { pending, run } = useAction();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { first_name: profile.first_name, last_name: profile.last_name, birth_date: profile.birth_date ?? "", gender: profile.gender ?? "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((v) =>
    run(() => updatePersonal({ first_name: v.first_name, last_name: v.last_name, birth_date: v.birth_date || null, gender: v.gender || null })),
  );

  return (
    <form onSubmit={submit}>
      <EditSectionCard
        id="personal"
        title={t("profile.sections.personal")}
        footer={
          <Button type="submit" loading={pending}>
            {t("common.actions.save")}
          </Button>
        }
      >
        <AvatarUpload userId={profile.id} avatarUrl={profile.avatar_url} fallback={`${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase() || "?"} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("profile.labels.first_name")} htmlFor="first_name" required error={fieldError(t, errors.first_name?.message, { min: 2, max: 60 })}>
            <Input id="first_name" autoComplete="given-name" invalid={!!errors.first_name} {...form.register("first_name")} />
          </Field>
          <Field label={t("profile.labels.last_name")} htmlFor="last_name" required error={fieldError(t, errors.last_name?.message, { min: 1, max: 60 })}>
            <Input id="last_name" autoComplete="family-name" invalid={!!errors.last_name} {...form.register("last_name")} />
          </Field>
          <Field label={t("profile.labels.birth_date")} htmlFor="birth_date" hint={t("profile.labels.optional")} error={fieldError(t, errors.birth_date?.message)}>
            <Input id="birth_date" type="date" min={isoDaysAgo(90)} max={isoDaysAgo(14)} invalid={!!errors.birth_date} {...form.register("birth_date")} />
          </Field>
          <Field label={t("profile.labels.gender")} htmlFor="gender" hint={t("profile.labels.optional")}>
            <Select
              id="gender"
              placeholder={t("profile.labels.select_placeholder")}
              options={Constants.public.Enums.gender.map((g) => ({ value: g, label: tEnum("gender", g) }))}
              {...form.register("gender")}
            />
          </Field>
        </div>
      </EditSectionCard>
    </form>
  );
}
