import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GitHub Actions'dagi `run:` skriptlari bash sintaksisidan o'tadi (`bash -n`). Zaxira nazorati (backup-freshness) birinchi
 * kunidan "exit code 2" bilan yiqilib yurgan: "${latest:-yo'q}" ichidagi apostrof — sintaksis xatosi edi. Shu test uni ushlaydi.
 * `${{ ... }}` ifodalari Actions tomonidan almashtiriladi — tekshiruvda oddiy so'z bilan almashtiriladi.
 */
const DIR = join(process.cwd(), ".github", "workflows");

function runBlocks(yaml: string): { line: number; script: string }[] {
  const lines = yaml.split("\n");
  const out: { line: number; script: string }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const indent = m[1]!.length;
    const rest = m[2]!.trim();
    if (rest && rest !== "|" && rest !== ">") {
      out.push({ line: i + 1, script: rest });
      continue;
    }
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const l = lines[j]!;
      if (l.trim() === "") {
        body.push("");
        continue;
      }
      if (l.length - l.trimStart().length <= indent) break;
      body.push(l);
    }
    const cut = Math.min(...body.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
    out.push({ line: i + 1, script: body.map((l) => l.slice(cut)).join("\n") });
    i = j - 1;
  }
  return out;
}

describe("CI skriptlari", () => {
  const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));
  it("har bir workflow'da kamida bitta skript topildi", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(runBlocks(readFileSync(join(DIR, f), "utf8")).length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`${f}: barcha run: skriptlari bash -n dan o'tadi`, () => {
      for (const b of runBlocks(readFileSync(join(DIR, f), "utf8"))) {
        const script = b.script.replace(/\$\{\{[^}]*\}\}/g, "X");
        try {
          execFileSync("bash", ["-n"], { input: script, stdio: ["pipe", "pipe", "pipe"] });
        } catch (e) {
          const err = (e as { stderr?: Buffer }).stderr?.toString() ?? String(e);
          throw new Error(`${f}:${b.line} — bash sintaksis xatosi: ${err}`);
        }
      }
    });
  }

  it("eski xato qaytmaydi: ${x:-...} ichidagi apostrof sintaksis xatosi deb topiladi", () => {
    expect(() => execFileSync("bash", ["-n"], { input: 'echo "${a:-yo\'q}"\necho "o\'chiq"\necho "${b:-yo\'q}"\n', stdio: "pipe" })).toThrow();
  });
});
