import { describe, expect, it } from "vitest";
import {
  DRAFT_TTL_MS,
  GUEST_KEY,
  HANDOFF_TTL_MS,
  claimGuestDraft,
  clearAllDrafts,
  draftKey,
  draftKeys,
  guestId,
  ownerOf,
  purgeForeignDrafts,
  readEnvelope,
  rotateGuestId,
  sanitizeDraft,
  writeEnvelope,
  type KV,
} from "./draft-store";
import { WORKER_DRAFT_RULES, vacancyDraftRules } from "./draft-rules";
import { draftDiffers } from "./use-draft";
import { EMPTY_PLACE, type VacancyDraft, type WorkerDraft } from "./types";

class MemoryStorage implements KV {
  private m = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException("QuotaExceededError");
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  keys() {
    return Array.from(this.m.keys());
  }
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = 1_800_000_000_000;

const worker = (patch: Partial<WorkerDraft> = {}): WorkerDraft => ({
  v: 1,
  step: 1,
  profession: null,
  place: EMPTY_PLACE,
  remoteOk: false,
  firstName: "",
  lastName: "",
  phone: "+998 ",
  about: "",
  experience: null,
  salary: "",
  schedule: "",
  showPhone: false,
  ...patch,
});

function put(s: KV, key: string, owner: string, data: object, extra: { updatedAt?: number; handoffAt?: number } = {}) {
  writeEnvelope(s, key, { schema: 2, owner, updatedAt: extra.updatedAt ?? NOW, handoffAt: extra.handoffAt, data: data as Record<string, unknown> });
}

describe("qoralama egasi bo'yicha ajratiladi", () => {
  it("A hisobining qoralamasi B hisobi kalitida ko'rinmaydi", () => {
    const s = new MemoryStorage();
    put(s, draftKey("worker", null, ownerOf(A, "")), ownerOf(A, ""), worker({ firstName: "Ali", about: "maxfiy tavsif" }));
    expect(readEnvelope(s, draftKey("worker", null, ownerOf(B, "")), NOW)).toBeNull();
    expect(readEnvelope(s, draftKey("worker", null, ownerOf(A, "")), NOW)?.data.firstName).toBe("Ali");
  });

  it("boshqa egaga ko'chirib qo'yilgan konvert (kalit ≠ egasi) rad etiladi va o'chiriladi", () => {
    const s = new MemoryStorage();
    const bKey = draftKey("worker", null, ownerOf(B, ""));
    put(s, bKey, ownerOf(A, ""), worker({ firstName: "Ali" }));
    expect(readEnvelope(s, bKey, NOW)).toBeNull();
    expect(s.getItem(bKey)).toBeNull();
  });

  it("tahrirlash qoralamasi faqat o'sha vakansiya kalitida", () => {
    expect(draftKey("vacancy", A, "u:x")).not.toBe(draftKey("vacancy", B, "u:x"));
    expect(draftKey("vacancy", null, "u:x")).not.toBe(draftKey("vacancy", A, "u:x"));
  });

  it("hisob almashganda boshqa hisob va eski (egasiz v1) qoralamalar tozalanadi", () => {
    const s = new MemoryStorage();
    const g = guestId(s);
    put(s, draftKey("worker", null, ownerOf(A, "")), ownerOf(A, ""), worker());
    put(s, draftKey("vacancy", null, ownerOf(null, g)), ownerOf(null, g), {});
    s.setItem("ib_post_worker_v1", JSON.stringify(worker({ firstName: "eski" })));
    s.setItem("ib_post_vacancy_edit_x", "{}");
    const removed = purgeForeignDrafts(s, [ownerOf(B, ""), ownerOf(null, g)]);
    expect(removed).toBe(3);
    expect(draftKeys(s)).toEqual([draftKey("vacancy", null, ownerOf(null, g))]);
  });

  it("chiqishda barcha qoralamalar o'chadi va mehmon identifikatori almashadi", () => {
    const s = new MemoryStorage();
    const g1 = guestId(s);
    put(s, draftKey("worker", null, ownerOf(A, "")), ownerOf(A, ""), worker());
    put(s, draftKey("worker", null, ownerOf(null, g1)), ownerOf(null, g1), worker());
    expect(clearAllDrafts(s)).toBe(2);
    const g2 = rotateGuestId(s);
    expect(g2).not.toBe(g1);
    expect(s.getItem(GUEST_KEY)).toBe(g2);
    expect(draftKeys(s)).toEqual([]);
  });
});

describe("mehmon qoralamasini kirgan hisobga o'tkazish", () => {
  it("faqat 'joylash → kirish' belgisi (handoffAt) bilan va muddati ichida", () => {
    const s = new MemoryStorage();
    const g = guestId(s);
    const gKey = draftKey("worker", null, ownerOf(null, g));
    put(s, gKey, ownerOf(null, g), worker({ firstName: "Mehmon" }), { handoffAt: NOW - 1000 });
    const claimed = claimGuestDraft(s, "worker", ownerOf(null, g), ownerOf(A, ""), NOW);
    expect(claimed?.data.firstName).toBe("Mehmon");
    expect(s.getItem(gKey)).toBeNull();
    expect(readEnvelope(s, draftKey("worker", null, ownerOf(A, "")), NOW)?.owner).toBe(ownerOf(A, ""));
  });

  it("belgisiz yoki eskirgan mehmon qoralamasi avtomatik aralashmaydi", () => {
    const s = new MemoryStorage();
    const g = guestId(s);
    const gKey = draftKey("worker", null, ownerOf(null, g));
    put(s, gKey, ownerOf(null, g), worker({ firstName: "Begona" }));
    expect(claimGuestDraft(s, "worker", ownerOf(null, g), ownerOf(A, ""), NOW)).toBeNull();
    put(s, gKey, ownerOf(null, g), worker(), { handoffAt: NOW - HANDOFF_TTL_MS - 1 });
    expect(claimGuestDraft(s, "worker", ownerOf(null, g), ownerOf(A, ""), NOW)).toBeNull();
    expect(readEnvelope(s, draftKey("worker", null, ownerOf(A, "")), NOW)).toBeNull();
  });
});

describe("buzilgan, eskirgan va noto'g'ri qoralama formani buzmaydi", () => {
  it("buzilgan JSON, boshqa sxema, muddati o'tgan, kelajak sanasi — o'chiriladi", () => {
    const s = new MemoryStorage();
    const key = draftKey("worker", null, ownerOf(A, ""));
    const owner = ownerOf(A, "");
    for (const bad of [
      "{oops",
      JSON.stringify({ schema: 1, owner, updatedAt: NOW, data: {} }),
      JSON.stringify({ schema: 2, owner, updatedAt: NOW - DRAFT_TTL_MS - 1, data: {} }),
      JSON.stringify({ schema: 2, owner, updatedAt: NOW + 3_600_000, data: {} }),
      JSON.stringify({ schema: 2, owner, updatedAt: NOW, data: [] }),
      JSON.stringify({ schema: 2, owner, updatedAt: "kecha", data: {} }),
    ]) {
      s.setItem(key, bad);
      expect(readEnvelope(s, key, NOW)).toBeNull();
      expect(s.getItem(key)).toBeNull();
    }
  });

  it("maydonma-maydon: noto'g'ri maydon boshlang'ich qiymatda qoladi, noma'lum maydon tashlanadi", () => {
    const init = worker({ firstName: "Server" });
    const out = sanitizeDraft(
      { v: 1, step: 9, firstName: "Ali", about: 42, experience: "10y", schedule: "5_2", place: { regionId: "x" }, injected: "<script>", profession: { id: A, categoryId: B, trail: [] } },
      init,
      WORKER_DRAFT_RULES,
    );
    expect(out).not.toBeNull();
    expect(out!.firstName).toBe("Ali");
    expect(out!.step).toBe(1);
    expect(out!.about).toBe("");
    expect(out!.experience).toBeNull();
    expect(out!.schedule).toBe("5_2");
    expect(out!.place).toEqual(EMPTY_PLACE);
    expect(out!.profession).toBeNull();
    expect("injected" in out!).toBe(false);
  });

  it("boshqa versiya (v) — qoralama qabul qilinmaydi", () => {
    expect(sanitizeDraft({ v: 2, firstName: "Ali" }, worker(), WORKER_DRAFT_RULES)).toBeNull();
  });

  it("tahrirlash qoralamasi boshqa vakansiyaniki bo'lsa editId olinmaydi", () => {
    const init = { v: 1, editId: A } as unknown as VacancyDraft;
    const out = sanitizeDraft({ v: 1, editId: B }, init, vacancyDraftRules(A));
    expect(out!.editId).toBe(A);
  });

  it("xotira to'la/yopiq — yozish false qaytaradi (yolg'on 'saqlandi' yo'q)", () => {
    const s = new MemoryStorage();
    s.failWrites = true;
    expect(writeEnvelope(s, draftKey("worker", null, "u:x"), { schema: 2, owner: "u:x", updatedAt: NOW, data: {} })).toBe(false);
  });
});

describe("draftDiffers (server ma'lumoti bilan to'qnashuv)", () => {
  it("ichki obyektlar ham solishtiriladi; step e'tiborsiz", () => {
    const a = worker({ step: 3 });
    expect(draftDiffers(a, worker(), ["step"])).toBe(false);
    expect(draftDiffers(worker({ place: { ...EMPTY_PLACE, regionId: A } }), worker(), ["step"])).toBe(true);
    expect(draftDiffers(worker({ about: "yangi" }), worker(), ["step"])).toBe(true);
  });
});
