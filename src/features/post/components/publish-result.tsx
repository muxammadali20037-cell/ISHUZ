"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, Clock3, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutPanel } from "@/features/billing/components/checkout-panel";
import { cn } from "@/lib/utils";

type Action = { label: string; href: string; primary?: boolean };

/**
 * Saqlashdan keyingi ekran — faqat HAQIQIY holat: "joylandi" faqat qidiruvda ko'rinsa;
 * to'lov kerak yoki tekshiruvda bo'lsa shuni aniq aytadi va keyingi qadamni beradi.
 * To'lov kerak bo'lsa — to'lov paneli shu ekranning o'zida (nima olinadi, narx, usullar): Payme/Click yoki balansgacha 1 bosish.
 */
export function PublishResult({
  tone,
  title,
  description,
  actions,
  payment,
  children,
}: {
  tone: "success" | "review" | "payment";
  title: string;
  description: string;
  actions: Action[];
  payment?: { purpose: "worker_listing" | "vacancy_publish"; targetId: string };
  children?: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "review" ? Clock3 : Rocket;
  return (
    <div className="container-narrow py-8 text-lg sm:py-12" role="status" aria-live="polite">
      <div className={cn("rounded-2xl border-2 p-6 text-center sm:p-8", tone === "success" ? "border-success bg-success-soft" : "border-primary/40 bg-primary-soft/60")}>
        <Icon className={cn("mx-auto size-16", tone === "success" ? "text-success" : "text-primary")} aria-hidden />
        <h1 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-lg text-foreground/80">{description}</p>
      </div>
      {children}
      {payment ? <CheckoutPanel purpose={payment.purpose} targetId={payment.targetId} variant="inline" className="mt-6" /> : null}
      <div className="mt-6 grid gap-3">
        {actions.map((a, i) => (
          <Button key={a.href} asChild size="xl" variant={a.primary || (!payment && i === 0) ? "default" : "outline"} className="h-14 w-full text-lg">
            <Link href={a.href}>{a.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
