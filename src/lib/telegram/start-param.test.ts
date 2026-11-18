import { describe, expect, it } from "vitest";
import { decodeStartParam, encodeStartParam, miniAppLink } from "./start-param";

describe("Mini App start_param", () => {
  it("vakansiya, e'lon va ishchi — qisqa kod", () => {
    expect(encodeStartParam("/jobs/oshpaz-chilonzor-x7k2")).toBe("j_oshpaz-chilonzor-x7k2");
    expect(encodeStartParam("/listing/7E2E0000-0000-4000-8000-000000000001")).toBe("l_7e2e0000000040008000000000000001");
    expect(encodeStartParam("/workers/7e2e0000-0000-4000-8000-000000000002")).toBe("w_7e2e0000000040008000000000000002");
  });

  it("aylanma: kodlangan yo'l o'zi qaytadi", () => {
    for (const p of ["/jobs/oshpaz-chilonzor-x7k2", "/listing/7e2e0000-0000-4000-8000-000000000001", "/workers/7e2e0000-0000-4000-8000-000000000002", "/ai/post", "/cabinet/elonlar", "/jobs?sort=newest"]) {
      const enc = encodeStartParam(p);
      expect(enc, p).not.toBeNull();
      expect(enc!.length).toBeLessThanOrEqual(64);
      expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeStartParam(enc)).toBe(p);
    }
  });

  it("sig'maydigan yoki xavfli yo'l — null", () => {
    expect(encodeStartParam("https://evil.example/x")).toBeNull();
    expect(encodeStartParam("//evil.example")).toBeNull();
    expect(encodeStartParam("/" + "a".repeat(80))).toBeNull();
    expect(encodeStartParam("/jobs/<script>")).toBeNull();
  });

  it("ochishda faqat ichki yo'l", () => {
    expect(decodeStartParam(null)).toBeNull();
    expect(decodeStartParam("")).toBeNull();
    expect(decodeStartParam("x_abc")).toBeNull();
    expect(decodeStartParam("l_notahexvalue")).toBeNull();
    expect(decodeStartParam("p_" + Buffer.from("//evil.example").toString("base64url"))).toBeNull();
    expect(decodeStartParam("p_" + Buffer.from("https://evil.example").toString("base64url"))).toBeNull();
    expect(decodeStartParam("p_" + Buffer.from("/ok\nx").toString("base64url"))).toBeNull();
    expect(decodeStartParam("j_a/b")).toBeNull();
  });

  it("t.me havolasi", () => {
    expect(miniAppLink("/jobs/oshpaz-x7k2", "ishberuvchi_bot")).toBe("https://t.me/ishberuvchi_bot?startapp=j_oshpaz-x7k2");
    expect(miniAppLink("/jobs/oshpaz-x7k2", "@ishberuvchi_bot")).toBe("https://t.me/ishberuvchi_bot?startapp=j_oshpaz-x7k2");
    expect(miniAppLink("/jobs/oshpaz-x7k2", null)).toBeNull();
    expect(miniAppLink("/jobs/oshpaz-x7k2", "bad name")).toBeNull();
  });
});
