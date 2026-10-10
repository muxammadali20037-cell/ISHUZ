import { describe, expect, it } from "vitest";
import { PERMISSIONS, effectivePermissions, hasPermission, isPermission, rolePermissions } from "./permissions";

/** Bu matritsa supabase/migrations/0003_identity.sql dagi has_admin_permission bilan bir xil bo'lishi shart */
describe("hasPermission — has_admin_permission(perm) nusxasi", () => {
  it("super_admin hammasini qila oladi", () => {
    for (const p of PERMISSIONS) expect(hasPermission("super_admin", [], p)).toBe(true);
  });

  it("admin: moderatsiya + verifikatsiya + foydalanuvchilar, lekin settings/admins emas", () => {
    expect(hasPermission("admin", [], "users.block")).toBe(true);
    expect(hasPermission("admin", [], "users.contacts")).toBe(true);
    expect(hasPermission("admin", [], "employers.verify")).toBe(true);
    expect(hasPermission("admin", [], "categories.manage")).toBe(true);
    expect(hasPermission("admin", [], "chat.moderate")).toBe(true);
    expect(hasPermission("admin", [], "audit.view")).toBe(true);
    expect(hasPermission("admin", [], "security.view")).toBe(true);
    expect(hasPermission("admin", [], "security.manage")).toBe(true);
    expect(hasPermission("admin", [], "settings.manage")).toBe(false);
    expect(hasPermission("admin", [], "admins.manage")).toBe(false);
  });

  it("moderator: kontent moderatsiyasi, lekin bloklash/verifikatsiya/ma'lumotnoma emas", () => {
    expect(hasPermission("moderator", [], "vacancies.moderate")).toBe(true);
    expect(hasPermission("moderator", [], "reports.resolve")).toBe(true);
    expect(hasPermission("moderator", [], "reviews.moderate")).toBe(true);
    expect(hasPermission("moderator", [], "chat.moderate")).toBe(true);
    expect(hasPermission("moderator", [], "users.block")).toBe(false);
    expect(hasPermission("moderator", [], "employers.verify")).toBe(false);
    expect(hasPermission("moderator", [], "categories.manage")).toBe(false);
    expect(hasPermission("moderator", [], "audit.view")).toBe(false);
    expect(hasPermission("moderator", [], "notifications.broadcast")).toBe(false);
    expect(hasPermission("moderator", [], "security.view")).toBe(false);
  });

  it("support: faqat o'qish + hisobotlar", () => {
    expect(rolePermissions("support")).toEqual(["users.view", "workers.view", "employers.view", "vacancies.view", "reports.view", "analytics.view"]);
    expect(hasPermission("support", [], "reports.resolve")).toBe(false);
    expect(hasPermission("support", [], "vacancies.moderate")).toBe(false);
  });

  it("qo'shimcha permissions massivi rolni kengaytiradi", () => {
    expect(hasPermission("support", ["users.block"], "users.block")).toBe(true);
    expect(hasPermission("moderator", ["settings.manage"], "settings.manage")).toBe(true);
    expect(hasPermission("moderator", ["settings.manage"], "admins.manage")).toBe(false);
  });

  it("nofaol yoki admin bo'lmagan → hech narsa", () => {
    expect(hasPermission("super_admin", [], "users.view", false)).toBe(false);
    expect(hasPermission(null, ["users.view"], "users.view")).toBe(false);
    expect(hasPermission(undefined, undefined, "users.view")).toBe(false);
    expect(effectivePermissions("admin", [], false)).toEqual([]);
  });

  it("effectivePermissions rol + qo'shimchalarni birlashtiradi", () => {
    const perms = effectivePermissions("support", ["users.block"]);
    expect(perms).toContain("users.block");
    expect(perms).toContain("users.view");
    expect(perms).not.toContain("admins.manage");
    expect(effectivePermissions("super_admin", [])).toEqual([...PERMISSIONS]);
  });

  it("isPermission noma'lum kalitlarni rad etadi", () => {
    expect(isPermission("users.view")).toBe(true);
    expect(isPermission("foo.bar")).toBe(false);
  });
});
