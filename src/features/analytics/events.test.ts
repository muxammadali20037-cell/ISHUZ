import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS, CLIENT_EVENTS, SERVER_EVENTS, cleanProps, isClientEvent } from "./events";

/** src ichidagi barcha .ts/.tsx fayllar (testlarsiz) */
function sources(dir = join(process.cwd(), "src")): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

function namesIn(re: RegExp): Set<string> {
  const out = new Set<string>();
  for (const f of sources()) for (const m of readFileSync(f, "utf8").matchAll(re)) out.add(m[1]!);
  return out;
}

describe("analitika hodisalari: koddagi har bir nom ro'yxatda (aks holda /api/e uni jim tashlab yuboradi)", () => {
  it('[data-track="…"] va { track: "…" } — CLIENT_EVENTS da', () => {
    const used = new Set([...namesIn(/data-track="([a-z_]+)"/g), ...namesIn(/\btrack: "([a-z_]+)"/g)]);
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((n) => !isClientEvent(n))).toEqual([]);
  });

  it('track("…") — CLIENT_EVENTS da', () => {
    const used = namesIn(/\btrack\("([a-z_]+)"/g);
    expect([...used].filter((n) => !isClientEvent(n))).toEqual([]);
  });

  it('trackServer("…") — ANALYTICS_EVENTS da', () => {
    const used = namesIn(/trackServer\(\s*(?:[^,"]*\?\s*)?"([a-z_]+)"/g);
    const all = new Set<string>(ANALYTICS_EVENTS);
    expect([...used].filter((n) => !all.has(n))).toEqual([]);
  });

  it("ro'yxatlar kesishmaydi va nomlar bazadagi CHECK ga mos (^[a-z][a-z0-9_]{1,40}$)", () => {
    const server = new Set<string>(SERVER_EVENTS);
    expect(CLIENT_EVENTS.filter((n) => server.has(n))).toEqual([]);
    for (const n of ANALYTICS_EVENTS) expect(n).toMatch(/^[a-z][a-z0-9_]{1,40}$/);
  });

  it("server hodisasini brauzer yubora olmaydi", () => {
    expect(isClientEvent("application_submit")).toBe(false);
    expect(isClientEvent("post_publish")).toBe(false);
    expect(isClientEvent("save_toggle")).toBe(true);
  });

  it("props: shaxsiy ma'lumot o'tmaydi (faqat qisqa skalyar qiymatlar)", () => {
    expect(cleanProps({ to: "cv", channel: "telegram", phone: "+998 90 123 45 67", Name: "x" })).toEqual({ to: "cv", channel: "telegram" });
  });
});
