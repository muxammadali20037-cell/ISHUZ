import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SCHEMA_PROBES, checkSchema, isMissingObject } from "./schema-probes";

type Result = { error: { code: string; message?: string } | null };

/** PostgREST mijozining soxta nusxasi: rpc/from nomiga qarab natija qaytaradi */
function fakeDb(byName: Record<string, Result>) {
  const res = (name: string) => Promise.resolve(byName[name] ?? { error: null });
  return {
    rpc: (name: string) => res(name),
    from: (name: string) => ({ select: () => ({ limit: () => res(name) }) }),
  } as never;
}

describe("isMissingObject", () => {
  it("funksiya/jadval/ustun yo'q kodlarini taniydi", () => {
    for (const code of ["PGRST202", "PGRST205", "42P01", "42883", "42703"]) expect(isMissingObject({ code })).toBe(true);
  });
  it("boshqa xatolar — 'yo'q' emas", () => {
    expect(isMissingObject({ code: "42501" })).toBe(false);
    expect(isMissingObject({ code: "57014" })).toBe(false);
    expect(isMissingObject(null)).toBe(false);
  });
});

describe("checkSchema", () => {
  it("hamma migratsiya bor — ok", async () => {
    expect(await checkSchema(fakeDb({}))).toEqual({ ok: true, missing: [], errors: [] });
  });

  it("yetishmagan migratsiyalarni nomi bilan ko'rsatadi (prod: 0071 va 0074 yo'q)", async () => {
    const r = await checkSchema(fakeDb({ public_companies: { error: { code: "PGRST202" } }, contact_reveals: { error: { code: "PGRST205" } } }));
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["0071", "0074"]);
    expect(r.errors).toEqual([]);
  });

  it("ruxsat xatosi (42501) — obyekt bor, ok; boshqa xato — alohida", async () => {
    const r = await checkSchema(fakeDb({ my_duplicate_vacancy: { error: { code: "42501" } }, vacancy_public_stub: { error: { code: "57014" } } }));
    expect(r.missing).toEqual([]);
    expect(r.errors).toEqual(["0069"]);
  });

  it("har bir migratsiya bir marta, o'sish tartibida", () => {
    const ids = SCHEMA_PROBES.map((p) => p.migration);
    expect(ids).toEqual([...new Set(ids)].sort());
  });
});
