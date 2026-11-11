import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert } from "./alert";
import { StatCard } from "./stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

describe("Alert", () => {
  it("xato va ogohlantirish — role=alert (ekran o'qigich darhol aytadi)", () => {
    expect(renderToStaticMarkup(<Alert tone="destructive" title="Saqlanmadi" />)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Alert tone="warning" title="Diqqat" />)).toContain('role="alert"');
  });
  it("ma'lumot va muvaffaqiyat — role=status", () => {
    expect(renderToStaticMarkup(<Alert title="Eslatma" />)).toContain('role="status"');
    expect(renderToStaticMarkup(<Alert tone="success" title="Saqlandi" />)).toContain('role="status"');
  });
  it("sarlavha, matn va amal chiqadi; ikonka ekran o'qigichdan yashirin", () => {
    const html = renderToStaticMarkup(
      <Alert tone="info" title="Profil to'liq emas" action={<button>{"To'ldirish"}</button>}>
        {"Tajribangizni qo'shing"}
      </Alert>,
    );
    expect(html).toContain("Profil to&#x27;liq emas");
    expect(html).toContain("Tajribangizni qo&#x27;shing");
    expect(html).toContain("<button>To&#x27;ldirish</button>");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});

describe("StatCard: faqat haqiqiy raqam", () => {
  it("son minglik ajratuvchi bilan, tabular", () => {
    const html = renderToStaticMarkup(<StatCard label="Arizalar" value={12540} />);
    expect(html).toMatch(/tabular-nums[^>]*>12[\s  ]540</);
  });
  it("noma'lum qiymat (null) — taxmin emas, tire", () => {
    const html = renderToStaticMarkup(<StatCard label="Ko'rishlar" value={null} />);
    expect(html).toContain(">—<");
    expect(html).toContain('data-value=""');
  });
  it("nol — haqiqiy qiymat, tire emas", () => {
    expect(renderToStaticMarkup(<StatCard label="Takliflar" value={0} />)).toContain(">0<");
  });
});

describe("Table", () => {
  it("tor ekranda o'z ichida suriladi; sarlavha katakchalari scope=col", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomzod</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ali</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toMatch(/^<div class="[^"]*overflow-x-auto/);
    expect(html).toContain('<th scope="col"');
  });
});
