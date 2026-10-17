import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * T · kirish oqimi (11 ekran): splash → TIL (birinchi amal) → tanishtiruv (3) → kirish usuli → rol → telefon → kod →
 * profil → "Profilingiz tayyor!" → rolning bosh sahifasi. Qaytgan foydalanuvchi, robot va to'g'ridan-to'g'ri havola —
 * oqimsiz. Stendda Telegram bot kaliti yo'q: kod yuborish/tekshirish javoblari kerak joyda test ichida beriladi, server
 * tekshiruvi esa haqiqiy endpoint'da alohida ko'rsatiladi.
 */

const host = new URL(stack.app).hostname;
const cookie = async (ctx: BrowserContext, name: string) => (await ctx.cookies()).find((c) => c.name === name)?.value;
const path = (page: Page) => new URL(page.url()).pathname;

const NEW_WORKER = "7e2e0000-0000-4000-8000-000000000071";
const NEW_EMPLOYER = "7e2e0000-0000-4000-8000-000000000072";

async function freshUser(id: string, phone: string, first: string, last: string) {
  await sql("delete from public.worker_profiles where profile_id = $1", [id]);
  await sql("delete from public.employer_profiles where profile_id = $1", [id]);
  // oldingi yugurishdan qolgan rol (profil yakunida beriladi) — yangi foydalanuvchida bo'lmaydi
  await sql("delete from public.user_roles where profile_id = $1", [id]);
  await sql(
    `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, $2, now(), jsonb_build_object('first_name', $3::text, 'last_name', $4::text))
     on conflict (id) do nothing`,
    [id, phone, first, last],
  );
  await sql("update public.profiles set active_role = null, first_name = $2, last_name = $3 where id = $1", [id, first, last]);
}

/** Oqim o'rtasida kirgan foydalanuvchi: til va tanishtiruv o'tilgan, oqim boshlangan, rol hali yo'q */
async function loginMidFlow(ctx: BrowserContext, userId: string) {
  await ctx.clearCookies();
  await loginAs(ctx, userId);
  await ctx.addCookies([{ name: "ib_entry", value: "1", domain: host, path: "/" }]);
}

