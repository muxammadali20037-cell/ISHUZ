"""
"Ish topdim" brend fayllari (2026-11, "Darvoza" belgisi): python3 scripts/brand/build-brand.py && node scripts/brand/rasterize.mjs

Belgi: yuqori uchi o'tkir ravoq (O'zbekiston peshtoqlari) — "imkoniyat darvozasi"; ichida oq belgi (✓) — "topdim".
Sodda geometriya (64 birlikli kvadrat): 16 px da ham o'qiladi, gradient va soya yo'q.

Natija:
  public/brand/ishtopdim-mark.svg            — belgi (ko'k ravoq, oq ✓), shaffof fon
  public/brand/ishtopdim-mark-on-dark.svg    — to'q fon uchun (oq ravoq, ko'k ✓)
  public/brand/ishtopdim-app-icon.svg        — ilova belgisi (ko'k plita, oq ravoq)
  public/brand/ishtopdim-logo.svg            — gorizontal logo (belgi + "Ish topdim")
  public/brand/ishtopdim-logo-on-dark.svg    — gorizontal, to'q fon uchun
  public/brand/ishtopdim-logo-stacked.svg    — asosiy (tik) logo
  public/icon.svg                            — favicon (SVG)
Yozuv Geist SemiBold konturlari (fontTools) — fayl shriftsiz ham bir xil ko'rinadi.
PNG va favicon.ico — scripts/brand/rasterize.mjs (sharp).

Komponent (src/components/shared/brand-mark.tsx) xuddi shu ARCH / CHECK geometriyasini ishlatadi — o'zgartirsangiz, ikkalasini ham.
"""
from __future__ import annotations

import os

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT = os.path.join(ROOT, "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")
OUT = os.path.join(ROOT, "public/brand")

# Brend ranglari (docs/BRAND_UI_GUIDE.md, globals.css bilan bir xil)
PRIMARY = "#1455D9"
BRIGHT = "#3478F6"
INK = "#101828"
NAVY = "#0B1736"
ON_DARK_ACCENT = "#8FB4FF"

ARCH = "M9 59Q9 61 11 61H53Q55 61 55 59V31C55 19.5 45.5 10.5 32 3C18.5 10.5 9 19.5 9 31Z"
CHECK = "M21 42L29.5 50.5L44 33"
CHECK_W = 6.5


