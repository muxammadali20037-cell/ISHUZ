"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, Sheet } from "@/components/ui/dialog";

/**
 * URL bilan boshqariladigan Sheet (?view=<id>). Yopilganda closeHref ga qaytadi.
 * Kontent serverda render qilinadi (children).
 */
export function UrlSheet({ title, description, closeHref, children, footer, wide }: { title: string; description?: string; closeHref: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setOpen(false);
          router.replace(closeHref, { scroll: false });
        }
      }}
    >
      <Sheet title={title} description={description} footer={footer} className={wide ? "sm:max-w-3xl" : "sm:max-w-xl"}>
        {children}
      </Sheet>
    </Dialog>
  );
}
