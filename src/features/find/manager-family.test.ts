import { describe, expect, it } from "vitest";
import { chooseManager, fixManagerTypo, fixManagerTypos, isManagerWord, mentionsManager, onlyManagerWords, POPULAR_MANAGERS, type ManagerNode } from "./manager-family";
import { professionCandidates } from "./intent";

const node = (slug: string, name_uz: string, name_ru: string, name_en: string | null = null, aliases: string[] = []): ManagerNode => ({ id: slug, slug, name_uz, name_ru, name_en, aliases });

// bazadagi haqiqiy nomlardan bir qismi (kasblar daraxti)
const NODES: ManagerNode[] = [
  node("culture-event-manager", "Tadbir tashkilotchisi (event menejer)", "Организатор мероприятий (ивент-менеджер)", "Event manager", ["event", "ивент", "organizator"]),
  node("sales-sales-manager", "Savdo menejeri", "Менеджер по продажам", "Sales manager", ["менеджер по продажам", "sotuv menejeri", "prodajnik"]),
  node("sales-wholesale-manager", "Ulgurji savdo menejeri", "Менеджер оптовых продаж", "Wholesale manager"),
  node("sales-regional-sales-manager", "Hududiy savdo menejeri", "Региональный менеджер по продажам", "Regional sales manager"),
  node("office-office-manager", "Ofis menejeri", "Офис-менеджер", "Office manager"),
  node("office-hr-manager", "HR menejer", "HR-менеджер", "HR manager", ["hr", "эйчар", "kadrlar"]),
  node("office-employer-branding-manager", "HR brend menejeri", "Менеджер по HR-бренду", "Employer branding manager"),
  node("restaurant-restaurant-manager", "Restoran menejeri", "Менеджер ресторана", "Restaurant manager"),
  node("restaurant-banquet-manager", "Banket menejeri", "Банкетный менеджер", "Banquet manager"),
  node("cleaning-company-manager", "Tozalash kompaniyasi menejeri", "Менеджер клининговой компании", "Cleaning company manager", ["klining menejer"]),
  node("sales-account-manager", "Mijozlar bilan ishlash menejeri", "Менеджер по работе с клиентами", "Account manager"),
  node("finance-corporate-relationship-manager", "Korporativ mijozlar menejeri", "Менеджер по работе с корпоративными клиентами", "Corporate relationship manager"),
  node("office-project-manager", "Loyiha menejeri", "Проектный менеджер", "Project manager"),
  node("it-project-manager", "Project Manager", "Проджект-менеджер", "Project manager", ["pm"]),
  node("marketing-smm-manager", "SMM menejer", "SMM-менеджер", "SMM manager"),
  node("hotel-hotel-manager", "Mehmonxona menejeri", "Менеджер гостиницы", "Hotel manager"),
  node("hotel-sales-manager", "Mehmonxona savdo menejeri", "Менеджер по продажам гостиничных услуг", "Hotel sales manager"),
];

/** Gap → kasb so'zlari (professionFrom / resolveFindQuery kabi: bitta so'zlilari) */
const said = (text: string) => professionCandidates(text).filter((c) => !c.includes(" "));
const choose = (text: string) => chooseManager(NODES, said(text));

describe("menejer so'zi va imlo shakllari", () => {
  it.each(["menejer", "meneger", "menedjer", "menedzher", "menajer", "manejer", "manager", "menejerman", "menegerlar", "menejeri", "menedjerlikka"])("%s — menejer", (w) => {
    expect(isManagerWord(w)).toBe(true);
  });
  it.each(["menejment", "menedjment", "mening", "menga", "marketolog", "meneg", "mexanik"])("%s — menejer emas", (w) => {
    expect(isManagerWord(w)).toBe(false);
  });
  it("imlo shakli tuzatiladi, to'g'risi o'zgarmaydi", () => {
    expect(fixManagerTypo("meneger")).toBe("menejer");
    expect(fixManagerTypo("menedjerman")).toBe("menejerman");
    expect(fixManagerTypo("menejeri")).toBe("menejeri");
    expect(fixManagerTypo("manager")).toBe("manager");
    expect(fixManagerTypo("oshpaz")).toBe("oshpaz");
    expect(fixManagerTypos("Savdo Meneger kerak")).toBe("Savdo menejer kerak");
    expect(fixManagerTypos("Менеджер нужен")).toBe("Менеджер нужен");
  });
  it("kasb qidiruvi bo'laklarida 'meneger' → 'menejer'", () => {
    expect(professionCandidates("meneger kerak")).toEqual(["menejer"]);
    expect(professionCandidates("менеджер нужен")).toContain("menejer");
  });
  it("gapda menejer aytilganmi", () => {
    expect(mentionsManager("Bizga menejer kerak")).toBe(true);
    expect(mentionsManager("Нужен менеджер")).toBe(true);
    expect(mentionsManager("meneger")).toBe(true);
    expect(mentionsManager("Oshpaz kerak")).toBe(false);
    expect(onlyManagerWords("menejer")).toBe(true);
    expect(onlyManagerWords("менеджер")).toBe(true);
    expect(onlyManagerWords("savdo menejeri")).toBe(false);
  });
});

