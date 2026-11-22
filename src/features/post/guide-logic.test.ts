import { describe, expect, it } from "vitest";
import { composeDescription, guideProgress, nextGuideStep, type GuideStep } from "./guide-logic";
import { EMPTY_PLACE, type VacancyDraft } from "./types";

const base = {
  profession: null,
  custom: null,
  place: EMPTY_PLACE,
  salaryFrom: "",
  salaryTo: "",
  negotiable: false,
  schedule: "" as const,
  employerType: null,
  orgName: "",
  phone: "+998 ",
  description: "",
} satisfies Partial<VacancyDraft>;

const prof = { id: "p", categoryId: "c", trail: [{ id: "p", name_uz: "Oshpaz", name_ru: "Повар", name_en: "Cook" }] };
const none = new Set<GuideStep>();

describe("AI bilan oson joylash: savollar tartibi", () => {
  it("bo'sh qoralama — avval kasb, keyin joy, tuman, maosh", () => {
    expect(nextGuideStep(base, none)).toBe("profession");
    expect(nextGuideStep({ ...base, profession: prof }, none)).toBe("region");
    expect(nextGuideStep({ ...base, profession: prof, place: { regionId: "r", districtId: null, districtChosen: false, remote: false } }, none)).toBe("district");
    expect(nextGuideStep({ ...base, profession: prof, place: { regionId: "r", districtId: "d", districtChosen: true, remote: false } }, none)).toBe("salary");
  });

  it("gapda aytilgani qayta so'ralmaydi: kasb, tuman, maosh, grafik bor → tajriba", () => {
    const d = { ...base, profession: prof, place: { regionId: "r", districtId: "d", districtChosen: true, remote: false }, salaryFrom: "5000000", schedule: "2_2" as const };
    expect(nextGuideStep(d, none)).toBe("experience");
  });

  it("masofaviy ish — tuman so'ralmaydi", () => {
    const d = { ...base, profession: prof, place: { regionId: null, districtId: null, districtChosen: true, remote: true } };
    expect(nextGuideStep(d, none)).toBe("salary");
  });

  it("«Farqi yo'q» va «Kelishiladi» ham javob", () => {
    const d = { ...base, profession: prof, place: { regionId: "r", districtId: null, districtChosen: true, remote: false }, negotiable: true };
    expect(nextGuideStep(d, none)).toBe("schedule");
    expect(nextGuideStep(d, new Set<GuideStep>(["schedule"]))).toBe("experience");
  });

  it("profildan ma'lum ish beruvchi turi, nomi va telefon so'ralmaydi; oxirida izoh (ixtiyoriy), e'lon matni, keyin tayyor", () => {
    const d = {
      ...base,
      profession: prof,
      place: { regionId: "r", districtId: null, districtChosen: true, remote: false },
      salaryFrom: "4000000",
      employerType: "company" as const,
      orgName: "Gulnora kafe",
      phone: "+998 90 123 45 67",
    };
    // 2026-11-22: e'lon matnidan oldin — "Qo'shimcha izoh bormi?" ("Izohsiz" ham javob)
    expect(nextGuideStep(d, new Set<GuideStep>(["schedule", "experience"]))).toBe("notes");
    const asked = new Set<GuideStep>(["schedule", "experience", "notes"]);
    expect(nextGuideStep(d, asked)).toBe("description");
    expect(nextGuideStep({ ...d, description: "Oshpaz kerak. Ish joyi: Toshkent." }, new Set<GuideStep>([...asked, "description"]))).toBeNull();
    // matn qisqa bo'lsa — tayyor emas
    expect(nextGuideStep({ ...d, description: "kerak" }, new Set<GuideStep>([...asked, "description"]))).toBe("description");
  });

  it("noto'g'ri telefon — telefon so'raladi", () => {
    const d = { ...base, profession: prof, place: { regionId: "r", districtId: null, districtChosen: true, remote: false }, negotiable: true, employerType: "person" as const, orgName: "Aziz", phone: "+998 90 12" };
    expect(nextGuideStep(d, new Set<GuideStep>(["schedule", "experience"]))).toBe("phone");
  });

  it("jarayon ko'rsatkichi javoblar soniga qarab o'sadi", () => {
    expect(guideProgress(base, none)).toEqual({ done: 0, total: 11 });
    expect(guideProgress({ ...base, profession: prof, negotiable: true }, none).done).toBe(2);
  });
});

describe("AI yo'q bo'lsa — e'lon matni javoblardan", () => {
  it("o'z gapi + tanlangan faktlar; hech narsa qo'shilmaydi", () => {
    expect(
      composeDescription({ sentence: "chilonzordagi kafemizga oshpaz kerak, ovqat bilan", need: "Oshpaz kerak.", place: "Ish joyi: Toshkent shahri · Chilonzor.", schedule: null, experience: "Tajriba shart emas." }),
    ).toBe("Chilonzordagi kafemizga oshpaz kerak, ovqat bilan.\nIsh joyi: Toshkent shahri · Chilonzor.\nTajriba shart emas.");
  });

  it("gap juda qisqa (bosilgan misol) — \"Oshpaz kerak.\" bilan boshlanadi", () => {
    expect(composeDescription({ sentence: "Oshpaz kerak", need: "Oshpaz kerak.", place: null, schedule: "Ish vaqti: 2/2.", experience: null })).toBe("Oshpaz kerak.\nIsh vaqti: 2/2.");
  });
});
