import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kanalga avtomatik e'lon (autopost.ts): har e'lon har kanalga bir marta, bir qadamda ko'pi bilan 4 ta, bloklangan muallif
 * va kasbsiz e'lon yuborilmaydi, xato — cheklangan qayta urinish, kanal darajasidagi xato — qadam to'xtaydi.
 * Supabase o'rniga — xotiradagi kichik soxta so'rov quruvchi (faqat kod ishlatadigan usullar).
 */
vi.mock("server-only", () => ({}));
vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
});

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let nextId = 1;

function builder(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "insert" | "update" = "select";
  let payload: Row | null = null;
  let max = Infinity;
  let single = false;
  const api = {
    select: () => api,
    insert: (row: Row) => ((op = "insert"), (payload = row), api),
    update: (patch: Row) => ((op = "update"), (payload = patch), api),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
    in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), api),
    lt: (c: string, v: number) => (filters.push((r) => (r[c] as number) < v), api),
    gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), api),
    not: (c: string) => (filters.push((r) => r[c] !== null && r[c] !== undefined), api),
    order: () => api,
    limit: (n: number) => ((max = n), api),
    maybeSingle: () => ((single = true), api),
    then(resolve: (v: { data: unknown; error: unknown }) => void) {
      const rows = (tables[table] ??= []);
      if (op === "insert") {
        const row = { id: nextId++, ...payload } as Row;
        if (table === "channel_posts" && rows.some((r) => r.entity_type === row.entity_type && r.entity_id === row.entity_id && r.chat_id === row.chat_id)) {
          return resolve({ data: null, error: { code: "23505", message: "duplicate" } });
        }
        rows.push({ created_at: new Date().toISOString(), ...row });
        return resolve({ data: single ? row : [row], error: null });
      }
      const hit = rows.filter((r) => filters.every((f) => f(r))).slice(0, max);
      if (op === "update") for (const r of hit) Object.assign(r, payload);
      resolve({ data: single ? (hit[0] ?? null) : hit, error: null });
    },
  };
  return api;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: builder }) }));
const env = vi.hoisted(() => ({ TELEGRAM_BOT_TOKEN: "x" }) as Record<string, string | undefined>);
vi.mock("@/lib/env", () => ({ getServerEnv: () => env }));
vi.mock("@/lib/telegram/bot", () => ({ miniAppBaseUrl: () => "https://ishuz.vercel.app" }));
const send = vi.fn();
vi.mock("./channel", () => ({ channelChatId: () => "@main", sendChannelMessage: (x: unknown) => send(x) }));

const { runChannelAutopost, channelLink, postListingNow } = await import("./autopost");

const now = () => new Date().toISOString();
const old = new Date(Date.now() - 3 * 86_400_000).toISOString();

function vacancy(id: string, over: Row = {}): Row {
  return {
    id,
    slug: `v-${id}`,
    title: `Sotuvchi ${id}`,
    status: "active",
    published_at: now(),
    salary_from: 4_000_000,
    salary_to: null,
    salary_type: "monthly",
    salary_negotiable: false,
    schedule: "5_2",
    is_remote: false,
    custom_profession: null,
    company: { name: "Baraka" },
    region: { name_uz: "Toshkent shahri" },
    district: null,
    profession: { name_uz: "Sotuvchi" },
    owner: { is_blocked: false },
    ...over,
  };
}

function worker(id: string, over: Row = {}): Row {
  return {
    id,
    headline: null,
    custom_profession: null,
    experience_level: "1_2y",
    is_public: true,
    onboarding_completed_at: old,
    updated_at: now(),
    profession: { name_uz: "Oshpaz" },
    region: { name_uz: "Samarqand viloyati" },
    district: null,
    prefs: { salary_expected: 5_000_000, salary_min: null, salary_type: "monthly", schedules: ["5_2"] },
    owner: { is_blocked: false },
    ...over,
  };
}

