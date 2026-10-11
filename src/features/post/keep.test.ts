import { describe, expect, it } from "vitest";
import { keptWorkerFields, type ExistingWorker } from "./keep";

const NODE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const existing: ExistingWorker = {
  profession_node_id: NODE,
  custom_profession: null,
  headline: "Bosh buxgalter, 1C mutaxassisi",
  experience_level: "2_3y",
  remote_preference: "any",
  schedules: ["5_2", "shift"],
};
const choice = { professionNodeId: NODE, customText: null, headline: "Buxgalter", experience: "1_3" as const, schedule: "5_2" as const, remoteOk: true };

describe("qisqa forma batafsil profilni buzmaydi", () => {
  it("hech narsa o'zgarmasa: aniq tajriba, sarlavha, jadvallar va 'any' saqlanadi", () => {
    expect(keptWorkerFields(existing, choice)).toEqual({ experience_level: "2_3y", headline: "Bosh buxgalter, 1C mutaxassisi", schedule: null, remote_preference: "any" });
  });

  it("foydalanuvchi o'zgartirgan maydon yangilanadi", () => {
    const out = keptWorkerFields(existing, { ...choice, professionNodeId: OTHER, experience: "3plus", schedule: "2_2", remoteOk: false });
    expect(out).toEqual({ experience_level: "3_5y", headline: "Buxgalter", schedule: "2_2", remote_preference: null });
  });

  it("5+ yil tajriba '3+' guruhida qoladi (3–5 ga tushmaydi)", () => {
    expect(keptWorkerFields({ ...existing, experience_level: "5y_plus" }, { ...choice, experience: "3plus" }).experience_level).toBe("5y_plus");
  });

  it("custom kasb o'zgarmasa sarlavha saqlanadi; yangi ishchi — forma qiymatlari", () => {
    const custom = { ...existing, profession_node_id: null, custom_profession: "Prava o'qituvchisi", headline: "Avtoinstruktor (B, C)" };
    expect(keptWorkerFields(custom, { ...choice, professionNodeId: null, customText: "Prava o'qituvchisi" }).headline).toBe("Avtoinstruktor (B, C)");
    expect(keptWorkerFields(null, choice)).toEqual({ experience_level: "1_2y", headline: "Buxgalter", schedule: "5_2", remote_preference: null });
  });
});
