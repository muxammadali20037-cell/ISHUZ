"""
"Ish topdim" brend fayllari (2026-11-05, egasi bergan belgi): python3 scripts/brand/build-brand.py && node scripts/brand/rasterize.mjs

Belgi — egasi bergan rasm (oq plita ichida ko'k odam va yuqoriga strelka), o'zgartirilmaydi:
  scripts/brand/source/ishtopdim-mark-original.png (1254×1254, qora fonda) — yagona manba.
Skript plita atrofidagi qora fonni shaffof qiladi va plitani kvadrat qilib kesadi.

Natija:
  public/brand/ishtopdim-mark.png            — belgi (512×512, shaffof fon)
  src/assets/brand/ishtopdim-mark.png        — xuddi shu belgi, saytdagi komponent uchun (next/image)
  public/brand/ishtopdim-logo.svg            — gorizontal logo (belgi + "Ish topdim")
  public/brand/ishtopdim-logo-on-dark.svg    — gorizontal, to'q fon uchun
  public/brand/ishtopdim-logo-stacked.svg    — asosiy (tik) logo
  public/brand/og-default.svg                — ijtimoiy tarmoqlar uchun standart rasm
Yozuv Geist SemiBold konturlari (fontTools) — fayl shriftsiz ham bir xil ko'rinadi; belgi SVG ichiga PNG qilib joylanadi.
PNG, ilova belgilari va favicon.ico — scripts/brand/rasterize.mjs (sharp).
"""
from __future__ import annotations

import base64
import io
import os

from PIL import Image
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

SOURCE = os.path.join(ROOT, "scripts/brand/source/ishtopdim-mark-original.png")
# egasi bergan rasm: oq plita qora fonda (1254×1254, shaffoflik yo'q). Plita markazi ≈ (627, 625):
# kvadrat kesim — yarim tomoni 580 px (plita 1139×1148 px, chetida 1–2% bo'sh joy qoladi)
CROP = (47, 45, 1207, 1205)


def mark_image() -> Image.Image:
    """Plita atrofidagi qora fonni shaffof qiladi (rasmning o'zi — plita va ichidagi belgi — o'zgarmaydi).
    Fon = chetdan boshlanib tutashgan qora piksellar; plita chegarasidagi silliqlash piksellari oq rangda, shaffofligi yorqinligidan."""
    import numpy as np
    from scipy import ndimage

    rgb = np.asarray(Image.open(SOURCE).convert("RGB")).astype(np.float32)
    lum = rgb.mean(axis=2)
    dark = lum < 40
    lab, _ = ndimage.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    edge = ndimage.binary_dilation(bg, iterations=4) & ~bg
    alpha = np.where(bg, 0.0, 255.0)
    alpha[edge] = np.clip(lum[edge] / 250.0, 0, 1) * 255.0
    out = rgb.copy()
    out[edge] = 255.0  # chegara — oq plita qirrasi
    rgba = np.dstack([out, alpha]).round().astype(np.uint8)
    return Image.fromarray(rgba, "RGBA").crop(CROP)


_MARK_URI: str | None = None


def mark(*_: str) -> str:
    """Belgi 64×64 birlikli kvadratda (SVG ichida PNG; 256 px — logo fayllari uchun yetarli)."""
    global _MARK_URI
    if _MARK_URI is None:
        buf = io.BytesIO()
        mark_image().resize((256, 256), Image.LANCZOS).save(buf, "PNG", optimize=True)
        _MARK_URI = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return f'<image width="64" height="64" href="{_MARK_URI}"/>'


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
        f'<g transform="translate(850 150) scale(4.6)">{mark()}</g>'
        f'<g transform="translate(80 72)">{logo_inner}</g>'
        f'<g transform="translate(80 268)">{l1}</g><g transform="translate(80 356)">{l2}</g><g transform="translate(80 444)">{l3}</g>'
        f'<g transform="translate(82 530)">{sub}</g>'
    )
    return svg(w, h, body, "Ish topdim")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    m = mark_image()
    m.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "ishtopdim-mark.png"), optimize=True)
    os.makedirs(os.path.join(ROOT, "src/assets/brand"), exist_ok=True)
    m.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, "src/assets/brand/ishtopdim-mark.png"), optimize=True)
    # eski vektor belgilar ("Darvoza") — endi ishlatilmaydi
    for old in ("ishtopdim-mark.svg", "ishtopdim-mark-on-dark.svg", "ishtopdim-app-icon.svg"):
        if os.path.exists(os.path.join(OUT, old)):
            os.remove(os.path.join(OUT, old))
    if os.path.exists(os.path.join(ROOT, "public/icon.svg")):
        os.remove(os.path.join(ROOT, "public/icon.svg"))
    files = {
        "ishtopdim-logo.svg": horizontal(INK, PRIMARY, PRIMARY, "#FFFFFF"),
        "ishtopdim-logo-on-dark.svg": horizontal("#FFFFFF", ON_DARK_ACCENT, "#FFFFFF", PRIMARY),
        "ishtopdim-logo-stacked.svg": stacked(),
        "og-default.svg": og_card(),
    }
    for name, content in files.items():
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(content)
    print("ok:", ", ".join(files))


if __name__ == "__main__":
    main()
