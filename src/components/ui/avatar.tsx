"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base", xl: "size-20 text-xl", "2xl": "size-28 text-3xl" };

function Avatar({
  src,
  fallback,
  alt = "",
  size = "md",
  className,
  square,
}: {
  src?: string | null;
  fallback: string;
  alt?: string;
  size?: keyof typeof sizes;
  className?: string;
  square?: boolean;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative flex shrink-0 overflow-hidden bg-primary-soft", square ? "rounded-xl" : "rounded-full", sizes[size], className)}
    >
      {src ? <AvatarPrimitive.Image src={src} alt={alt} className="aspect-square size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} className="flex size-full items-center justify-center font-semibold uppercase text-primary">
        {fallback}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export { Avatar };
