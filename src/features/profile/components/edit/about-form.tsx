"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { updateAbout } from "../../actions";
import { useAction } from "../use-action";
import { EditSectionCard } from "./section-card";
import { fieldError } from "./form-utils";

const formSchema = z.object({
  headline: z.string().trim().max(80, "max_length"),
  about: z.string().trim().max(2000, "max_length"),
});
type FormValues = z.infer<typeof formSchema>;

export function AboutForm({ headline, about }: { headline: string | null; about: string | null }) {
  const { t } = useT();
  const { pending, run } = useAction();
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { headline: headline ?? "", about: about ?? "" } });
  const { errors } = form.formState;
  const headlineLen = form.watch("headline").length;
  const aboutLen = form.watch("about").length;

  return (
    <form onSubmit={form.handleSubmit((v) => run(() => updateAbout(v)))}>
      <EditSectionCard
        id="about"
        title={t("profile.sections.about")}
        footer={
          <Button type="submit" loading={pending}>
            {t("common.actions.save")}
          </Button>
        }
      >
        <Field label={t("profile.labels.headline")} htmlFor="headline" hint={`${headlineLen}/80`} error={fieldError(t, errors.headline?.message, { max: 80 })}>
          <Input id="headline" maxLength={80} placeholder={t("profile.labels.headline_placeholder")} invalid={!!errors.headline} {...form.register("headline")} />
        </Field>
        <Field label={t("profile.labels.about")} htmlFor="about" hint={`${aboutLen}/2000`} error={fieldError(t, errors.about?.message, { max: 2000 })}>
          <Textarea id="about" maxLength={2000} rows={6} placeholder={t("profile.labels.about_placeholder")} invalid={!!errors.about} {...form.register("about")} />
        </Field>
      </EditSectionCard>
    </form>
  );
}