def mark(arch: str, check: str) -> str:
    return (
        f'<path d="{ARCH}" fill="{arch}"/>'
        f'<path d="{CHECK}" fill="none" stroke="{check}" stroke-width="{CHECK_W}" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def tile(bg: str = PRIMARY, scale: float = 0.72) -> str:
    # ilova belgisi: plita ichida oq ravoq va ko'k ✓ (optik markaz biroz pastda)
    return (
        f'<rect width="64" height="64" rx="14" fill="{bg}"/>'
        f'<g transform="translate(32 33) scale({scale}) translate(-32 -32)">{mark("#FFFFFF", bg)}</g>'
    )


def text_paths(parts: list[tuple[str, str]], size: float, tracking_em: float = -0.02) -> tuple[str, float, float, float]:
    """Matn → SVG konturlari. Qaytaradi: (svg, eni, ascender, descender) — birliklar px (size bo'yicha)."""
    font = TTFont(FONT)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    hmtx = font["hmtx"]
    os2 = font["OS/2"]
    k = size / upm
    x = 0.0
    out = []
    for text, color in parts:
        d = []
        for ch in text:
            gname = cmap.get(ord(ch))
            if gname is None:
                continue
            pen = SVGPathPen(gs)
            # y yuqoriga → SVG pastga: aks ettirish; baseline = 0
            tp = TransformPen(pen, (k, 0, 0, -k, x, 0))
            gs[gname].draw(tp)
            if pen.getCommands():
                d.append(pen.getCommands())
            x += hmtx[gname][0] * k + tracking_em * size
        if d:
            out.append(f'<path fill="{color}" d="{" ".join(d)}"/>')
    width = x - tracking_em * size
    return "".join(out), width, os2.sTypoAscender * k, -os2.sTypoDescender * k


def svg(w: float, h: float, body: str, title: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def horizontal(ink: str, accent: str, arch: str, check: str) -> str:
    size = 40.0  # yozuv kegli; belgi 56 px
    words, tw, asc, _ = text_paths([("Ish ", ink), ("topdim", accent)], size)
    mark_h = 56.0
    gap = 12.0
    # x-balandlik markazi belgi markaziga to'g'ri kelsin
    cap = 0.72 * size
    baseline = mark_h / 2 + cap / 2 - 1
    body = f'<g transform="scale({mark_h / 64})">{mark(arch, check)}</g><g transform="translate({mark_h + gap:.2f} {baseline:.2f})">{words}</g>'
    return svg(mark_h + gap + tw, mark_h, body, "Ish topdim")


def stacked() -> str:
    size = 44.0
    words, tw, asc, desc = text_paths([("Ish ", INK), ("topdim", PRIMARY)], size)
    m = 96.0
    w = max(tw, m)
    body = (
        f'<g transform="translate({(w - m) / 2:.2f} 0) scale({m / 64})">{mark(PRIMARY, "#FFFFFF")}</g>'
        f'<g transform="translate({(w - tw) / 2:.2f} {m + 16 + 0.74 * size:.2f})">{words}</g>'
    )
    return svg(w, m + 16 + 0.74 * size + 10, body, "Ish topdim")


def og_card() -> str:
    """Ijtimoiy tarmoqlar uchun standart rasm (1200×630): logo, shior va katta belgi. Sahifa o'z rasmini bermasa — shu."""
    w, h = 1200, 630
    logo = horizontal(INK, PRIMARY, PRIMARY, "#FFFFFF")
    logo_inner = logo[logo.index("</title>") + 8 : logo.rindex("</svg>")]
    l1, _, _, _ = text_paths([("Ish toping.", INK)], 76)
    l2, _, _, _ = text_paths([("Yoki jamoangizga", PRIMARY)], 76)
    l3, _, _, _ = text_paths([("odam toping.", PRIMARY)], 76)
    sub, _, _, _ = text_paths([("Vakansiyalar va ishchilar — butun O'zbekiston bo'ylab", "#636C81")], 30, 0)
    body = (
        f'<rect width="{w}" height="{h}" fill="#EDF3FE"/>'
        f'<g transform="translate(860 150) scale(4.4)" opacity="0.98">{mark(PRIMARY, "#FFFFFF")}</g>'
        f'<g transform="translate(80 72)">{logo_inner}</g>'
        f'<g transform="translate(80 268)">{l1}</g><g transform="translate(80 356)">{l2}</g><g transform="translate(80 444)">{l3}</g>'
        f'<g transform="translate(82 530)">{sub}</g>'
    )
    return svg(w, h, body, "Ish topdim")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    files = {
        "ishtopdim-mark.svg": svg(64, 64, mark(PRIMARY, "#FFFFFF"), "Ish topdim"),
        "ishtopdim-mark-on-dark.svg": svg(64, 64, mark("#FFFFFF", PRIMARY), "Ish topdim"),
        "ishtopdim-app-icon.svg": svg(64, 64, tile(), "Ish topdim"),
        "ishtopdim-logo.svg": horizontal(INK, PRIMARY, PRIMARY, "#FFFFFF"),
        "ishtopdim-logo-on-dark.svg": horizontal("#FFFFFF", ON_DARK_ACCENT, "#FFFFFF", PRIMARY),
        "ishtopdim-logo-stacked.svg": stacked(),
        "og-default.svg": og_card(),
    }
    for name, content in files.items():
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(content)
    # favicon (SVG): faqat belgi — kichik o'lchamda eng aniq
    with open(os.path.join(ROOT, "public/icon.svg"), "w", encoding="utf-8") as f:
        f.write(files["ishtopdim-mark.svg"])
    print("ok:", ", ".join(files))


if __name__ == "__main__":
    main()
