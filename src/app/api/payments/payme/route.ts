import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymeAuth } from "@/features/billing/providers";
import type { Json } from "@/types/database.types";

/**
 * Payme Merchant API (JSON-RPC 2.0). Holat mantiqi SQL funksiyalarda (qator qulfi bilan, atomar):
 * payme_check_perform / payme_create / payme_perform / payme_cancel / payme_check / payme_statement.
 * Javob har doim HTTP 200 (Payme talabi).
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
  return reply(id, res.data as Record<string, unknown>);
}
