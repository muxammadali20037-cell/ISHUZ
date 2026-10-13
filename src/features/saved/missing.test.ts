import { describe, expect, it } from "vitest";
import { isMissingRelation } from "./missing";

describe("isMissingRelation (0061 hali qo'llanmagan baza → eski jadvallar)", () => {
  it("yo'q jadval/funksiya kodlari va 404", () => {
    expect(isMissingRelation({ code: "42P01", message: 'relation "public.saved_items" does not exist' })).toBe(true);
    expect(isMissingRelation({ code: "PGRST205", message: "Could not find the table 'public.saved_items' in the schema cache" })).toBe(true);
    expect(isMissingRelation({ code: "PGRST202", message: "Could not find the function public.my_saved_vacancies" })).toBe(true);
    // ba'zi PostgREST javoblarida tana bo'sh `{}` — faqat holat kodi 404
    expect(isMissingRelation({}, 404)).toBe(true);
  });
  it("boshqa xatolar — eski yo'lga o'tilmaydi", () => {
    expect(isMissingRelation(null, 404)).toBe(false);
    expect(isMissingRelation({ code: "23505", message: "duplicate key" }, 409)).toBe(false);
    expect(isMissingRelation({ code: "42501", message: "new row violates row-level security policy" }, 403)).toBe(false);
    expect(isMissingRelation({ code: "P0001", message: "saved_limit" }, 400)).toBe(false);
  });
});
