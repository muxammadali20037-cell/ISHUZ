import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * "+ E'lon joylash" → Yordamchi (ega, 2026-11-17): "men o'qituvchiman" deb yozadi (yoki "uqituvchi", "oqtvchi") → kerak bo'lsa
 * "Aynan qanday o'qituvchisiz?" variantlari → oyna (kasb, ism, hudud, tajriba, telefon — oylik maosh yo'q) → "Tasdiqlash" →
 * "Sizning e'loningiz shunday ko'rinadi" → "Joylash" → avtomatik tekshiruv → "Tabriklaymiz". Boshqa mavzuda oyna chiqmaydi.
 * Telefon (ega, 2026-11-17): har doim qo'lda yoziladi va majburiy (hisob raqami oldindan qo'yilmaydi), "+ Yana raqam" — ikkinchisi;
 * e'londa shu raqam(lar) ko'rinadi, hisob raqami emas (0081).
 */

test.use({ serviceWorkers: "block" });

test.afterEach(async () => {
  await sql("delete from public.worker_listing_phones where worker_id in (select id from public.worker_profiles where profile_id = $1)", [USERS.workerB]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("update public.profiles set first_name = 'Botir', last_name = 'Boboyev' where id = $1", [USERS.workerB]);
});

async function say(page: Page, text: string) {
  await expect(page.locator("[data-ai-post] form[data-hydrated]")).toBeVisible();
  await page.locator("#ai-post-text").fill(text);
  await page.locator("#ai-post-text").press("Enter");
}

test("mehmon (telefon): bosh sahifa (chat) → «e'lon bermoqchiman» → yordamchi → «men o'qituvchiman» → variant → oyna → ko'rinishi → kirish → joylandi", async ({ page, context }) => {
  test.setTimeout(120_000);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await asMode(context, "worker");
  await asGuest(context);
  await page.setViewportSize({ width: 390, height: 844 });

  // 2026-11-21: bosh sahifa — chat; "e'lon bermoqchiman" deb yozilsa — "E'lon tayyorlash" tugmasi
  await page.goto("/");
  const box = page.locator("form[data-hydrated] #start-chat-text");
  await box.fill("O'zim haqimda e'lon bermoqchiman");
  await box.press("Enter");
  await page.locator("[data-guided-post-to='worker']").click();
  await page.waitForURL(/\/ai\/post$/);
  await expect(page.getByRole("heading", { level: 1, name: "E'lon joylash" })).toBeVisible();
  await expect(page.locator("[data-ai-post-greeting]")).toContainText("Qanday ish qilasiz?");

  // "men o'qituvchiman" — O'qituvchi guruhi: aynan qaysi biri so'raladi (Loyiha menejeri yoki Avtoinstruktor emas)
  await say(page, "men o'qituvchiman");
  const options = page.locator("[data-ai-post-options]");
  await expect(options).toBeVisible();
  await expect(options.getByRole("heading", { name: "Aynan qanday o'qituvchisiz?" })).toBeVisible();
  await expect(options.locator("[data-ai-post-option]", { hasText: "Ingliz tili o'qituvchisi" })).toBeVisible();
  await expect(options).not.toContainText("Avtoinstruktor");
  await expect(options).not.toContainText("Loyiha menejeri");
  await options.locator("[data-ai-post-option]", { hasText: "Matematika o'qituvchisi" }).click();

  // oyna: kasb tanlangan; oylik maosh yo'q; telefon so'raladi
  const form = page.locator("[data-ai-post-form]");
  await expect(form).toBeVisible();
  await expect(form.locator("[data-ai-post-profession]")).toContainText("Matematika o'qituvchisi");
  await expect(form).not.toContainText(/maosh/i);
  // majburiy javoblarsiz — tushunarli xatolar
  await page.locator("[data-ai-post-confirm]").click();
  await expect(form.getByText("Ismingizni yozing.")).toBeVisible();
  await expect(form.getByText("Hududni tanlang.")).toBeVisible();
  await expect(form.getByText("Tajribangizni tanlang.")).toBeVisible();
  // telefon majburiy
  await expect(form.locator("[data-ai-post-phones]").getByText("Telefon raqamini to'liq yozing.")).toBeVisible();

  await form.locator("[data-ai-post-first-name]").fill("Botir");
  await form.locator("[data-ai-post-region]").selectOption({ label: "Toshkent shahri" });
  await form.locator("[data-exp='1_3']").click();
  await form.locator("#phone").fill("901234567");
  // "+ Yana raqam" — ikkinchi raqam (chala yozilsa — xato; olib tashlash mumkin)
  await form.locator("[data-ai-post-add-phone]").click();
  await form.locator("#phone2").fill("93555");
  await page.locator("[data-ai-post-confirm]").click();
  await expect(form.locator("[data-ai-post-phone2]").getByText("Telefon raqamini to'liq yozing.")).toBeVisible();
  await form.locator("#phone2").fill("935551122");
  await page.locator("[data-ai-post-confirm]").click();

  // "Sizning e'loningiz shunday ko'rinadi" — joylanadigan matnning o'zi (faqat aytilganlardan)
  const preview = page.locator("[data-ai-post-preview]");
  await expect(preview.getByRole("heading", { name: "Sizning e'loningiz shunday ko'rinadi" })).toBeVisible();
  const card = preview.locator("[data-ai-post-card]");
  await expect(card).toContainText("Matematika o'qituvchisi");
  await expect(card).toContainText("Botir");
  await expect(card).toContainText("Toshkent shahri");
  await expect(card.locator("[data-ai-post-about]")).toHaveText("Matematika o'qituvchisi sifatida ish qidiryapman. Tajribam — 1–3 yil. Hudud: Toshkent shahri.");
  // ekranda telefon raqami ko'rsatilmaydi (faqat "ko'rinadi" degan yozuv)
  await expect(card).not.toContainText("90 123");
  await expect(card).not.toContainText("93 555");
  await expect(card.locator("[data-ai-post-preview-phones]")).toHaveText("Siz yozgan ikkala raqam e'londa va Telegram kanalda ko'rinadi — ish beruvchilar qo'ng'iroq qiladi");

  // mehmon "Joylash" → telefon bilan kirish (SMS) → shu yerga qaytadi
  await page.locator("[data-ai-post-publish]").click();
  await page.waitForURL(/\/auth\/telefon\?/);
  const back = new URL(page.url()).searchParams.get("next");
  expect(back).toBe("/ai/post?resume=1");
  expect(new URL(page.url()).searchParams.get("phone")).toBe("+998901234567");

  await loginAs(context, USERS.workerB);
  await page.goto(back!);
  // qaytgach — o'sha e'lon ko'rinishi darhol ochiladi; "Joylash" → avtomatik tekshiruv → "Tabriklaymiz"
  await expect(page.locator("[data-ai-post-preview] [data-ai-post-about]")).toHaveText("Matematika o'qituvchisi sifatida ish qidiryapman. Tajribam — 1–3 yil. Hudud: Toshkent shahri.");
  await page.locator("[data-ai-post-publish]").click();
  await expect(page.getByRole("heading", { level: 1, name: "Tabriklaymiz! E'loningiz joylandi" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-ai-post-notify]")).toContainText("Sizga mos ish chiqsa, ilovada xabar beramiz.");
  await expect(page.locator("[data-ai-post-notify]").getByRole("button", { name: /xabar bering/i })).toBeVisible();

  const [w] = await sql<{ name: string; about: string; experience_level: string; salary: number | null; is_public: boolean }>(
    `select n.name_uz as name, w.about, w.experience_level::text as experience_level, p.salary_expected as salary, w.is_public
       from public.worker_profiles w join public.profession_nodes n on n.id = w.profession_node_id
       left join public.worker_preferences p on p.worker_id = w.id
      where w.profile_id = $1`,
    [USERS.workerB],
  );
  expect(w?.name).toBe("Matematika o'qituvchisi");
  expect(w?.about).toBe("Matematika o'qituvchisi sifatida ish qidiryapman. Tajribam — 1–3 yil. Hudud: Toshkent shahri.");
  expect(w?.salary).toBeNull();
  expect(w?.is_public).toBe(true);
  // e'londa — qo'lda yozilgan ikkala raqam
  const [lp] = await sql<{ phone: string; phone2: string | null }>(
    "select phone, phone2 from public.worker_listing_phones where worker_id = (select id from public.worker_profiles where profile_id = $1)",
    [USERS.workerB],
  );
  expect(lp).toEqual({ phone: "+998901234567", phone2: "+998935551122" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("boshqa mavzu — oyna chiqmaydi; «oqtvchi» (imlo xatosi) → o'qituvchi variantlari; «ish kerak» → oyna, kasb yozib topiladi", async ({ page, context }) => {
  await asMode(context, "worker");
  await loginAs(context, USERS.workerB);
  await page.goto("/ai/post");

  await say(page, "salom");
  await expect(page.locator("[data-ai-post-reply]").last()).toContainText("E'lon joylashda yordam beraman");
  await say(page, "bugun havo zo'r");
  await expect(page.locator("[data-ai-post-reply]").last()).toContainText("Kasbingizni tushunmadim");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await say(page, "oqtvchi");
  const options = page.locator("[data-ai-post-options]");
  await expect(options.getByRole("heading", { name: "Aynan qanday o'qituvchisiz?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // "ish kerak" — kasb aytilmagan: oyna ochiladi, kasb unda yoziladi ("uqituvchi" → variantlar → tanlash → oyna)
  await say(page, "ish kerak");
  const form = page.locator("[data-ai-post-form]");
  await expect(form).toBeVisible();
  // kirgan foydalanuvchi: ism hisobdan; telefon esa oldindan qo'yilmaydi — qo'lda yoziladi
  await expect(form.locator("[data-ai-post-first-name]")).toHaveValue("Botir");
  await expect(form.locator("#phone")).toHaveValue("+998 ");
  await expect(form.getByText("Tasdiqlangan")).toHaveCount(0);
  await form.locator("[data-ai-post-profession-input]").fill("uqituvchi");
  await form.locator("[data-ai-post-find]").click();
  await options.locator("[data-ai-post-option]", { hasText: "Ingliz tili o'qituvchisi" }).click();
  await expect(form.locator("[data-ai-post-profession]")).toContainText("Ingliz tili o'qituvchisi");
});

test("kirgan (kompyuter): «haydovchiman, Samarqand» → oyna darhol (kasb va hudud tushunilgan) → ko'rinishi → joylandi", async ({ page, context }) => {
  test.setTimeout(90_000);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await asMode(context, "worker");
  await loginAs(context, USERS.workerB);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/post");

  await say(page, "men haydovchiman, Samarqand");
  const form = page.locator("[data-ai-post-form]");
  await expect(form).toBeVisible();
  await expect(page.locator("[data-ai-post-options]")).toHaveCount(0);
  await expect(form.locator("[data-ai-post-profession]")).toContainText(/haydovchi/i);
  await expect(form.locator("[data-ai-post-region] option:checked")).toHaveText("Samarqand");
  await form.locator("[data-exp='3plus']").click();
  // hisobida tasdiqlangan raqam bo'lsa ham — raqam yozilmasa e'lon berilmaydi
  await expect(form.locator("#phone")).toHaveValue("+998 ");
  await page.locator("[data-ai-post-confirm]").click();
  await expect(form.getByText("Telefon raqamini to'liq yozing.")).toBeVisible();
  await expect(page.locator("[data-ai-post-preview]")).toHaveCount(0);
  await form.locator("#phone").fill("97 444 55 66");
  await page.locator("[data-ai-post-confirm]").click();
  await expect(page.locator("[data-ai-post-preview] [data-ai-post-about]")).toContainText("Tajribam — 3 yildan ko'p. Hudud: Samarqand.");
  await expect(page.locator("[data-ai-post-preview-phones]")).toHaveText("Siz yozgan raqam e'londa va Telegram kanalda ko'rinadi — ish beruvchilar shu raqamga qo'ng'iroq qiladi");
  // "O'zgartirish" — oynaga qaytadi, javoblar saqlangan
  await page.locator("[data-ai-post-edit]").click();
  await expect(form.locator("[data-exp='3plus']")).toHaveAttribute("aria-checked", "true");
  await page.locator("[data-ai-post-confirm]").click();
  await page.locator("[data-ai-post-publish]").click();
  await expect(page.getByRole("heading", { level: 1, name: "Tabriklaymiz! E'loningiz joylandi" })).toBeVisible({ timeout: 30_000 });
  const view = page.getByRole("link", { name: "E'lonimni ko'rish" });
  await expect(view).toHaveAttribute("href", /^\/listing\//);
  const href = (await view.getAttribute("href"))!;

  // e'londa — qo'lda yozilgan raqam (hisob raqami emas); hisob raqami va uning sozlamasi o'zgarmadi
  const [acc] = await sql<{ phone: string | null; vis: string }>("select phone, phone_visibility::text as vis from public.profile_contacts where profile_id = $1", [USERS.workerB]);
  const [lp] = await sql<{ phone: string; phone2: string | null }>("select phone, phone2 from public.worker_listing_phones where worker_id = (select id from public.worker_profiles where profile_id = $1)", [USERS.workerB]);
  expect(lp).toEqual({ phone: "+998974445566", phone2: null });
  expect(acc?.phone).not.toBe("+998974445566");
  await page.goto(href);
  await expect(page.locator("[data-listing-own-phones]")).toContainText("+998 97 444 55 66");
  // ega (2026-11-19): raqam ustiga bosilsa — qo'ng'iroq
  await expect(page.locator("[data-listing-own-phones] a[data-tel]")).toHaveAttribute("href", "tel:+998974445566");

  // boshqa kirgan foydalanuvchi (ish beruvchi) e'londa shu raqamni ko'radi
  await loginAs(context, USERS.employer);
  await page.goto(href);
  const contact = page.locator("#contact");
  await expect(contact).toContainText("+998 97 444 55 66");
  if (acc?.phone) await expect(contact).not.toContainText(acc.phone.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "+998 $1 $2 $3 $4"));
  await expect(contact.locator("[data-listing-phone2]")).toHaveCount(0);
});

test("ish qidirish (Yordamchi): «salom» — oyna emas, qisqa javob", async ({ page, context }) => {
  await asMode(context, "worker");
  await asGuest(context);
  await page.goto("/ai");
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.locator("#ai-ws-text").fill("salom");
  await page.locator("#ai-ws-text").press("Enter");
  await expect(page.locator("[data-quick-reply]")).toContainText("Qanday ish qidiryapsiz?");
  await expect(page.locator("[data-quick-sheet]")).toHaveCount(0);
});
