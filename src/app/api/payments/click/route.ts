import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyClickSign } from "@/features/billing/providers";

/**
 * Click SHOP API: bitta URL, action=0 (Prepare) va action=1 (Complete).
 * Kabinetda Prepare va Complete URL sifatida /api/payments/click ko'rsatiladi.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: -8, error_note: "Error in request from click" });
  const f: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") f[k] = v;

  const base = { click_trans_id: f.click_trans_id, merchant_trans_id: f.merchant_trans_id };
  if (!verifyClickSign(f)) return NextResponse.json({ ...base, error: -1, error_note: "SIGN CHECK FAILED!" });
  const clickTransId = Number(f.click_trans_id);
  const amount = Number(f.amount);
  const clickError = Number(f.error ?? 0);
  if (!Number.isFinite(clickTransId) || !Number.isFinite(amount)) return NextResponse.json({ ...base, error: -8, error_note: "Error in request from click" });

  const admin = createAdminClient();
  if (f.action === "0") {
    const { data, error } = await admin.rpc("click_prepare", { p_click_trans_id: clickTransId, p_order: f.merchant_trans_id ?? "", p_amount: amount, p_error: clickError });
    if (error || !data) {
      console.error("[click] prepare", error?.message);
      return NextResponse.json({ ...base, error: -7, error_note: "Failed to update user" });
    }
    return NextResponse.json({ ...base, ...(data as Record<string, unknown>) });
  }
  if (f.action === "1") {
    const prepareId = Number(f.merchant_prepare_id);
    if (!Number.isFinite(prepareId)) return NextResponse.json({ ...base, error: -6, error_note: "Transaction does not exist" });
    const { data, error } = await admin.rpc("click_complete", { p_click_trans_id: clickTransId, p_order: f.merchant_trans_id ?? "", p_prepare_id: prepareId, p_amount: amount, p_error: clickError });
    if (error || !data) {
      console.error("[click] complete", error?.message);
      return NextResponse.json({ ...base, error: -7, error_note: "Failed to update user" });
    }
    return NextResponse.json({ ...base, ...(data as Record<string, unknown>) });
  }
  return NextResponse.json({ ...base, error: -3, error_note: "Action not found" });
}
