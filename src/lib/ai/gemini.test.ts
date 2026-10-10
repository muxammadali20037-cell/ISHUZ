import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ GEMINI_API_KEY: "g-key", GEMINI_MODEL: undefined }) }));

const { AiBusyError, geminiJson, geminiProbe, toGeminiSchema } = await import("./gemini");
const { workerExtractSchema, vacancyExtractSchema } = await import("@/features/ai/extract");

const schema = z.object({ name: z.string().nullable().describe("ism"), kind: z.enum(["a", "b"]).nullable(), tags: z.array(z.object({ n: z.number().int() })) });

afterEach(() => vi.unstubAllGlobals());

describe("toGeminiSchema", () => {
  it("nullable, enum, array va obyektlarni Gemini formatiga o'giradi", () => {
    expect(toGeminiSchema(z.toJSONSchema(schema) as never)).toEqual({
      type: "OBJECT",
      properties: {
        name: { type: "STRING", nullable: true, description: "ism" },
        kind: { type: "STRING", nullable: true, enum: ["a", "b"] },
        tags: { type: "ARRAY", items: { type: "OBJECT", properties: { n: { type: "INTEGER" } }, propertyOrdering: ["n"], required: ["n"] } },
      },
      propertyOrdering: ["name", "kind", "tags"],
      required: ["name", "kind", "tags"],
    });
  });

  it("haqiqiy sxemalarda noma'lum tur qolmaydi", () => {
    const walk = (s: { type: string; items?: unknown; properties?: Record<string, unknown> }): string[] => [
      s.type,
      ...(s.items ? walk(s.items as never) : []),
      ...Object.values(s.properties ?? {}).flatMap((v) => walk(v as never)),
    ];
    for (const sc of [workerExtractSchema, vacancyExtractSchema]) {
      const types = new Set(walk(toGeminiSchema(z.toJSONSchema(sc) as never)));
      expect([...types].every((t) => ["OBJECT", "STRING", "INTEGER", "NUMBER", "BOOLEAN", "ARRAY"].includes(t))).toBe(true);
    }
  });
});

describe("geminiJson", () => {
  it("so'rov: kalit headerda, JSON rejim; javob zod bilan tekshiriladi", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"Ali","kind":"a","tags":[{"n":1}]}' }] } }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await geminiJson(schema, "sys", "matn")).toEqual({ name: "Ali", kind: "a", tags: [{ n: 1 }] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/gemini-flash-latest:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-key");
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.systemInstruction.parts[0].text).toBe("sys");
  });

  it("sxemaga mos kelmasa null, 429 — band", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":5}' }] } }] }))));
    expect(await geminiJson(schema, "s", "t")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    await expect(geminiJson(schema, "s", "t")).rejects.toBeInstanceOf(AiBusyError);
  });
});

describe("geminiJson: band bo'lsa zaxira model, tez rejim", () => {
  const ok = (body: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }));
  const good = { name: "Ali", kind: "a", tags: [] };

  it("asosiy model 503 → zaxira modeldan javob; fikrlash o'chirilgan", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.includes("gemini-flash-latest") ? new Response("overloaded", { status: 503 }) : ok(good)));
    vi.stubGlobal("fetch", fetchMock);
    expect(await geminiJson(schema, "s", "t")).toEqual(good);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/models/gemini-flash-latest:");
    expect(urls[1]).toContain("/models/gemini-flash-lite-latest:");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("vaqt tugasa yoki tarmoq uzilsa — keyingi model; hammasi band bo'lsa AiBusyError", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      n += 1;
      if (n === 1) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return ok(good);
    }));
    expect(await geminiJson(schema, "s", "t")).toEqual(good);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    await expect(geminiJson(schema, "s", "t")).rejects.toBeInstanceOf(AiBusyError);
  });

  it("model fikrlashni o'chirishni qo'llamasa — o'sha model usiz qayta so'raladi", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return body.generationConfig.thinkingConfig ? new Response('{"error":{"message":"thinking_budget is not supported"}}', { status: 400 }) : ok(good);
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await geminiJson(schema, "s", "t")).toEqual(good);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/models/gemini-flash-latest:");
  });

  it("ruxsat yo'q (403) — boshqa modellar ham sinaladi; hammasi 4xx bo'lsa xato matni bilan (band emas)", async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":{"message":"Permission denied"}}', { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const err = await geminiJson(schema, "s", "t").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AiBusyError);
    expect(String(err.message)).toContain("http_403: Permission denied");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("noto'g'ri kalit (400) — fikrlashsiz ham sinab, keyin xato matni", async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":{"code":400,"message":"API key not valid. Please pass a valid API key."}}', { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const err = await geminiJson(schema, "s", "t").catch((e) => e);
    expect(err).not.toBeInstanceOf(AiBusyError);
    expect(String(err.message)).toContain("API key not valid");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

describe("geminiProbe (admin tekshiruvi)", () => {
  it("har bir model uchun natija: ishladi / xato matni", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("gemini-flash-latest:") ? new Response('{"error":{"message":"Quota exceeded for metric"}}', { status: 429 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })),
    ));
    const res = await geminiProbe();
    expect(res.map((r) => r.model)).toEqual(["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"]);
    expect(res[0]).toMatchObject({ ok: false });
    expect(res[0]!.error).toContain("http_429: Quota exceeded");
    expect(res[1]).toMatchObject({ ok: true, error: null });
  });
});
