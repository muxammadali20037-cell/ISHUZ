import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SalaryParts } from "./salary-text";

const nowrap = (s: string) => `<span class="whitespace-nowrap">${s}</span>`;
const suffix = (s: string) => `<span class="font-normal text-muted-foreground">${s}</span>`;

describe("maosh matni tor kartada qayerdan bo'linadi", () => {
  it("raqam guruhlari va 'valyuta/davr' yaxlit: '10 | 000 000' yoki 'сум/ | мес' bo'lmaydi", () => {
    const html = renderToStaticMarkup(<SalaryParts text="6 000 000 – 10 000 000 сум" suffix="/мес" />);
    expect(html).toBe(`${nowrap("6 000 000")} – ${nowrap("10 000 000")} <span class="whitespace-nowrap">сум${suffix("/мес")}</span>`);
  });

  it("'kamida …' (faqat boshlang'ich maosh) — so'z oldida, raqam va birlik yaxlit", () => {
    const html = renderToStaticMarkup(<SalaryParts text="kamida 4 000 000 so'm" suffix="/oy" />);
    expect(html).toBe(`kamida ${nowrap("4 000 000")} <span class="whitespace-nowrap">so&#x27;m${suffix("/oy")}</span>`);
  });

  it("davr qo'shimchasi bo'lmasa (kelishiladi) — matn o'zgarishsiz", () => {
    expect(renderToStaticMarkup(<SalaryParts text="Kelishiladi" suffix="" />)).toBe("Kelishiladi");
  });

  it("matndagi belgilar o'zgarmaydi (qidiruv va testlar uchun textContent bir xil)", () => {
    const html = renderToStaticMarkup(<SalaryParts text="5 000 000 – 7 000 000 so'm" suffix="/oy" />);
    expect(html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'")).toBe("5 000 000 – 7 000 000 so'm/oy");
  });
});
