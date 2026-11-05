// PNG ilova belgilari va favicon.ico — public/brand/*.svg dan (avval: python3 scripts/brand/build-brand.py)
// node scripts/brand/rasterize.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const brand = (f) => path.join(root, "public/brand", f);
const icons = (f) => path.join(root, "public/icons", f);

const PRIMARY = "#1455D9";
const markSvg = await readFile(brand("ishtopdim-mark.svg"), "utf8");
const inner = markSvg.replace(/^.*?<\/title>/s, "").replace(/<\/svg>\s*$/, "");

/** belgi (oq ravoq, ko'k ✓) to'liq kvadrat fonda; `inset` — belgi egallaydigan ulush */
const square = (size, inset, { rx = 0 } = {}) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="${rx}" fill="${PRIMARY}"/>` +
      `<g transform="translate(32 33) scale(${inset}) translate(-32 -32)">${inner.replace(/fill="#1455D9"/, 'fill="#FFFFFF"').replace(/stroke="#FFFFFF"/, `stroke="${PRIMARY}"`)}</g></svg>`,
  );

const png = (buf, size, out) => sharp(buf, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);

// "any": burchaklari yumaloq plita (shaffof chet); maskable: to'liq kvadrat, belgi xavfsiz zonada (≤ 80%)
await png(square(512, 0.72, { rx: 14 }), 512, icons("icon-512.png"));
await png(square(192, 0.72, { rx: 14 }), 192, icons("icon-192.png"));
await png(square(512, 0.56), 512, icons("maskable-512.png"));
await png(square(192, 0.56), 192, icons("maskable-192.png"));
// iOS o'zi yumaloqlaydi — shaffoflik yo'q
await png(square(180, 0.66), 180, icons("apple-touch-icon.png"));
await png(Buffer.from(markSvg), 48, icons("favicon-48.png"));

// favicon.ico: 16, 32, 48 — har biri alohida chiziladi (kichrayganda xira bo'lmasin)
const sizes = [16, 32, 48];
const bufs = await Promise.all(sizes.map((s) => sharp(Buffer.from(markSvg), { density: 384 }).resize(s, s).png().toBuffer()));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s === 256 ? 0 : s, 0);
  e.writeUInt8(s === 256 ? 0 : s, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(bufs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += bufs[i].length;
  return e;
});
await writeFile(path.join(root, "src/app/favicon.ico"), Buffer.concat([header, ...entries, ...bufs]));

// ijtimoiy tarmoqlar va Telegram bot rasmi uchun: logo PNG (oq va to'q fonda)
for (const [name, bg] of [["ishtopdim-logo", "#FFFFFF"], ["ishtopdim-logo-on-dark", "#0B1736"]]) {
  const svg = await readFile(brand(`${name}.svg`));
  const img = sharp(svg, { density: 288 });
  const { width, height } = await img.metadata();
  const pad = Math.round(height * 0.6);
  await img
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
    .flatten({ background: bg })
    .png({ compressionLevel: 9 })
    .toFile(brand(`${name}.png`));
  console.log(name, width, height);
}
// standart OG rasmi (1200×630)
await sharp(await readFile(brand("og-default.svg")), { density: 144 }).resize(1200, 630).flatten({ background: "#EDF3FE" }).png({ compressionLevel: 9 }).toFile(brand("og-default.png"));
console.log("ok: icons, favicon.ico, logo png, og-default.png");