beforeEach(() => {
  delete env.TELEGRAM_MAIN_APP;
  delete env.TELEGRAM_BOT_USERNAME;
  for (const k of Object.keys(tables)) delete tables[k];
  nextId = 1;
  send.mockReset();
  let m = 100;
  send.mockImplementation(async () => ({ ok: true, messageId: m++ }));
});

describe("kanalga avtomatik e'lon", () => {
  it("yangi vakansiya (VAKANSIYA) va ishchi (ISHCHI) — har biri bir marta; ikkinchi qadamda takror yo'q", async () => {
    tables.vacancies = [vacancy("a")];
    tables.worker_profiles = [worker("w")];
    expect(await runChannelAutopost()).toMatchObject({ posted: 2, failed: 0 });
    expect(send.mock.calls.map(([x]) => (x as { html: string }).html.split("\n")[0])).toEqual([expect.stringContaining("VAKANSIYA"), expect.stringContaining("ISHCHI")]);
    expect(send.mock.calls[0]![0]).toMatchObject({ chatId: "@main", button: { text: "Ariza qoldirish", url: "https://ishuz.vercel.app/jobs/v-a" } });
    expect(send.mock.calls[0]![0]).toMatchObject({ photo: "https://ishuz.vercel.app/api/promo/vacancy/v-a?f=post", caption: expect.stringContaining("<b>") });
    expect(send.mock.calls[1]![0]).toMatchObject({ photo: "https://ishuz.vercel.app/api/promo/worker/w" });
    expect(tables.channel_posts!.map((r) => r.status)).toEqual(["posted", "posted"]);
    expect(await runChannelAutopost()).toMatchObject({ posted: 0 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("vakansiya raqami — faqat show_phone va kanalga rozilik (channel_phone_at, 0083) bo'lsa; eski rozilik — raqamsiz", async () => {
    tables.vacancies = [vacancy("a", { description: "Tushlik bepul" }), vacancy("b"), vacancy("c")];
    tables.vacancy_contacts = [
      { vacancy_id: "a", phone: "+998901234567", show_phone: true, channel_phone_at: now() },
      { vacancy_id: "b", phone: "+998907654321", show_phone: true, channel_phone_at: null },
      { vacancy_id: "c", phone: "+998909999999", show_phone: false, channel_phone_at: now() },
    ];
    expect(await runChannelAutopost()).toMatchObject({ posted: 3 });
    const caption = (slug: string) => (send.mock.calls.map(([x]) => x as { caption: string; button: { url: string } }).find((x) => x.button.url.endsWith(`/jobs/v-${slug}`))!).caption;
    expect(caption("a")).toContain("📞 Tel: +998901234567");
    expect(caption("a")).toContain("Tushlik bepul");
    expect(caption("b")).not.toMatch(/📞|765/);
    expect(caption("c")).not.toMatch(/📞|9999/);
  });

  it("to'liq formadagi vakansiya (e'londa raqam qatori yo'q) — kompaniya yoki ish beruvchining aloqa raqami", async () => {
    tables.vacancies = [
      vacancy("co", { company: { name: "Baraka", phone: "+998711234567" }, owner_profile_id: "e1" }),
      vacancy("person", { company: null, owner_profile_id: "e2" }),
      vacancy("none", { company: null, owner_profile_id: "e3" }),
    ];
    tables.employer_profiles = [{ profile_id: "e1", contact_phone: "+998900000001" }, { profile_id: "e2", contact_phone: "+998935556677" }, { profile_id: "e3", contact_phone: null }];
    expect(await runChannelAutopost()).toMatchObject({ posted: 3 });
    const caption = (slug: string) => (send.mock.calls.map(([x]) => x as { caption: string; button: { url: string } }).find((x) => x.button.url.endsWith(`/jobs/v-${slug}`))!).caption;
    expect(caption("co")).toMatch(/📞 Tel: \+998711234567$/);
    expect(caption("person")).toMatch(/📞 Tel: \+998935556677$/);
    expect(caption("none")).not.toMatch(/📞/);
  });

  it("ishchi raqami — kanal tilga olingan matndan keyin saqlangan bo'lsa (ikkala raqam); oldingisi — raqamsiz", async () => {
    tables.worker_profiles = [worker("new"), worker("old"), worker("bare")];
    tables.worker_listing_phones = [
      { worker_id: "new", phone: "+998932728766", phone2: "+998901112233", updated_at: "2026-11-21T09:00:00.5+00:00" },
      { worker_id: "old", phone: "+998944445566", phone2: null, updated_at: "2026-11-19T10:00:00+00:00" },
    ];
    expect(await runChannelAutopost()).toMatchObject({ posted: 3 });
    const html = (id: string) => (send.mock.calls.map(([x]) => x as { html: string; button: { url: string } }).find((x) => x.button.url.endsWith(`/workers/${id}`))!).html;
    expect(html("new")).toMatch(/📞 Tel: \+998932728766, \+998901112233$/);
    expect(html("old")).not.toMatch(/📞|944445566/);
    expect(html("bare")).not.toMatch(/📞/);
  });

  it("ishchi raqami pullik bo'lsa (0088, admin yoqqan) — kanal postida raqam yo'q", async () => {
    tables.app_settings = [{ key: "contact_unlock_paid", value: true }];
    tables.worker_profiles = [worker("new")];
    tables.worker_listing_phones = [{ worker_id: "new", phone: "+998932728766", phone2: null, updated_at: "2026-11-21T09:00:00.5+00:00" }];
    expect(await runChannelAutopost()).toMatchObject({ posted: 1 });
    const html = (send.mock.calls[0]![0] as { html: string }).html;
    expect(html).not.toMatch(/📞|932728766/);
  });

  it("eski (24 soatdan oldingi), yopilgan, bloklangan muallifniki va kasbsiz ishchi — yuborilmaydi", async () => {
    tables.vacancies = [vacancy("old", { published_at: old }), vacancy("closed", { status: "expired" }), vacancy("bad", { owner: { is_blocked: true } })];
    tables.worker_profiles = [worker("hidden", { is_public: false }), worker("noprof", { profession: null }), worker("blocked", { owner: { is_blocked: true } })];
    expect(await runChannelAutopost()).toMatchObject({ posted: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("bir qadamda ko'pi bilan 4 ta, qolgani keyingisida", async () => {
    tables.vacancies = ["1", "2", "3", "4", "5", "6"].map((id) => vacancy(id));
    expect((await runChannelAutopost()).posted).toBe(4);
    expect((await runChannelAutopost()).posted).toBe(2);
    expect((await runChannelAutopost()).posted).toBe(0);
  });

  it("kanal darajasidagi xato (bot admin emas) — qadam to'xtaydi; keyin tuzalsa — qayta yuboriladi", async () => {
    tables.vacancies = [vacancy("a"), vacancy("b")];
    send.mockResolvedValueOnce({ ok: false, description: "Bad Request: not enough rights", channelLevel: true });
    const r = await runChannelAutopost();
    expect(r).toMatchObject({ posted: 0, failed: 1, stopped: expect.stringContaining("rights") });
    expect(send).toHaveBeenCalledTimes(1);
    // keyingi qadam: xatoli yozuv qayta urinadi, ikkinchisi ham ketadi
    const r2 = await runChannelAutopost();
    expect(r2.posted).toBe(2);
    expect(tables.channel_posts!.every((p) => p.status === "posted")).toBe(true);
    expect(tables.channel_posts!.find((p) => p.entity_id === "a")!.attempts).toBe(2);
  });

  it("vaqtinchalik xato — ko'pi bilan 3 marta urinadi", async () => {
    tables.vacancies = [vacancy("a")];
    send.mockResolvedValue({ ok: false, description: "timeout", channelLevel: false });
    for (let i = 0; i < 5; i++) await runChannelAutopost();
    expect(send).toHaveBeenCalledTimes(3);
    expect(tables.channel_posts![0]).toMatchObject({ status: "failed", attempts: 3 });
  });

  it("sozlama: vakansiyalar o'chirilgan, ishchilar — alohida kanalga", async () => {
    tables.app_settings = [{ key: "channel_autopost", value: { jobs: false, workers: true, workersChat: "https://t.me/ishchilar_kanal" } }];
    tables.vacancies = [vacancy("a")];
    tables.worker_profiles = [worker("w")];
    expect((await runChannelAutopost()).posted).toBe(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ chatId: "@ishchilar_kanal", button: { url: "https://ishuz.vercel.app/workers/w" } });
  });

  it("e'lon egasiga: \"E'loningiz joylandi\" — rasm va ilova tugmasi bilan, bir marta; bot ishga tushmagan bo'lsa — yo'q", async () => {
    tables.vacancies = [vacancy("a", { owner_profile_id: "emp" }), vacancy("b", { owner_profile_id: "quiet" })];
    tables.worker_profiles = [worker("w", { profile_id: "wrk", onboarding_completed_at: now() })];
    tables.telegram_accounts = [
      { profile_id: "emp", telegram_user_id: 111, bot_started: true, language_code: "uz" },
      { profile_id: "wrk", telegram_user_id: 222, bot_started: true, language_code: "ru" },
      { profile_id: "quiet", telegram_user_id: 333, bot_started: false, language_code: "uz" },
    ];
    tables.profiles = [{ id: "emp", locale: "uz" }, { id: "wrk", locale: null }, { id: "quiet", locale: "uz" }];
    const r = await runChannelAutopost();
    expect(r.notified).toBe(2);
    const dms = send.mock.calls.map(([x]) => x as { chatId: string; photo: string; caption: string; webApp?: boolean; button: { url: string } }).filter((x) => !x.chatId.startsWith("@"));
    expect(dms.map((d) => d.chatId).sort()).toEqual(["111", "222"]);
    const emp = dms.find((d) => d.chatId === "111")!;
    expect(emp).toMatchObject({ photo: "https://ishuz.vercel.app/api/promo/vacancy/v-a?f=post", webApp: true, button: { url: "https://ishuz.vercel.app/cabinet/elonlar" } });
    expect(emp.caption).toContain("E'loningiz joylandi");
    expect(emp.caption).toContain("Sotuvchi a");
    const wrk = dms.find((d) => d.chatId === "222")!;
    expect(wrk.photo).toBe("https://ishuz.vercel.app/api/promo/worker/w");
    expect(wrk.caption).toContain("опубликовано");
    // kanal yozuvlari bilan aralashmaydi; ikkinchi qadamda takror yo'q
    expect(tables.channel_posts!.filter((p) => String(p.chat_id).startsWith("dm:")).map((p) => p.chat_id).sort()).toEqual(["dm:111", "dm:222"]);
    send.mockClear();
    expect((await runChannelAutopost()).notified ?? 0).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("asosiy Mini App yoqilgan (TELEGRAM_MAIN_APP=1) — tugma ilovani Telegram ichida ochadi; rasm — saytdan", async () => {
    expect(channelLink("https://ishuz.vercel.app")("/jobs/v-a")).toBe("https://ishuz.vercel.app/jobs/v-a");
    env.TELEGRAM_BOT_USERNAME = "ishberuvchi_bot";
    expect(channelLink("https://ishuz.vercel.app")("/jobs/v-a")).toBe("https://ishuz.vercel.app/jobs/v-a");
    env.TELEGRAM_MAIN_APP = "1";
    expect(channelLink("https://ishuz.vercel.app")("/jobs/v-a")).toBe("https://t.me/ishberuvchi_bot?startapp=j_v-a");
    tables.vacancies = [vacancy("a")];
    await runChannelAutopost();
    expect(send.mock.calls[0]![0]).toMatchObject({ button: { text: "Ariza qoldirish", url: "https://t.me/ishberuvchi_bot?startapp=j_v-a" }, photo: "https://ishuz.vercel.app/api/promo/vacancy/v-a?f=post" });
  });
});

describe("joylangan zahoti kanalga (postListingNow)", () => {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

  it("yangi ishchi e'loni — darhol, bir marta; keyingi fon qadami takrorlamaydi", async () => {
    tables.worker_profiles = [worker("w")];
    expect(await postListingNow("worker", "w")).toMatchObject({ posted: 1 });
    expect(send.mock.calls[0]![0]).toMatchObject({ chatId: "@main", photo: "https://ishuz.vercel.app/api/promo/worker/w" });
    expect(await postListingNow("worker", "w")).toMatchObject({ posted: 0 });
    expect((await runChannelAutopost()).posted).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(tables.channel_posts).toHaveLength(1);
  });

  it("qayta joylangan e'lon — oxirgi postdan 24 soat o'tgan bo'lsa yana chiqadi (o'sha yozuv), yaqinda bo'lsa — yo'q", async () => {
    tables.worker_profiles = [worker("w"), worker("fresh")];
    tables.channel_posts = [
      { id: 1, entity_type: "worker", entity_id: "w", chat_id: "@main", status: "posted", message_id: 7, attempts: 1, created_at: hoursAgo(72), posted_at: hoursAgo(72) },
      { id: 2, entity_type: "worker", entity_id: "fresh", chat_id: "@main", status: "posted", message_id: 8, attempts: 1, created_at: hoursAgo(2), posted_at: hoursAgo(2) },
    ];
    nextId = 3;
    expect(await postListingNow("worker", "w")).toMatchObject({ posted: 1 });
    expect(await postListingNow("worker", "fresh")).toMatchObject({ posted: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(tables.channel_posts).toHaveLength(2);
    const w = tables.channel_posts!.find((r) => r.entity_id === "w")!;
    expect(w).toMatchObject({ status: "posted", message_id: 100, attempts: 1 });
    expect(String(w.posted_at) > hoursAgo(1)).toBe(true);
    // shu kunning o'zida yana joylansa — kanal to'lib ketmasin
    expect(await postListingNow("worker", "w")).toMatchObject({ posted: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("urinishlari tugab xato bilan qolgan e'lon — qayta joylanganda yana urinadi", async () => {
    tables.vacancies = [vacancy("a")];
    tables.channel_posts = [{ id: 1, entity_type: "vacancy", entity_id: "a", chat_id: "@main", status: "failed", attempts: 3, error: "timeout", created_at: hoursAgo(1), posted_at: null }];
    nextId = 2;
    expect(await postListingNow("vacancy", "a")).toMatchObject({ posted: 1 });
    expect(tables.channel_posts![0]).toMatchObject({ status: "posted", error: null });
  });

  it("ommaviy bo'lmagan e'lon (tekshiruvda, tasdiq kutmoqda) va o'chirilgan tur — hech narsa yuborilmaydi", async () => {
    tables.vacancies = [vacancy("p", { status: "pending_review" })];
    tables.worker_profiles = [worker("h", { is_public: false }), worker("w")];
    expect(await postListingNow("vacancy", "p")).toMatchObject({ posted: 0 });
    expect(await postListingNow("worker", "h")).toMatchObject({ posted: 0 });
    tables.app_settings = [{ key: "channel_autopost", value: { jobs: true, workers: false } }];
    expect(await postListingNow("worker", "w")).toMatchObject({ posted: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(tables.channel_posts ?? []).toHaveLength(0);
  });

  it("alohida kanal sozlangan bo'lsa — o'sha kanalga", async () => {
    tables.app_settings = [{ key: "channel_autopost", value: { jobsChat: "@ish_kanal" } }];
    tables.vacancies = [vacancy("a")];
    expect(await postListingNow("vacancy", "a")).toMatchObject({ posted: 1 });
    expect(send.mock.calls[0]![0]).toMatchObject({ chatId: "@ish_kanal" });
  });
});
