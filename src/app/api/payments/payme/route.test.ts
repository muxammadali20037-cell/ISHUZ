import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Payme Merchant API (JSON-RPC) — sandbox (test.paycom.uz) tekshiradigan holatlar: avtorizatsiya, noto'g'ri JSON,
 * noma'lum metod, noto'g'ri parametrlar, HTTP doim 200, fiskal chek (detail) va SetFiscalData. Holat mantiqi (summa,
 * buyurtma, 12 soat, bekor qilish) — SQL'da, supabase/tests/billing.test.sql va payme_sandbox.test.sql da sinaladi.
 */
const KEY = "test-key";
const env = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const rpc = vi.hoisted(() => vi.fn());
const row = vi.hoisted(() => ({ value: null as unknown, error: null as unknown }));
const eqs = vi.hoisted(() => [] as unknown[][]);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => env.value }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const q = {
      select: () => q,
      eq: (...args: unknown[]) => (eqs.push(args), q),
      maybeSingle: async () => ({ data: row.value, error: row.error }),
    };
    return { rpc, from: () => q };
  },
}));

interface RpcJson {
  jsonrpc?: string;
  id?: unknown;
  result?: Record<string, unknown>;
  error: { code: number; message: Record<string, string>; data?: unknown };
}
const auth = (key = KEY) => `Basic ${Buffer.from(`Paycom:${key}`).toString("base64")}`;
async function call(body: unknown, authorization: string | null = auth()) {
  const { POST } = await import("./route");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authorization) headers.authorization = authorization;
  const res = await POST(new Request("https://ishuz.example/api/payments/payme", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
  return { status: res.status, json: (await res.json()) as RpcJson };
}

describe("Payme Merchant API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqs.length = 0;
    env.value = { PAYME_KEY: KEY };
    row.value = null;
    row.error = null;
  });

  it("noto'g'ri kalit yoki kalitsiz — -32504, HTTP 200, bazaga murojaat yo'q", async () => {
    for (const a of [auth("wrong"), null, "Bearer x"]) {
      const r = await call({ id: 1, method: "CheckTransaction", params: { id: "t1" } }, a);
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ jsonrpc: "2.0", id: 1, error: { code: -32504 } });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("buzilgan JSON — -32700; noma'lum metod — -32601; parametr yo'q — -32600", async () => {
    expect((await call("{not json")).json.error.code).toBe(-32700);
    expect((await call({ id: 2, method: "Nope", params: {} })).json).toMatchObject({ id: 2, error: { code: -32601 } });
    expect((await call({ id: 3, method: "CreateTransaction", params: { id: "t1", account: { order_id: "5" } } })).json.error.code).toBe(-32600);
    expect((await call({ id: 4, method: "CheckPerformTransaction", params: { amount: "100", account: { order_id: "5" } } })).json.error.code).toBe(-32600);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("xato matni uch tilda (uz/ru/en)", async () => {
    const r = await call({ id: 5, method: "Nope" });
    expect(Object.keys(r.json.error.message).sort()).toEqual(["en", "ru", "uz"]);
  });

  it("SQL natijasi o'zgarmasdan qaytadi (CreateTransaction), id saqlanadi", async () => {
    rpc.mockResolvedValueOnce({ data: { result: { create_time: 1, transaction: "p1", state: 1 } }, error: null });
    const r = await call({ id: 77, method: "CreateTransaction", params: { id: "t1", time: 1, amount: 2_450_000, account: { order_id: 100123 } } });
    expect(rpc).toHaveBeenCalledWith("payme_create", { p_txn: "t1", p_time: 1, p_order: "100123", p_amount: 2_450_000 });
    expect(r.json).toEqual({ jsonrpc: "2.0", id: 77, result: { create_time: 1, transaction: "p1", state: 1 } });
  });

  it("SQL xatosi — -32400 (Payme keyin qayta urinadi)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const r = await call({ id: 6, method: "PerformTransaction", params: { id: "t1" } });
    expect(r.json.error.code).toBe(-32400);
  });

  it("fiskal kodlar yo'q — CheckPerformTransaction avvalgidek (detail yo'q)", async () => {
    rpc.mockResolvedValueOnce({ data: { result: { allow: true } }, error: null });
    const r = await call({ id: 7, method: "CheckPerformTransaction", params: { amount: 2_450_000, account: { order_id: "100123" } } });
    expect(r.json.result).toEqual({ allow: true });
  });

  it("fiskal kodlar bor — detail: xizmat nomi, narx tiyinda, IKPU, qadoq kodi, QQS", async () => {
    env.value = { PAYME_KEY: KEY, PAYME_FISCAL_CODE: "11111111111111111", PAYME_FISCAL_PACKAGE_CODE: "1111111", PAYME_FISCAL_VAT: 0 };
    rpc.mockResolvedValueOnce({ data: { result: { allow: true } }, error: null });
    row.value = { purpose: "vacancy_publish", plan: "max", amount: 49_500 };
    const r = await call({ id: 8, method: "CheckPerformTransaction", params: { amount: 4_950_000, account: { order_id: "100124" } } });
    expect(eqs).toContainEqual(["order_no", 100124]);
    expect(r.json.result).toEqual({
      allow: true,
      detail: {
        receipt_type: 0,
        items: [{ title: "Ish topdim: vakansiya e'lonini joylash (Maksimal)", price: 4_950_000, count: 1, code: "11111111111111111", package_code: "1111111", vat_percent: 0 }],
      },
    });
  });

  it("buyurtma xato bo'lsa (SQL error qaytarsa) — detail qo'shilmaydi, xato o'zgarmaydi", async () => {
    env.value = { PAYME_KEY: KEY, PAYME_FISCAL_CODE: "11111111111111111", PAYME_FISCAL_PACKAGE_CODE: "1111111" };
    rpc.mockResolvedValueOnce({ data: { error: { code: -31050, message: { uz: "x", ru: "x", en: "x" }, data: "order_id" } }, error: null });
    const r = await call({ id: 9, method: "CheckPerformTransaction", params: { amount: 1, account: { order_id: "1" } } });
    expect(r.json.error.code).toBe(-31050);
    expect(r.json.result).toBeUndefined();
  });

  it("SetFiscalData: tranzaksiya bor — success; yo'q — -32001; parametr xato — -32602", async () => {
    const params = { id: "t1", type: "PERFORM", fiscal_data: { receipt_id: 1, status_code: 0, terminal_id: "EP1", fiscal_sign: "x" } };
    row.value = { id: "p1" };
    expect((await call({ id: 10, method: "SetFiscalData", params })).json).toEqual({ jsonrpc: "2.0", id: 10, result: { success: true } });
    expect(eqs).toContainEqual(["provider_txn_id", "t1"]);
    row.value = null;
    expect((await call({ id: 11, method: "SetFiscalData", params })).json.error.code).toBe(-32001);
    expect((await call({ id: 12, method: "SetFiscalData", params: { ...params, type: "OTHER" } })).json.error.code).toBe(-32602);
    expect((await call({ id: 13, method: "SetFiscalData", params: { id: "t1", type: "CANCEL" } })).json.error.code).toBe(-32602);
  });
});
