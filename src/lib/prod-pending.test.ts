import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * supabase/prod/pending.sql — ega prod bazaga BIR MARTA qo'yadigan fayl (kutayotgan barcha migratsiyalar). Migratsiya o'zgarsa
 * yoki yangisi qo'shilsa-yu fayl qayta yaratilmasa — ega eski to'plamni qo'llab qo'yadi. Shu test eskirganini ushlaydi.
 * Qo'llanishi (prod'ga o'xshash bazada, takror ishga tushirish) — scripts/prod-pending-test.sh (CI, SQL ishi).
 */
describe("supabase/prod/pending.sql", () => {
  const root = process.cwd();

  it("dolzarb: migratsiyalardan qayta yaratilganda farq yo'q", () => {
    expect(() => execFileSync("node", [join(root, "scripts/gen-prod-pending.mjs"), "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("bitta tranzaksiya, oxirida holat jadvali; psql buyruqlari yo'q (SQL Editor'da ishlaydi)", () => {
    const sql = readFileSync(join(root, "supabase/prod/pending.sql"), "utf8");
    expect(sql.match(/^begin;$/gm)).toHaveLength(1);
    expect(sql.match(/^commit;$/gm)).toHaveLength(1);
    expect(sql.indexOf("commit;")).toBeLessThan(sql.lastIndexOf("select m.migration"));
    expect(sql).not.toMatch(/^\\/m);
    expect(sql).not.toMatch(/create\s+index\s+concurrently/i);
  });
});
