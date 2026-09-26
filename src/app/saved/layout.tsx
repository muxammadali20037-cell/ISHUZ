import type { ReactNode } from "react";
import { Shell } from "@/components/shared/shell";

export default function SavedLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
