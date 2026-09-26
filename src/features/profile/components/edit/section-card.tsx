import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Tahrirlash bo'limi: anchor id + sarlavha + kontent + (Saqlash) footer */
export function EditSectionCard({
  id,
  title,
  description,
  children,
  footer,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card id={id} className={cn("scroll-mt-32 sm:scroll-mt-36", className)}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer ? <CardFooter className="justify-end">{footer}</CardFooter> : null}
    </Card>
  );
}
