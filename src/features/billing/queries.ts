import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isMissingRelation } from "@/features/saved/missing";
import type { Database } from "@/types/database.types";
import { rowStatus, type PaymentRowStatus } from "./pricing";
import type { WalletInfo } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Hamyon holati: ready — ishlaydi; disabled — hamma xizmat bepul (to'ldirish ma'nosiz); missing — 0063 bazada hali yo'q.
 */
export async function loadWallet(supabase: Supabase): Promise<{ state: "ready" | "disabled" | "missing"; wallet: WalletInfo | null }> {
  const { data, error, status } = await supabase.rpc("my_wallet");
  if (error) {
    if (!isMissingRelation(error, status)) console.error("[billing] my_wallet", error.message);
    return { state: "missing", wallet: null };
  }
  const w = (data ?? {}) as Record<string, unknown>;
  if (w.enabled !== true) return { state: "disabled", wallet: null };
  const n = (k: string) => Number(w[k]) || 0;
  return {
    state: "ready",
    wallet: { balance: n("balance"), bonusPercent: n("bonus_percent"), bonusMin: n("bonus_min"), topupMin: n("topup_min"), topupMax: n("topup_max") },
  };
}

export type PaymentPurpose = Database["public"]["Enums"]["payment_purpose"];

export interface PaymentRow {
  id: string;
  orderNo: number;
  purpose: PaymentPurpose;
  amount: number;
  /** pending 1 soatdan eski — "To'lanmagan" (Payme/Click sahifasi yopilgan) */
  status: PaymentRowStatus;
  provider: string | null;
  at: string;
  vacancyId: string | null;
  workerId: string | null;
  bonus: number;
}

/** "To'lovlarim": o'z to'lovlari (RLS), to'ldirish bonuslari, hamyon */
export async function getBillingPage(): Promise<{ walletState: "ready" | "disabled" | "missing"; wallet: WalletInfo | null; payments: PaymentRow[] }> {
  const supabase = await createClient();
  const [{ state, wallet }, pays] = await Promise.all([
    loadWallet(supabase),
    supabase
      .from("payments")
      .select("id, order_no, purpose, amount, status, provider, created_at, paid_at, vacancy_id, worker_id")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (pays.error) console.error("[billing] payments", pays.error.message);
  const rows = pays.data ?? [];
  const bonuses = new Map<string, number>();
  if (state !== "missing" && rows.some((r) => r.purpose === "wallet_topup")) {
    const { data } = await supabase.from("wallet_ledger").select("payment_id, delta").eq("kind", "bonus").in("payment_id", rows.map((r) => r.id));
    for (const b of data ?? []) if (b.payment_id) bonuses.set(b.payment_id, (bonuses.get(b.payment_id) ?? 0) + b.delta);
  }
  return {
    walletState: state,
    wallet,
    payments: rows.map((r) => ({
      id: r.id,
      orderNo: r.order_no,
      purpose: r.purpose,
      amount: r.amount,
      status: rowStatus(r.status, r.created_at),
      provider: r.provider,
      at: r.paid_at ?? r.created_at,
      vacancyId: r.vacancy_id,
      workerId: r.worker_id,
      bonus: bonuses.get(r.id) ?? 0,
    })),
  };
}
