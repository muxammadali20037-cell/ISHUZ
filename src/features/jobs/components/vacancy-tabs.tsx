"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Vakansiya bo'limlari tablarda (S3): Tavsif · Talablar · Imtiyozlar · Kompaniya — faqat ma'lumoti borlari.
 * Hamma tab matni sahifa HTML'ida (forceMount): qidiruv tizimlari va sahifa ichida qidirish uchun; ko'rinmaydigani — yashirin.
 */
export function VacancyTabs({ label, tabs }: { label: string; tabs: { value: string; label: string; content: ReactNode }[] }) {
  if (!tabs.length) return null;
  return (
    <Tabs defaultValue={tabs[0]!.value} className="min-w-0">
      <TabsList variant="underline" aria-label={label} className="-mx-4 w-auto px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="min-h-11 flex-none px-3 text-base font-semibold sm:flex-1">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} forceMount className="mt-3 data-[state=inactive]:hidden">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
