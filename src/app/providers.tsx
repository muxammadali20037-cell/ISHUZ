"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/core";
import { Toaster } from "@/components/ui/toast";
import { TelegramProvider } from "@/lib/telegram/provider";
import { ServiceWorkerRegistrar } from "@/components/shared/service-worker";
import { PaymentDialogHost } from "@/features/billing/components/payment-dialog";
import { AnalyticsListener } from "@/features/analytics/listener";
import { SfxListener } from "@/components/shared/sfx-listener";
import { NavProgress } from "@/components/shared/nav-progress";

export function Providers({ locale, messages, children }: { locale: Locale; messages: Dict; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={locale} messages={messages}>
        <TelegramProvider>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
          <PaymentDialogHost />
          <AnalyticsListener />
          <SfxListener />
          <NavProgress />
        </TelegramProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
