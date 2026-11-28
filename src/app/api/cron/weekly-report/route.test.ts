import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authorized = { value: true };
const sendWeeklyReport = vi.fn<(now: Date, opts: { force?: boolean }) => Promise<{ sent: number; skipped?: string }>>(async () => ({ sent: 2 }));
const reportError = vi.fn(async () => undefined);

vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/cron-auth", () => ({ isCronAuthorized: () => authorized.value }));
vi.mock("@/features/admin/weekly.server", () => ({ sendWeeklyReport: (now: Date, opts: { force?: boolean }) => sendWeeklyReport(now, opts) }));
vi.mock("@/lib/monitoring", () => ({ reportError }));

const { GET } = await import("./route");
const req = (q = "") => new NextRequest(`https://ish.test/api/cron/weekly-report${q}`);

describe("/api/cron/weekly-report", () => {
  beforeEach(() => {
    authorized.value = true;
    sendWeeklyReport.mockClear();
    reportError.mockClear();
  });

  it("CRON_SECRET'siz — 401, hech narsa yuborilmaydi", async () => {
    authorized.value = false;
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(sendWeeklyReport).not.toHaveBeenCalled();
  });

  it("cron chaqiruvi: force yo'q; ?force=1 — qo'lda sinash", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: 2 });
    expect(sendWeeklyReport.mock.calls[0]![1]).toEqual({ force: false });
    await GET(req("?force=1"));
    expect(sendWeeklyReport.mock.calls[1]![1]).toEqual({ force: true });
  });

  it("xato — 500, ichki matn chiqmaydi, monitoringga yoziladi", async () => {
    sendWeeklyReport.mockRejectedValueOnce(new Error("admin_users: secret detail"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret detail");
    expect(reportError).toHaveBeenCalledOnce();
  });
});
