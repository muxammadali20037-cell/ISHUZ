import { describe, expect, it } from "vitest";
import { BOT_UA, entryPath, homeEntryStep, nextEntryStep, type EntryState } from "./flow";

const fresh: EntryState = { bot: false, localeChosen: false, introDone: false, mode: null, session: null, inFlow: false };
const worker = { workerOnboarded: true, employerOnboarded: false };
const newcomer = { workerOnboarded: false, employerOnboarded: false };

describe("kirish oqimi: keyingi qadam", () => {
  it("yangi mehmon: avval til, keyin tanishtiruv, keyin kirish", () => {
    expect(nextEntryStep(fresh)).toBe("language");
    expect(nextEntryStep({ ...fresh, localeChosen: true })).toBe("intro");
    expect(nextEntryStep({ ...fresh, localeChosen: true, introDone: true })).toBe("login");
  });

  it("kirgan yangi foydalanuvchi: rol, keyin profil", () => {
    const s = { ...fresh, localeChosen: true, introDone: true, session: newcomer };
    expect(nextEntryStep(s)).toBe("role");
    expect(nextEntryStep({ ...s, mode: "worker" })).toBe("profile");
    expect(nextEntryStep({ ...s, mode: "employer" })).toBe("profile");
  });

  it("qaytgan foydalanuvchi (birorta roli tayyor) — hech qanday qadam yo'q, til cookie'si bo'lmasa ham", () => {
    expect(nextEntryStep({ ...fresh, session: worker })).toBe("done");
    expect(nextEntryStep({ ...fresh, session: { workerOnboarded: false, employerOnboarded: true }, mode: "worker" })).toBe("done");
  });

  it("qidiruv robotiga hech qachon oqim ko'rsatilmaydi", () => {
    expect(nextEntryStep({ ...fresh, bot: true })).toBe("done");
    for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1)", "YandexBot/3.0", "TelegramBot (like TwitterBot)", "facebookexternalhit/1.1", "Chrome-Lighthouse"]) {
      expect(BOT_UA.test(ua)).toBe(true);
    }
    expect(BOT_UA.test("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36")).toBe(false);
  });
});

describe("bosh sahifa: qachon oqimga o'tkaziladi", () => {
  it("birinchi ochilish — til, keyin tanishtiruv", () => {
    expect(homeEntryStep(fresh)).toBe("language");
    expect(homeEntryStep({ ...fresh, localeChosen: true })).toBe("intro");
  });

  it("tanishtiruvni ko'rgan mehmon kirishga majburlanmaydi (bosh sahifa ochiq)", () => {
    expect(homeEntryStep({ ...fresh, localeChosen: true, introDone: true })).toBeNull();
  });

  it("oqimni boshlab, profilni tugatmagan — to'xtagan qadamiga; oqimga kirmagan (tezkor ariza) — bosh sahifa", () => {
    const s: EntryState = { ...fresh, localeChosen: true, introDone: true, session: newcomer, mode: "worker" };
    expect(homeEntryStep({ ...s, inFlow: true })).toBe("profile");
    expect(homeEntryStep({ ...s, inFlow: true, mode: null })).toBe("role");
    expect(homeEntryStep(s)).toBeNull();
  });

  it("qaytgan foydalanuvchi va robot — bosh sahifaning o'zi", () => {
    expect(homeEntryStep({ ...fresh, session: worker, inFlow: true })).toBeNull();
    expect(homeEntryStep({ ...fresh, bot: true })).toBeNull();
  });
});

describe("qadam manzillari", () => {
  it("har qadam o'z sahifasiga; kirishdan keyin oqimga qaytiladi", () => {
    expect(entryPath("language", { mode: null })).toBe("/start/til");
    expect(entryPath("intro", { mode: null })).toBe("/start/tanishtiruv");
    expect(entryPath("login", { mode: null })).toBe("/auth?next=%2Fstart");
    expect(entryPath("role", { mode: null })).toBe("/start/rol");
  });

  it("profil — tanlangan rolning qisqa anketasi, yakunda 'Profilingiz tayyor!'", () => {
    expect(entryPath("profile", { mode: "worker" })).toBe("/onboarding/worker?next=%2Fstart%2Ftayyor");
    expect(entryPath("profile", { mode: "employer" })).toBe("/onboarding/employer?next=%2Fstart%2Ftayyor");
  });

  it("tugagach: ish beruvchi — panel, ish izlovchi — bosh sahifa; kelgan manzil saqlanadi", () => {
    expect(entryPath("done", { mode: "employer", employerOnboarded: true })).toBe("/employer");
    expect(entryPath("done", { mode: "worker" })).toBe("/");
    expect(entryPath("done", { mode: "worker", next: "/jobs/kassir-123?apply=1" })).toBe("/jobs/kassir-123?apply=1");
    expect(entryPath("login", { mode: null, next: "/jobs/kassir-123" })).toBe(`/auth?next=${encodeURIComponent("/start?next=%2Fjobs%2Fkassir-123")}`);
  });

  it("tashqi manzil qabul qilinmaydi", () => {
    expect(entryPath("done", { mode: "worker", next: "https://evil.example/x" })).toBe("/");
    expect(entryPath("done", { mode: "worker", next: "//evil.example" })).toBe("/");
  });
});
