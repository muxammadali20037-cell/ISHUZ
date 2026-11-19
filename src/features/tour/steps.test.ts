import { describe, expect, it } from "vitest";
import uz from "../../../messages/uz/easy.json";
import ru from "../../../messages/ru/easy.json";
import en from "../../../messages/en/easy.json";
import oz from "../../../messages/oz/easy.json";
import { TOUR_STEPS, markTourSeen, tourAudioSrc, tourSeen } from "./steps";

describe("tanishtiruv", () => {
  it("panel bo'yicha bir marta: cookie qiymati", () => {
    expect(tourSeen(null, "worker")).toBe(false);
    expect(markTourSeen(null, "worker")).toBe("w");
    expect(markTourSeen("w", "employer")).toBe("we");
    expect(markTourSeen("e", "worker")).toBe("we");
    expect(tourSeen("we", "employer")).toBe(true);
    expect(markTourSeen("junk", "employer")).toBe("e");
  });

  it("har qadamning matni 4 tilda bor; boshida va oxirida — o'rtadagi karta", () => {
    for (const steps of Object.values(TOUR_STEPS)) {
      expect(steps[0]!.target).toBeNull();
      expect(steps.at(-1)!.target).toBeNull();
      for (const s of steps) {
        for (const m of [uz, ru, en, oz]) {
          const st = (m.tour.steps as Record<string, { title: string; text: string }>)[s.code];
          expect(st?.title, s.code).toBeTruthy();
          expect(st?.text, s.code).toBeTruthy();
        }
      }
    }
  });

  it("ovoz faqat yozilganlari uchun; kirill o'zbekcha — o'zbekcha ovoz", () => {
    expect(tourAudioSrc("uz", "W1")).toBeNull();
    expect(tourAudioSrc("de", "W1")).toBeNull();
  });
});
