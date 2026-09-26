"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: "pill" | "underline" }>(
  ({ className, variant = "pill", ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex w-full gap-1",
        variant === "pill" ? "rounded-xl bg-secondary p-1" : "border-b border-border",
        "overflow-x-auto scrollbar-none",
        className,
      )}
      data-variant={variant}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex-1 whitespace-nowrap px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
        "[[data-variant=pill]_&]:rounded-lg [[data-variant=pill]_&]:data-[state=active]:bg-card [[data-variant=pill]_&]:data-[state=active]:text-foreground [[data-variant=pill]_&]:data-[state=active]:shadow-sm",
        "[[data-variant=underline]_&]:-mb-px [[data-variant=underline]_&]:border-b-2 [[data-variant=underline]_&]:border-transparent [[data-variant=underline]_&]:data-[state=active]:border-primary [[data-variant=underline]_&]:data-[state=active]:text-primary",
        className,
      )}
      {...props}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn("mt-4 focus-visible:outline-none", className)} {...props} />,
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
