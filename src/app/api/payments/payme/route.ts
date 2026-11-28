import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymeAuth } from "@/features/billing/providers";
import { paymeDetail } from "@/features/billing/fiscal";
import { getServerEnv } from "@/lib/env";
import type { Json } from "@/types/database.types";

/**
 * Payme Merchant API (JSON-RPC 2.0). Holat mantiqi SQL funksiyalarda (qator qulfi bilan, atomar):
 * payme_check_perform / payme_create / payme_perform / payme_cancel / payme_check / payme_statement.
 * Javob har doim HTTP 200 (Payme talabi).
 * Fiskal chek: CheckPerformTransaction javobida `detail` (IKPU va qadoq kodi Vercel env'da bo'lsa — fiscal.ts);
 * SetFiscalData — Payme chek ro'yxatdan o'tganini xabar qiladi: tranzaksiya bor bo'lsa "success" (docs/PAYMENTS_LAUNCH.md).
 */
type RpcId = string | number | null;

function reply(id: RpcId, body: Record<string, unknown>) {
  return NextResponse.json({ jsonrpc: "2.0", id, ...body });
}
function rpcError(id: RpcId, code: number, message: string) {
  return reply(id, { error: { code, message: { uz: message, ru: message, en: message } } });
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length < 100 ? v : null);

export async function POST(req: Request) {
  let body: { id?: RpcId; method?: unknown; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const id = body.id ?? null;
  if (!verifyPaymeAuth(req.headers.get("authorization"))) return rpcError(id, -32504, "Insufficient privilege");

  const p = body.params ?? {};
  const account = (p.account ?? {}) as Record<string, unknown>;
  const order = typeof account.order_id === "string" || typeof account.order_id === "number" ? String(account.order_id) : null;
  const admin = createAdminClient();

  let res: { data: Json | null; error: { message: string } | null };
  switch (body.method) {
    case "CheckPerformTransaction": {
      const amount = num(p.amount);
      if (amount === null) return rpcError(id, -32600, "Invalid params");
      res = await admin.rpc("payme_check_perform", { p_order: order ?? "", p_amount: amount });
      break;
    }
    case "CreateTransaction": {
      const txn = str(p.id);
      const time = num(p.time);
      const amount = num(p.amount);
      if (!txn || time === null || amount === null) return rpcError(id, -32600, "Invalid params");
      res = await admin.rpc("payme_create", { p_txn: txn, p_time: time, p_order: order ?? "", p_amount: amount });
      break;
    }
    case "PerformTransaction": {
      const txn = str(p.id);
      if (!txn) return rpcError(id, -32600, "Invalid params");
      res = await admin.rpc("payme_perform", { p_txn: txn });
      break;
    }
    case "CancelTransaction": {
      const txn = str(p.id);
      const reason = num(p.reason);
      if (!txn || reason === null) return rpcError(id, -32600, "Invalid params");
      res = await admin.rpc("payme_cancel", { p_txn: txn, p_reason: reason });
      break;
    }
    case "CheckTransaction": {
      const txn = str(p.id);
      if (!txn) return rpcError(id, -32600, "Invalid params");
      res = await admin.rpc("payme_check", { p_txn: txn });
      break;
    }
    case "SetFiscalData": {
      // Payme chekni soliq tizimida ro'yxatdan o'tkazgach yuboradi (PERFORM yoki CANCEL). Chek ma'lumoti (QR havola) hozircha
      // saqlanmaydi — Payme kabinetida turadi; javob — tranzaksiya bor-yo'qligi
      const txn = str(p.id);
      const type = p.type === "PERFORM" || p.type === "CANCEL" ? p.type : null;
      if (!txn || !type || typeof p.fiscal_data !== "object" || p.fiscal_data === null) return rpcError(id, -32602, "Invalid params");
      const { data: found, error } = await admin.from("payments").select("id").eq("provider", "payme").eq("provider_txn_id", txn).maybeSingle();
      if (error) {
        console.error("[payme] SetFiscalData", error.message);
        return rpcError(id, -32400, "System error");
      }
      if (!found) return rpcError(id, -32001, "Receipt not found");
      const status = (p.fiscal_data as Record<string, unknown>).status_code;
      console.info("[payme] fiscal", type, typeof status === "number" ? status : "?");
      return reply(id, { result: { success: true } });
    }
    case "GetStatement": {
      const from = num(p.from);
      const to = num(p.to);
      if (from === null || to === null) return rpcError(id, -32600, "Invalid params");
      res = await admin.rpc("payme_statement", { p_from: from, p_to: to });
      break;
    }
    default:
      return rpcError(id, -32601, "Method not found");
  }

  if (res.error || !res.data || typeof res.data !== "object") {
    console.error("[payme]", body.method, res.error?.message);
    return rpcError(id, -32400, "System error");
  }
  const data = res.data as Record<string, unknown>;
  if (body.method === "CheckPerformTransaction" && data.result && order) {
    const detail = await fiscalDetail(admin, order);
    if (detail) return reply(id, { result: { ...(data.result as Record<string, unknown>), detail } });
  }
  return reply(id, data);
}

/** Fiskal chek qatori: kodlar sozlangan bo'lsa — buyurtmadan (maqsad, tarif, summa). Xato bo'lsa — chek ma'lumotisiz (to'lov to'xtamaydi) */
async function fiscalDetail(admin: ReturnType<typeof createAdminClient>, order: string) {
  const env = getServerEnv();
  if (!env.PAYME_FISCAL_CODE || !env.PAYME_FISCAL_PACKAGE_CODE || !/^\d{1,18}$/.test(order)) return null;
  const { data, error } = await admin.from("payments").select("purpose, plan, amount").eq("order_no", Number(order)).maybeSingle();
  if (error || !data) {
    if (error) console.error("[payme] fiscal detail", error.message);
    return null;
  }
  return paymeDetail(data, { code: env.PAYME_FISCAL_CODE, packageCode: env.PAYME_FISCAL_PACKAGE_CODE, vat: env.PAYME_FISCAL_VAT });
}
