import type { Page } from "@playwright/test";

/**
 * Sahifadagi "ustma-ust" kamchiliklarni topadi (brauzer ichida o'lchanadi):
 *  - covered — yozuvning o'zi (harf qutilari) boshqa element (belgi, tugma, panel) ostida qolgan: elementFromPoint yozuv
 *    nuqtasida begona elementni qaytaradi;
 *  - text-overlap — ikki xil yozuv bir-birining ustiga tushgan (qatorlar kesishgan);
 *  - icon-overlap — belgi (svg, rasm) begona yozuv ustida yoki ostida (kesishuv ≥ 20%);
 *  - clipped — yozuv konteyneridan chiqib qirqilgan ("…" bilan emas);
 *  - offscreen — yozuv ekran chetidan chiqib ketgan.
 * Butun sahifa bir ekranda bo'lishi uchun chaqiruvchi viewport balandligini sahifa balandligiga tenglaydi (fullHeight) —
 * shunda yopishqoq sarlavha va pastki menyu faqat o'z joyini egallaydi (sahifa ular ostidan o'tmaydi).
 * Ataylab: sr-only, aria-hidden bezaklar, animatsiya o'chiq (reduced-motion) holat.
 */
export interface LayoutIssue {
  kind: "covered" | "text-overlap" | "icon-overlap" | "clipped" | "offscreen";
  text: string;
  other?: string;
  box: { x: number; y: number; w: number; h: number };
}

export async function fullHeight(page: Page) {
  const vp = page.viewportSize()!;
  const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  if (h > vp.height) await page.setViewportSize({ width: vp.width, height: Math.min(h, 24000) });
  await page.waitForTimeout(150);
}