test.describe("kirish oqimi", () => {
  test("yangi foydalanuvchi: avval til; ruscha tanlansa keyingi ekranlar ruscha, tanlov saqlanadi", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.waitForURL("**/start/til");
    await expect(page.getByRole("heading", { level: 1, name: "Tilni tanlang" })).toBeVisible();
    // tanlanmaguncha "Davom etish" faol emas
    await expect(page.getByRole("button", { name: "Davom etish" })).toBeDisabled();
    for (const name of ["O'zbekcha", "Ўзбекча", "Русский", "English"]) await expect(page.getByText(name, { exact: true })).toBeVisible();

    await page.getByText("Русский", { exact: true }).click();
    // ekran darhol tanlangan tilga o'tadi
    await expect(page.getByRole("heading", { level: 1, name: "Выберите язык" })).toBeVisible();
    await page.getByRole("button", { name: "Продолжить" }).click();
    await page.waitForURL("**/start/tanishtiruv");
    await expect(page.getByRole("heading", { level: 1, name: "Найти работу стало проще" })).toBeVisible();
    expect(await cookie(context, "ishuz_locale")).toBe("ru");
    // tanishtiruv faqat oxirida yoki o'tkazib yuborilganda "ko'rilgan" bo'ladi
    expect(await cookie(context, "ib_intro")).toBeUndefined();

    await page.getByRole("button", { name: "Пропустить" }).click();
    await page.waitForURL(/\/auth\?next=%2Fstart$/);
    await expect(page.getByRole("heading", { level: 1, name: "Добро пожаловать!" })).toBeVisible();
    expect(await cookie(context, "ib_intro")).toBe("1");

    // mehmon kirishga majburlanmaydi: bosh sahifa endi oqimsiz, o'sha tilda
    await page.goto("/");
    expect(path(page)).toBe("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });

  test("tanishtiruv: 3 qadam, Keyingi / Oldingi / nuqtalar / klaviatura; birinchisida orqaga — til; 'Boshlash' → kirish usuli", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/start/til");
    await page.getByText("O'zbekcha", { exact: true }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL("**/start/tanishtiruv");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText("Ish topish endi osonroq");
    await page.getByRole("link", { name: "Keyingi" }).click();
    await expect(h1).toHaveText("Ishchi topish bir joyda");
    await page.getByRole("link", { name: "Oldingi" }).first().click();
    await expect(h1).toHaveText("Ish topish endi osonroq");
    await page.keyboard.press("ArrowRight");
    await expect(h1).toHaveText("Ishchi topish bir joyda");
    await page.getByRole("link", { name: "3-qadam, jami 3" }).click();
    await expect(h1).toHaveText("AI yordamchingiz har doim yoningizda");
    // oxirgi qadamda "O'tkazib yuborish" yo'q — "Boshlash"
    await expect(page.getByRole("button", { name: "O'tkazib yuborish" })).toHaveCount(0);
    // birinchi slayddagi "orqaga" — til tanlashga
    await page.getByRole("link", { name: "1-qadam, jami 3" }).click();
    await page.getByRole("link", { name: "Oldingi" }).click();
    await page.waitForURL("**/start/til");
    await expect(page.getByTestId("lang-uz")).toBeChecked();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL("**/start/tanishtiruv");
    for (const title of ["Ishchi topish bir joyda", "AI yordamchingiz har doim yoningizda"]) {
      await page.getByRole("link", { name: "Keyingi" }).click();
      await expect(h1).toHaveText(title);
    }
    await page.getByRole("button", { name: "Boshlash" }).click();
    await page.waitForURL(/\/auth\?next=%2Fstart$/);
    expect(await cookie(context, "ib_intro")).toBe("1");
  });

  test("kirish usuli: faqat ishlaydiganlari (Google yo'q, bot sozlanmagan — Telegram ham yo'q); rol tanlanmagan bo'lsa — avval rol", async ({ page, context }) => {
    await asGuest(context);
    await context.clearCookies({ name: "ib_mode" });
    await page.goto("/auth");
    await expect(page.getByRole("heading", { level: 1, name: "Xush kelibsiz!" })).toBeVisible();
    const methods = page.getByRole("navigation", { name: "Kirish usuli" });
    await expect(methods.getByRole("link")).toHaveCount(1);
    await expect(page.getByText(/Google/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Kirmasdan e'lonlarni ko'rish" })).toHaveAttribute("href", "/");

    await methods.getByRole("link", { name: /Telefon raqam orqali kirish/ }).click();
    await page.waitForURL("**/start/rol?**");
    await expect(page.getByRole("heading", { level: 1, name: "O'z rolingizni tanlang" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Davom etish" })).toBeDisabled();
    await page.getByText("Ishchi qidiryapman", { exact: true }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL(/\/auth\/telefon\?next=%2Fstart$/);
    expect(await cookie(context, "ib_mode")).toBe("employer");
    await expect(page.getByRole("heading", { level: 1, name: "Telefon raqamingizni kiriting" })).toBeVisible();
    await expect(page.getByText("Tasdiqlash kodini Telegram orqali yuboramiz (SMS emas).")).toBeVisible();

    // rol allaqachon tanlangan qurilmada — rol ekrani qayta so'ralmaydi
    await page.goto("/auth");
    await expect(page.getByRole("link", { name: /Telefon raqam orqali kirish/ })).toHaveAttribute("href", "/auth/telefon?next=%2Fstart");
  });

  test("telefon va kod: format tekshiriladi, ikki marta yuborilmaydi; 6 katak, joylash bilan avtomatik tekshiriladi", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    let sends = 0;
    await page.route("**/api/auth/phone-code/send", async (r) => {
      sends++;
      await new Promise((ok) => setTimeout(ok, 300));
      await r.fulfill({ status: 200, json: { ok: true, ttl: 300 } });
    });
    const verifies: string[] = [];
    await page.route("**/api/auth/phone-code/verify", (r) => {
      verifies.push(r.request().postData() ?? "");
      return r.fulfill({ status: 400, json: { error: "invalid_code" } });
    });
    await page.goto("/auth/telefon");
    const phone = page.getByLabel("Telefon raqam");
    await expect(phone).toHaveValue("+998 ");
    await phone.pressSequentially("9012");
    await page.getByRole("button", { name: "Kod yuborish" }).click();
    await expect(page.getByText("Telefon raqam noto'g'ri")).toBeVisible();
    expect(sends).toBe(0);

    // foydalanuvchi maydonga bosadi: kursor qayerga bosilganidan qat'i nazar oxiriga o'tadi (prefiks oldiga raqam tushmaydi).
    // pressSequentially emas: Playwright fokusdan keyin kursorni majburan boshiga qo'yadi (haqiqiy brauzer bunday qilmaydi)
    await phone.click({ position: { x: 60, y: 20 } });
    await expect.poll(() => phone.evaluate((el: HTMLInputElement) => el.selectionStart === el.value.length)).toBe(true);
    await page.keyboard.type("34567");
    await expect(phone).toHaveValue("+998 90 123 45 67");
    await page.getByRole("button", { name: "Kod yuborish" }).dblclick();
    await expect(page.getByRole("heading", { level: 1, name: "Tasdiqlash kodini kiriting" })).toBeVisible();
    expect(sends).toBe(1);
    await expect(page.getByText(/Qayta yuborish: \d+ s/)).toBeVisible();
    await expect(page.getByText("Kod 5 daqiqa amal qiladi.")).toBeVisible();

    const code = page.getByLabel("6 xonali kod");
    await expect(code).toHaveAttribute("autocomplete", "one-time-code");
    // Telegram xabaridan nusxalangan matn — faqat raqamlar olinadi
    await code.fill("Kod: 123456");
    // 6 raqam — avtomatik tekshiriladi (bir marta), server javobi ko'rsatiladi
    await expect(page.getByRole("alert").filter({ hasText: "Kod noto'g'ri" })).toBeVisible();
    expect(verifies).toHaveLength(1);
    expect(JSON.parse(verifies[0]!)).toEqual({ phone: "+998901234567", code: "123456" });

    // raqamni o'zgartirish — raqam ekraniga qaytadi, yozilgani saqlangan
    await page.getByRole("button", { name: "Raqamni o'zgartirish" }).click();
    await expect(page.getByLabel("Telefon raqam")).toHaveValue("+998 90 123 45 67");
  });

  test("kod faqat serverda tekshiriladi: bot sozlanmagan — kod yuborilmaydi; faol kod yo'q — kirib bo'lmaydi", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/auth");
    const res = await page.evaluate(async () => {
      const post = (url: string, body: unknown) =>
        fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
      return {
        send: await post("/api/auth/phone-code/send", { phone: "+998901234567" }),
        verify: await post("/api/auth/phone-code/verify", { phone: "+998901234567", code: "000000" }),
      };
    });
    expect(res.send).toEqual({ status: 503, body: { error: "telegram_not_configured" } });
    expect(res.verify.status).toBe(400);
    expect(res.verify.body.error).toBe("code_expired");
    // sessiya ochilmadi
    expect((await context.cookies()).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(false);
  });

  test("Telegram Mini App ichida: raqam va kod so'ralmaydi — avtomatik kiradi va oqim davom etadi", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    await page.addInitScript(() => {
      const noop = () => {};
      (window as unknown as { Telegram: unknown }).Telegram = {
        WebApp: {
          initData: "query_id=AAE&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Botir%22%7D&auth_date=1760000000&hash=test",
          initDataUnsafe: { user: { id: 42, first_name: "Botir" } },
          colorScheme: "light",
          themeParams: {},
          platform: "android",
          version: "7.10",
          ready: noop,
          expand: noop,
          close: noop,
          BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
          MainButton: { show: noop, hide: noop, setText: noop, onClick: noop, offClick: noop, showProgress: noop, hideProgress: noop, enable: noop, disable: noop },
          openTelegramLink: noop,
          openLink: noop,
        },
      };
    });
    const calls: string[] = [];
    await page.route("**/api/auth/telegram", async (route) => {
      calls.push(route.request().postData() ?? "");
      await loginAs(context, USERS.workerB);
      await route.fulfill({ status: 200, json: { ok: true } });
    });
    await page.goto("/auth/telefon?next=%2Fsaved");
    await page.waitForURL("**/saved");
    expect(calls).toHaveLength(1);
    await expect(page.getByLabel("Telefon raqam")).toHaveCount(0);
  });

  test("ish izlovchi: rol → qisqa profil → 'Profilingiz tayyor!' → bosh sahifa; keyin oqim qayta ko'rsatilmaydi", async ({ page, context }) => {
    await freshUser(NEW_WORKER, "+998901110071", "Sardor", "Karimov");
    const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
    const [d] = await sql<{ id: string }>("select id from public.districts where region_id = $1 order by name_uz limit 1", [r!.id]);
    const [c] = await sql<{ id: string }>("select id from public.categories where slug = 'sales'");
    await loginMidFlow(context, NEW_WORKER);
    // oqim boshlangan, profil yo'q — bosh sahifa to'xtagan qadamga (rol) olib boradi
    await page.goto("/");
    await page.waitForURL("**/start/rol");
    await page.getByText("Ish qidiryapman", { exact: true }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL(/\/onboarding\/worker\?next=%2Fstart%2Ftayyor/);
    expect((await sql<{ active_role: string }>("select active_role from public.profiles where id = $1", [NEW_WORKER]))[0]!.active_role).toBe("worker");

    // 1–3-qadamlar (ism, joy, kasb) — mavjud wizard; bu yerda bazadan, oxirgi majburiy qadam (tajriba) — ekrandan
    await sql(
      `insert into public.worker_profiles (profile_id, headline, category_id, region_id, district_id, onboarding_step)
       values ($1, 'Sotuvchi', $2, $3, $4, 4)`,
      [NEW_WORKER, c!.id, r!.id, d!.id],
    );
    await page.goto("/onboarding/worker");
    await page.getByRole("button", { name: "1–2 yil" }).click();
    await page.getByRole("button", { name: "Tugatish" }).click();
    await page.waitForURL("**/start/tayyor");
    await expect(page.getByRole("heading", { level: 1, name: "Profilingiz tayyor!" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profilni tahrirlash" })).toHaveAttribute("href", "/profile");
    await page.getByRole("button", { name: "Bosh sahifaga o'tish" }).click();
    await page.waitForURL((u) => new URL(u).pathname === "/");
    expect(await cookie(context, "ib_entry")).toBeUndefined();

    // qaytgan foydalanuvchi: cookie'lar tozalansa ham (yangi qurilma) — til/tanishtiruvsiz, darhol bosh sahifa
    await context.clearCookies();
    await loginAs(context, NEW_WORKER);
    await page.goto("/");
    expect(path(page)).toBe("/");
    // "tayyor" ekrani faqat profil yakunidan keladi — oqim unga o'zi yo'naltirmaydi
    await page.goto("/start");
    await page.waitForURL((u) => new URL(u).pathname === "/");
  });

  test("ish beruvchi: rol → ish beruvchi profili → 'Profilingiz tayyor!' → ish beruvchi paneli", async ({ page, context }) => {
    await freshUser(NEW_EMPLOYER, "+998901110072", "Dilshod", "Rahimov");
    await loginMidFlow(context, NEW_EMPLOYER);
    await page.goto("/start/rol");
    await page.getByText("Ishchi qidiryapman", { exact: true }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL(/\/onboarding\/employer\?next=%2Fstart%2Ftayyor/);
    // ish beruvchi profili mavjud yo'l bilan yaratildi (bu yerda — bazadan), keyin oqim yakuni
    await sql(
      `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values ($1, 'person', 'Dilshod aka', now())
       on conflict (profile_id) do update set onboarding_completed_at = now()`,
      [NEW_EMPLOYER],
    );
    await page.goto("/onboarding/employer?next=%2Fstart%2Ftayyor");
    await page.waitForURL("**/start/tayyor");
    await expect(page.getByText("Kompaniyani tasdiqlash va vakansiya joylash — panelingizda.")).toBeVisible();
    await page.getByRole("button", { name: "Bosh sahifaga o'tish" }).click();
    await page.waitForURL("**/employer");
  });

  test("tugallanmagan profil: 'tayyor' ekrani ochilmaydi — oqimning kerakli qadamiga", async ({ page, context }) => {
    await freshUser(NEW_WORKER, "+998901110071", "Sardor", "Karimov");
    await loginMidFlow(context, NEW_WORKER);
    await asMode(context, "worker");
    await page.goto("/start/tayyor");
    await page.waitForURL(/\/onboarding\/worker/);
  });

  test("to'g'ridan-to'g'ri havola va robot: oqim majburlanmaydi", async ({ page, context, browser }) => {
    await context.clearCookies();
    await page.goto("/search?mode=jobs");
    expect(path(page)).toBe("/search");
    await page.goto("/help");
    expect(path(page)).toBe("/help");

    const bot = await browser.newContext({ baseURL: stack.app, userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
    const p = await bot.newPage();
    await p.goto("/");
    expect(path(p)).toBe("/");
    await expect(p.getByRole("heading", { level: 1 })).toHaveText("Nima qidiryapsiz?");
    await bot.close();
  });

  test("kirgan foydalanuvchi kirish ekranlariga kirmaydi — kelgan joyiga", async ({ page, context }) => {
    await asGuest(context);
    await loginAs(context, USERS.workerB);
    await page.goto("/auth/telefon?next=%2Fsaved");
    await page.waitForURL("**/saved");
    await page.goto("/auth?next=https%3A%2F%2Fevil.uz");
    expect(path(page)).toBe("/");
  });

  for (const width of [320, 360, 390, 430]) {
    test(`${width}px: har bir kirish ekrani sig'adi, asosiy tugma ekranda, bosish maydonlari ≥ 44px`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 700 });
      await asGuest(context);
      await asMode(context, "worker");
      const screens = ["/start/til", "/start/tanishtiruv", "/auth", "/start/rol", "/auth/telefon"];
      for (const url of screens) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${url} gorizontal siljish`).toBeLessThanOrEqual(0);
        const cta = page.locator("main, form").getByRole("button").or(page.getByRole("navigation", { name: "Kirish usuli" }).getByRole("link")).last();
        const box = await cta.boundingBox();
        expect(box, `${url} asosiy tugma`).not.toBeNull();
        expect(box!.y + box!.height, `${url} tugma ekranda`).toBeLessThanOrEqual(700 + 1);
        const small = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("main a, main button, main label, form a, form button")]
            .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0)
            .filter((el) => el.closest("p") === null && !(el instanceof HTMLLabelElement && el.htmlFor))
            .map((el) => ({ t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) }))
            .filter((x) => x.h < 44),
        );
        expect(small, `${url} kichik bosish maydonlari`).toEqual([]);
      }
    });
  }
});

test.describe("admin: kirish ekranlari rasmlari", () => {
  test.beforeEach(async () => {
    await sql(
      `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
       on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
      [USERS.workerB],
    );
  });
  test.afterEach(async () => {
    await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
  });

  test("rasm yuklanadi (qayta kodlanadi, metama'lumotsiz), tanishtiruvda darhol ko'rinadi, audit yoziladi; olib tashlansa — o'rnatilgan tasvir", async ({ page, context, browser }) => {
    test.setTimeout(120_000);
    const sharp = (await import("sharp")).default;
    const fs = await import("node:fs");
    const nodePath = await import("node:path");
    await loginAs(context, USERS.workerB, "aal2");
    await page.goto("/admin/entry");
    await expect(page.getByRole("heading", { level: 1, name: "Kirish ekranlari" })).toBeVisible();
    const slot = page.getByTestId("entry-slot-intro_jobs");
    await expect(slot.getByText("O'rnatilgan tasvir", { exact: true })).toBeVisible();
    const photo = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 30, g: 110, b: 210 } } })
      .jpeg()
      .withExif({ IFD0: { Artist: "Fotograf uy manzili" } })
      .toBuffer();
    await expect(async () => {
      const chooser = page.waitForEvent("filechooser", { timeout: 2000 }).catch(() => null);
      await slot.getByRole("button", { name: "Rasm yuklash" }).click();
      const c = await chooser;
      if (!c) throw new Error("fayl tanlash oynasi ochilmadi");
      await c.setFiles({ name: "intro.jpg", mimeType: "image/jpeg", buffer: photo });
    }).toPass({ timeout: 15_000 });
    const preview = slot.locator("img");
    await expect(preview).toHaveAttribute("src", /\/site-media\/entry\/v-[0-9a-f]{64}\.webp$/, { timeout: 15_000 });
    await expect(slot.getByText("O'rnatilgan tasvir", { exact: true })).toHaveCount(0);
    const file = (await preview.getAttribute("src"))!.split("/site-media/")[1]!;
    const meta = await sharp(fs.readFileSync(nodePath.join(__dirname, "../.stack/storage/site-media", file))).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(1600);
    const [audit] = await sql<{ n: string }>("select count(*) as n from public.audit_logs where action = 'settings.update' and target_id = 'entry_media'");
    expect(Number(audit!.n)).toBeGreaterThan(0);

    // mehmon tanishtiruvda shu rasmni ko'radi
    const guest = await browser.newContext({ baseURL: stack.app });
    await asGuest(guest);
    const g = await guest.newPage();
    await g.goto("/start/tanishtiruv");
    await expect(g.locator("main, form").locator(`img[src$="${file.split("/").pop()}"]`)).toBeVisible();

    // olib tashlash — o'rnatilgan tasvirga qaytadi
    await slot.getByRole("button", { name: "O'rnatilgan tasvirga qaytish" }).click();
    await expect(slot.getByText("O'rnatilgan tasvir", { exact: true })).toBeVisible();
    await g.reload();
    await expect(g.locator(`img[src*="/site-media/entry/"]`)).toHaveCount(0);
    await guest.close();
  });
});
