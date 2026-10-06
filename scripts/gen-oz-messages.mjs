// messages/uz/*.json (lotin) → messages/oz/*.json (o'zbek kirill). Ishga tushirish: node scripts/gen-oz-messages.mjs
// Qo'lda tuzatilgan tarjimalar messages/oz-overrides.json da (kalit: "namespace.path") — ular ustun.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { latinToCyrillic } = await jiti.import("../src/lib/i18n/translit.ts");

const overrides = existsSync("messages/oz-overrides.json") ? JSON.parse(readFileSync("messages/oz-overrides.json", "utf8")) : {};
mkdirSync("messages/oz", { recursive: true });

function walk(node, path) {
  if (typeof node === "string") return overrides[path] ?? latinToCyrillic(node);
  if (Array.isArray(node)) return node.map((v, i) => walk(v, `${path}.${i}`));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, path ? `${path}.${k}` : k);
    return out;
  }
  return node;
}

for (const f of readdirSync("messages/uz").filter((f) => f.endsWith(".json"))) {
  const ns = f.replace(/\.json$/, "");
  const src = JSON.parse(readFileSync(`messages/uz/${f}`, "utf8"));
  writeFileSync(`messages/oz/${f}`, JSON.stringify(walk(src, ns), null, 2) + "\n");
}
console.log("oz messages generated");