export async function findLayoutIssues(page: Page, scope = "body"): Promise<LayoutIssue[]> {
  return page.evaluate((scopeSel) => {
    const root = document.querySelector(scopeSel) ?? document.body;
    const issues: LayoutIssue[] = [];
    const vw = document.documentElement.clientWidth;
    const label = (el: Element | null): string => {
      if (!el) return "";
      const he = el as HTMLElement;
      const name = (he.getAttribute?.("aria-label") || he.innerText || el.getAttribute("class") || el.tagName).toString().trim().replace(/\s+/g, " ").slice(0, 50);
      return `${el.tagName.toLowerCase()}「${name}」`;
    };
    const hidden = (el: Element): boolean => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return true;
        if (n.classList.contains("sr-only") || n.getAttribute("aria-hidden") === "true") return true;
        if (n.tagName === "DIALOG" && !(n as HTMLDialogElement).open) return true;
        // yopiq <details> ichidagi (summary'dan tashqari) mazmun chizilmaydi
        if (n.parentElement?.tagName === "DETAILS" && !(n.parentElement as HTMLDetailsElement).open && n.tagName !== "SUMMARY") return true;
      }
      return false;
    };
    const related = (a: Element, b: Element) => a === b || a.contains(b) || b.contains(a);
    const area = (r: { left: number; right: number; top: number; bottom: number }) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
    const inter = (a: DOMRect, b: DOMRect) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });

    // yozuvni qirqib turgan ota-bobolar (overflow ≠ visible, o'zi ham): ko'rinmas qatorlar (line-clamp, truncate) hisobga olinmaydi
    const clipBox = (el: Element): DOMRect | null => {
      let box: { left: number; top: number; right: number; bottom: number } | null = null;
      for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const r = n.getBoundingClientRect();
        box = box ? { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }
      return box ? new DOMRect(box.left, box.top, Math.max(0, box.right - box.left), Math.max(0, box.bottom - box.top)) : null;
    };
    // "butun karta bosiladi" naqshi: havolaning ::after qatlami yoki bo'sh shaffof havola kartani qoplaydi — yozuvni to'smaydi
    // (bu holatda havolaning o'z ko'rinadigan matni yozuv bilan kesishsa — "text-overlap" baribir ushlaydi)
    const clear = (c: string) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
    const stretchedOverlay = (hit: Element): boolean => {
      const after = getComputedStyle(hit, "::after");
      if (after.content !== "none" && after.position === "absolute" && clear(after.backgroundColor)) return true;
      const cs = getComputedStyle(hit);
      const ownText = Array.from(hit.childNodes).some((c) => c.nodeType === 3 && (c.textContent?.trim().length ?? 0) > 0);
      return (cs.position === "absolute" || cs.position === "fixed") && clear(cs.backgroundColor) && !ownText && (hit as HTMLElement).innerText.trim() === "";
    };

    // yozuv qatorlari (harf qutilari) — elementning o'z matn tugunlaridan
    type Line = { el: Element; rect: DOMRect; text: string };
    const lines: Line[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim() ?? "";
      if (text.length < 2) continue;
      const el = n.parentElement;
      if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "OPTION", "TITLE"].includes(el.tagName) || hidden(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const clip = clipBox(el);
      for (const raw of Array.from(range.getClientRects())) {
        // qirqilgan qism (… dan keyingi matn, line-clamp dan keyingi qatorlar) — ko'rinmaydi, faqat ko'rinadigan bo'lagi
        const r = clip ? new DOMRect(Math.max(raw.left, clip.left), Math.max(raw.top, clip.top), Math.min(raw.right, clip.right) - Math.max(raw.left, clip.left), Math.min(raw.bottom, clip.bottom) - Math.max(raw.top, clip.top)) : raw;
        if (r.width > 3 && r.height > raw.height * 0.6) lines.push({ el, rect: r, text: text.slice(0, 40) });
      }
    }

    const seen = new Set<string>();
    const push = (i: LayoutIssue) => {
      const k = `${i.kind}|${i.text}|${i.other ?? ""}`;
      if (seen.has(k)) return;
      seen.add(k);
      issues.push(i);
    };
    const box = (r: DOMRect) => ({ x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) });

    for (const { el, rect, text } of lines) {
      // 1) yozuv nuqtalarida kim eng ustida
      const cy = rect.top + rect.height / 2;
      const pts: [number, number][] = [
        [rect.left + rect.width / 2, cy],
        [rect.left + Math.min(6, rect.width / 4), cy],
        [rect.right - Math.min(6, rect.width / 4), cy],
      ];
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        if (!hit || related(hit, el) || stretchedOverlay(hit)) continue;
        // yozuv shaffof/pointer-events:none qatlam ostida (masalan, label ichidagi matn) — begona emas
        if (getComputedStyle(hit).pointerEvents === "none") continue;
        push({ kind: "covered", text: `${label(el)} "${text}"`, other: label(hit), box: box(rect) });
        break;
      }
      // 2) ekrandan chiqib ketgan
      if (rect.right > vw + 1 || rect.left < -1) push({ kind: "offscreen", text: `${label(el)} "${text}"`, box: box(rect) });
    }

    // 3) ikki xil yozuv qatori kesishgan
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i]!, b = lines[j]!;
        if (related(a.el, b.el)) continue;
        const r = inter(a.rect, b.rect);
        // qo'shni qatorlar 1–2 px tegishi mumkin — sezilarli kesishuv: ikkala yo'nalishda ≥ 3 px
        if (r.right - r.left >= 3 && r.bottom - r.top >= 3) push({ kind: "text-overlap", text: `${label(a.el)} "${a.text}"`, other: `${label(b.el)} "${b.text}"`, box: box(a.rect) });
      }
    }

    // 4) belgilar (svg, rasm) begona yozuv bilan kesishgan (belgi plitasi yozuvni to'ssa — 1-tekshiruv "covered" ushlaydi)
    const icons = Array.from(root.querySelectorAll("svg, img, .entry-live")).filter((e) => !hidden(e) && !e.closest("svg svg"));
    for (const ic of icons) {
      const ir = ic.getBoundingClientRect();
      if (ir.width < 6 || ir.height < 6) continue;
      for (const { el, rect, text } of lines) {
        if (related(ic, el) || el.contains(ic) || ic.parentElement === el) continue;
        const r = inter(ir, rect);
        const a = area(r);
        if (a > 0 && a >= 0.2 * Math.min(area(ir), area(rect))) push({ kind: "icon-overlap", text: `${label(el)} "${text}"`, other: label(ic), box: box(rect) });
      }
    }

    // 5) qirqilgan yozuv: overflow yashirin, "…" yo'q, mazmun sig'magan
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
      if (hidden(el) || !el.childNodes.length) continue;
      const own = Array.from(el.childNodes).some((c) => c.nodeType === 3 && (c.textContent?.trim().length ?? 0) > 1);
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none") continue;
      const clipsX = cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 2;
      const clipsY = cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 2 && !["auto", "scroll"].includes(cs.overflowY);
      if (clipsX || clipsY) push({ kind: "clipped", text: label(el), box: box(el.getBoundingClientRect()) });
    }
    return issues;
  }, scope);
}

/** Topilgan joylarni sahifada qizil ramka bilan belgilash (skrinshot uchun) */
export async function markIssues(page: Page, issues: LayoutIssue[]) {
  await page.evaluate((list) => {
    for (const i of list) {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:${i.box.x - 2}px;top:${i.box.y - 2}px;width:${i.box.w + 4}px;height:${i.box.h + 4}px;outline:3px solid #ff0040;z-index:2147483647;pointer-events:none`;
      document.body.appendChild(d);
    }
  }, issues);
}

/**
 * Telefonning "katta shrift" sozlamasi (Android WebView / Telegram textZoom): faqat yozuv kattalashadi, qutilar (padding, belgi,
 * tugma balandligi) o'zgarmaydi. Har elementning hisoblangan shrift o'lchami `factor` ga ko'paytiriladi.
 */
export async function zoomText(page: Page, factor: number) {
  await page.evaluate((f) => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("body, body *"));
    const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
    els.forEach((el, i) => el.style.setProperty("font-size", `${(sizes[i]! * f).toFixed(2)}px`, "important"));
  }, factor);
  await page.waitForTimeout(150);
}
