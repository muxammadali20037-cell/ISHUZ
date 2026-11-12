// PNG ilova belgilari va favicon.ico — public/brand/ishtopdim-mark.png dan, logo PNG — public/brand/*.svg dan (avval: python3 scripts/brand/build-brand.py)
// node scripts/brand/rasterize.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const brand = (f) => path.join(root, "public/brand", f);
const icons = (f) => path.join(root, "public/icons", f);

// belgi — egasi bergan rasm (build-brand.py kesib, 512×512 qilib saqlaydi)
const MARK = brand("ishtopdim-mark.png");

/** belgi kvadrat fonda: `inset` — belgi egallaydigan ulush; `bg` bo'lmasa — shaffof */
const square = async (size, inset, bg) => {
  const inner = Math.round(size * inset);
  const m = await sharp(MARK).resize(inner, inner, { kernel: "lanczos3" }).png().toBuffer();
  const pad = Math.floor((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: m, left: pad, top: pad }])
    .png({ compressionLevel: 9 });
};

// "any": plita o'zi (shaffof chet); maskable: to'liq oq kvadrat, belgi xavfsiz zonada (≤ 80%)
await (await square(512, 1)).toFile(icons("icon-512.png"));
await (await square(192, 1)).toFile(icons("icon-192.png"));
await (await square(512, 0.74, "#FFFFFF")).toFile(icons("maskable-512.png"));
await (await square(192, 0.74, "#FFFFFF")).toFile(icons("maskable-192.png"));
// iOS o'zi yumaloqlaydi — shaffoflik yo'q (oq fon)
await (await square(180, 0.9, "#FFFFFF")).toFile(icons("apple-touch-icon.png"));
await (await square(48, 1)).toFile(icons("favicon-48.png"));

// favicon.ico: 16, 32, 48 — har biri alohida chiziladi (kichrayganda xira bo'lmasin)
const sizes = [16, 32, 48];
const bufs = await Promise.all(sizes.map((s) => sharp(MARK).resize(s, s, { kernel: "lanczos3" }).png().toBuffer()));
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
