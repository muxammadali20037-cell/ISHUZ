import { describe, expect, it } from "vitest";
import { makeT } from "../../lib/i18n/translate";
import { renderNotification } from "./render";

const uz = makeT("uz");
const ru = makeT("ru");

describe("renderNotification", () => {
  it("application_received: moslik foizi bilan", () => {
    const r = renderNotification("application_received", { vacancy_title: "Kassir", worker_name: "Ali V.", match_score: 95 }, uz, "uz");
    expect(r.title).toBe("Yangi ariza: Kassir");
    expect(r.body).toBe("Ali V. ariza yubordi · 95% mos");
    expect(r.icon).toBe("application");
  });

  it("application_received: foizsiz", () => {
    const r = renderNotification("application_received", { vacancy_title: "Kassir", worker_name: "Ali V.", match_score: null }, uz, "uz");
    expect(r.body).toBe("Ali V. ariza yubordi");
  });

  it("application_status: holat enum orqali tarjima qilinadi", () => {
    const r = renderNotification("application_status", { vacancy_title: "Kassir", company_name: "Anor Market", status: "interview" }, uz, "uz");
    expect(r.title).toBe("Ariza holati: Suhbatga chaqirildi");
    expect(r.body).toBe("Kassir · Anor Market");
    expect(r.icon).toBe("status");
  });

  it("application_status: withdrawn → ish beruvchi matni", () => {
    const r = renderNotification("application_status", { vacancy_title: "Kassir", status: "withdrawn" }, uz, "uz");
    expect(r.title).toBe("Nomzod arizasini qaytarib oldi");
    expect(r.body).toBe("Kassir");
  });

  it("offer_received: maosh oralig'i formatlanadi", () => {
    const r = renderNotification("offer_received", { title: "Sotuvchi", company_name: "Anor Market", salary_from: 4000000, salary_to: 6000000 }, uz, "uz");
    expect(r.title).toBe("Yangi ish taklifi");
    expect(r.body).toBe("Anor Market: Sotuvchi · 4 000 000 – 6 000 000 so'm");
    expect(r.icon).toBe("offer");
  });

  it("offer_received: faqat 'dan' maosh (ru)", () => {
    const r = renderNotification("offer_received", { title: "Продавец", company_name: "Anor Market", salary_from: 4000000 }, ru, "ru");
    expect(r.body).toBe("Anor Market: Продавец · от 4 000 000 сум");
  });

  it("offer_response: accepted/declined sarlavhalari", () => {
    expect(renderNotification("offer_response", { title: "Sotuvchi", worker_name: "Ali Valiyev", status: "accepted" }, uz, "uz").title).toBe("Taklif qabul qilindi");
    const d = renderNotification("offer_response", { title: "Sotuvchi", worker_name: "Ali Valiyev", status: "declined" }, uz, "uz");
    expect(d.title).toBe("Taklif rad etildi");
    expect(d.body).toBe("Ali Valiyev · Sotuvchi");
  });

  it("new_message: preview bo'sh bo'lsa — biriktirma matni", () => {
    const withText = renderNotification("new_message", { sender_name: "Ali Valiyev", preview: "Salom!", conversation_id: "x" }, uz, "uz");
    expect(withText.title).toBe("Ali Valiyev");
    expect(withText.body).toBe("Salom!");
    const noText = renderNotification("new_message", { sender_name: "Bobur Karimov", preview: "" }, uz, "uz");
    expect(noText.body).toBe("Yangi xabar yubordi");
    expect(noText.icon).toBe("message");
  });

  it("vacancy_expiring: sana Toshkent vaqtida", () => {
    const r = renderNotification("vacancy_expiring", { vacancy_title: "Kassir", expires_at: "2026-10-03T20:30:00+00:00" }, ru, "ru");
    expect(r.title).toBe("Срок вакансии истекает");
    expect(r.body).toContain("«Kassir»");
    expect(r.body).toContain("4 октября"); // 20:30 UTC = 01:30 Toshkent (keyingi kun)
  });

  it("new_matching_vacancy / new_matching_worker", () => {
    expect(renderNotification("new_matching_vacancy", { vacancy_title: "Kassir", score: 87 }, uz, "uz").body).toBe("Moslik 87%. Batafsil ko'ring va ariza yuboring.");
    expect(renderNotification("new_matching_vacancy", { vacancy_title: "Kassir" }, uz, "uz").body).toBe("Batafsil ko'ring va ariza yuboring.");
    const w = renderNotification("new_matching_worker", { vacancy_title: "Kassir", worker_name: "Ali V.", score: 91 }, uz, "uz");
    expect(w.body).toBe("Ali V. · «Kassir» uchun 91% mos");
    expect(w.icon).toBe("match_worker");
  });

  it("verification_result: tur va izoh", () => {
    const ok = renderNotification("verification_result", { type: "company", status: "verified", note: null }, uz, "uz");
    expect(ok.title).toBe("Tasdiqlash muvaffaqiyatli o'tdi");
    expect(ok.body).toBe("Kompaniya");
    const bad = renderNotification("verification_result", { type: "tin", status: "rejected", note: "Hujjat noaniq" }, uz, "uz");
    expect(bad.title).toBe("Tasdiqlash rad etildi");
    expect(bad.body).toBe("STIR · Hujjat noaniq");
  });

  it("review_received", () => {
    const r = renderNotification("review_received", { review_id: "r1", rating: 5 }, uz, "uz");
    expect(r.body).toBe("Baho: 5 / 5");
    expect(r.icon).toBe("review");
  });

  it("system: payload sarlavhasi va tanasi; bo'lmasa — standart sarlavha", () => {
    const r = renderNotification("system", { title: "Texnik ishlar", body: "Bugun 23:00 da" }, uz, "uz");
    expect(r).toEqual({ title: "Texnik ishlar", body: "Bugun 23:00 da", icon: "system" });
    expect(renderNotification("system", {}, uz, "uz").title).toBe("Tizim xabari");
    expect(renderNotification("system", null, ru, "ru").title).toBe("Системное сообщение");
  });

  it("noto'g'ri payload turlari buzmaydi", () => {
    expect(renderNotification("application_received", "oops", uz, "uz").title).toBe("Yangi ariza: ");
    expect(renderNotification("review_received", [1, 2], uz, "uz").body).toBe("Baho:  / 5");
  });

  it("interview_invite: vaqt va joy Toshkent vaqtida", () => {
    const r = renderNotification("interview_invite", { vacancy_title: "Kassir", company_name: "Anor", interview_at: "2026-10-03T05:30:00+00:00", interview_place: "Chilonzor 5" }, uz, "uz");
    expect(r.body).toBe("Anor sizni «Kassir» bo'yicha suhbatga taklif qildi\n🗓 03.10.2026 10:30\n📍 Chilonzor 5");
    const moved = renderNotification("interview_invite", { vacancy_title: "Kassir", rescheduled: true }, ru, "ru");
    expect(moved.title).toBe("Собеседование перенесено");
  });

  it("saved_search va contact_request (system)", () => {
    expect(renderNotification("system", { kind: "saved_search", label: "Oshpaz", count: 3 }, uz, "uz").body).toBe("«Oshpaz» bo'yicha 3 ta yangi vakansiya chiqdi.");
    expect(renderNotification("system", { kind: "contact_request", name: "Kafe" }, uz, "uz").title).toBe("Telefon raqamingizni so'rashdi");
  });
});

