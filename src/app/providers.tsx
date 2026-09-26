"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { Toaster } from "@/components/ui/toast";
import { TelegramProvider } from "@/lib/telegram/provider";

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
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
      <I18nProvider locale={locale}>
        <TelegramProvider>
          {children}
          <Toaster />
        </TelegramProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