describe("qaysi menejer", () => {
  it("faqat 'menejer' — taxmin yo'q, ko'p so'raladiganlari birinchi (event menejer emas)", () => {
    for (const text of ["menejer kerak", "meneger kerak", "Нужен менеджер", "manager kerak", "menejerman"]) {
      const r = choose(text);
      expect(r.pick, text).toBeNull();
      expect(r.ordered.map((n) => n.slug).slice(0, 6), text).toEqual([
        "sales-sales-manager",
        "office-office-manager",
        "office-hr-manager",
        "office-project-manager",
        "marketing-smm-manager",
        "restaurant-restaurant-manager",
      ]);
      expect(r.ordered).toHaveLength(NODES.length);
    }
  });
  it.each([
    ["savdo menejeri kerak", "sales-sales-manager"],
    ["savdo meneger kerak", "sales-sales-manager"],
    ["sotuv menejeri kerak", "sales-sales-manager"],
    ["менеджер по продажам", "sales-sales-manager"],
    ["restoranga menejer kerak", "restaurant-restaurant-manager"],
    ["HR menejer kerak", "office-hr-manager"],
    ["ofis menejeri", "office-office-manager"],
    ["event menejer kerak", "culture-event-manager"],
    ["SMM manager kerak", "marketing-smm-manager"],
    ["Toshkentda ulgurji savdo menejeri kerak", "sales-wholesale-manager"],
  ])("%s → %s", (text, slug) => {
    expect(choose(text).pick?.slug).toBe(slug);
  });
  it("qisman mos — tanlanmaydi, mos kelganlari ro'yxat boshida", () => {
    // "kompaniyaga menejer" — "Tozalash kompaniyasi menejeri" deb taxmin qilinmaydi
    const r = choose("kompaniyaga menejer kerak");
    expect(r.pick).toBeNull();
    expect(r.ordered[0]!.slug).toBe("cleaning-company-manager");
    // "mijozlar menejeri" — "Mijozlar bilan ishlash menejeri" (bog'lovchi so'zlar hisobga olinmaydi); "korporativ" aytilmagan
    expect(choose("mijozlar menejeri").pick?.slug).toBe("sales-account-manager");
    // "savdo" — bir nechta savdo menejeri; "Savdo menejeri" (nomining hammasi aytilgan) tanlanadi, qolganlari ro'yxatda keyin
    const s = choose("savdo menejer");
    expect(s.pick?.slug).toBe("sales-sales-manager");
    expect(s.ordered[0]!.slug).toBe("sales-sales-manager");
    expect(s.ordered.slice(1, 4).map((n) => n.slug).sort()).toEqual(["hotel-sales-manager", "sales-regional-sales-manager", "sales-wholesale-manager"]);
  });
  it("bir xil nomli ikki kasb ('project manager') — ikkalasi variant", () => {
    const r = choose("project manager kerak");
    expect(r.pick).toBeNull();
    expect(r.ordered.slice(0, 2).map((n) => n.slug).sort()).toEqual(["it-project-manager", "office-project-manager"]);
  });
  it("ko'p so'raladiganlar ro'yxati — 12 ta, takrorsiz", () => {
    expect(POPULAR_MANAGERS).toHaveLength(12);
    expect(new Set(POPULAR_MANAGERS).size).toBe(12);
  });
});
