"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckoutPurpose } from "../types";
import { requestPayment } from "./payment-dialog";

/** To'lov bekor bo'lgan yoki yetib bormagan bo'lsa — shu xizmat uchun to'lov oynasini qayta ochish */
export function RetryPay({ purpose, targetId, label }: { purpose: CheckoutPurpose; targetId: string | null; label: string }) {
  return (
    <Button size="lg" className="w-full sm:w-auto" onClick={() => requestPayment({ purpose, targetId })}>
      <RotateCcw className="size-5" aria-hidden /> {label}
    </Button>
  );
}
