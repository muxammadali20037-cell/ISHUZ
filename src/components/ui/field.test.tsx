import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./label";
import { Input, Textarea } from "./input";

describe("Field: xato va izoh maydonga bog'lanadi", () => {
  it("xato matni id oladi, maydon aria-describedby va aria-invalid bilan unga ishora qiladi", () => {
    const html = renderToStaticMarkup(
      <Field label="Telefon" htmlFor="phone" error="Raqam to'liq emas">
        <Input id="phone" />
      </Field>,
    );
    expect(html).toContain('id="phone-error"');
    expect(html).toMatch(/<input[^>]*aria-describedby="phone-error"/);
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
  });

  it("izoh (xatosiz) ham bog'lanadi, lekin maydon noto'g'ri deb belgilanmaydi", () => {
    const html = renderToStaticMarkup(
      <Field label="Haqingizda" htmlFor="about" description="Qisqacha">
        <Textarea id="about" aria-describedby="counter" />
      </Field>,
    );
    expect(html).toContain('id="about-desc"');
    expect(html).toMatch(/<textarea[^>]*aria-describedby="counter about-desc"/);
    expect(html).not.toContain("aria-invalid");
  });

  it("boshqa komponent (masalan, maxsus tanlagich) o'zgartirilmaydi", () => {
    const Custom = (props: { id: string }) => <div data-custom={props.id} />;
    const html = renderToStaticMarkup(
      <Field label="Kasb" htmlFor="prof" error="Tanlang">
        <Custom id="prof" />
      </Field>,
    );
    expect(html).toContain('data-custom="prof"');
    expect(html).not.toContain("aria-describedby");
  });
});
