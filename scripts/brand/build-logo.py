"""
Logo fayllarini manba rasmdan yasaydi (egasi bergan logotip, 2026-10): python3 scripts/brand/build-logo.py

Manba: scripts/brand/logo-source.png (1254×1254, oq fonda ko'k: yozuv #0052F3, odamlar to'qroq ko'k).
Natija (public/brand, public/icons, src/app/favicon.ico, public/icon.svg):
  - logo-text.webp, logo-figures.webp — shaffof qatlamlar (yozuv va qo'l berib so'rashayotgan odamlar alohida):
    BrandLogo komponenti odamlar qatlamini SVG filtri bilan "qo'l siqish" harakatiga keltiradi;
  - handshake-map.png — o'sha harakat uchun siljish xaritasi (faqat qo'llar va bilaklar oralig'i, gavda va yozuv qimirlamaydi);
  - icon-192/512, maskable-192/512, apple-touch-icon — to'liq logo oq fonda; favicon — faqat odamlar (kichikda yozuv o'qilmaydi).
Koordinatalar manba rasm piksellarida (BrandLogo ham shu 1254 birlikli viewBox'da ishlaydi).
"""
from __future__ import annotations

import base64
import io
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "scripts/brand/logo-source.png")
OUT = os.path.join(ROOT, "public/brand")
ICONS = os.path.join(ROOT, "public/icons")
SIZE = 1254

# yozuv (#0052F3) ko'ki to'q odamlarnikidan ancha yorqin: rangsizlantirilgan "ko'k" kanali bo'yicha ajratiladi
TEXT_BLUE_MIN = 222
# figuralar (mark) va to'liq logo chegaralari — manba piksellarida
MARK_BOX = (575, 180, 1205, 790)  # odamlar
FULL_BOX = (58, 170, 1212, 1004)  # butun logo (yozuv + odamlar), atrofida ozgina bo'sh joy

# qo'l siqish: faqat x bo'yicha shu oraliqda qimirlaydi (ishchi bilagi → qo'llar → ish beruvchi tirsagi), y bo'yicha qo'llar balandligida
X_RAMP_IN = (775.0, 815.0)  # ishchi gavdasi chetidan bilagigacha: 0 → 1
X_FULL = (815.0, 888.0)  # qo'llar: 1
X_RAMP_OUT = (888.0, 962.0)  # ish beruvchi bilagi → tirsagi: 1 → 0
Y_BAND = (470.0, 505.0, 640.0, 675.0)  # 0 → 1 (505) … 1 (640) → 0


def smooth(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def profile(x: float, y: float) -> float:
    if x <= X_RAMP_IN[0] or x >= X_RAMP_OUT[1]:
        fx = 0.0
    elif x < X_RAMP_IN[1]:
        fx = smooth((x - X_RAMP_IN[0]) / (X_RAMP_IN[1] - X_RAMP_IN[0]))
    elif x <= X_FULL[1]:
        fx = 1.0
    else:
        fx = 1.0 - smooth((x - X_RAMP_OUT[0]) / (X_RAMP_OUT[1] - X_RAMP_OUT[0]))
    a, b, c, d = Y_BAND
    if y <= a or y >= d:
        fy = 0.0
    elif y < b:
        fy = smooth((y - a) / (b - a))
    elif y <= c:
        fy = 1.0
    else:
        fy = 1.0 - smooth((y - c) / (d - c))
    return fx * fy


def layers(src: Image.Image) -> tuple[Image.Image, Image.Image]:
    """
    Oq fon → shaffof (alfa qizil/yashil kanaldan), asl rang tiklanadi va har piksel yozuvga yoki odamlarga ajratiladi.
    Yaxlit piksellar rang bo'yicha ajratiladi; chekka (yarim shaffof) piksellar — eng yaqin yaxlit qo'shnisi sinfida
    (aks holda harflar atrofida ingichka "odam" chizig'i qolardi). Yozuv rangi — bitta #0052F3; odamlarda manbadagi yumshoq soya qoladi (mayda shovqin tekislanadi).
    """
    rgb = np.asarray(src.convert("RGB"), dtype=np.float64)
    alpha = (255.0 - np.minimum(rgb[..., 0], rgb[..., 1])) / 255.0
    alpha[alpha < 0.04] = 0.0
    safe = np.where(alpha > 0, alpha, 1.0)[..., None]
    color = np.clip((rgb - (1.0 - alpha[..., None]) * 255.0) / safe, 0, 255)
    # yaxlit qism (alfa ≥ 0.5) bog'langan bo'laklarga ajratiladi: har harf va har odam — alohida bo'lak; bo'lak sinfi —
    # undagi piksellarning ko'pchilik rangi. Harf odamga tegib turgan bo'lakda (S va ishchi yelkasi) — piksel o'z rangi bo'yicha.
    solid = alpha >= 0.5
    is_text_color = (color[..., 2] >= TEXT_BLUE_MIN) & (color[..., 1] >= 70)
    labels, count = ndimage.label(solid)
    text_share = ndimage.mean(is_text_color.astype(np.float64), labels, index=np.arange(1, count + 1))
    comp_class = np.zeros(count + 1, dtype=np.int8)  # 1 — yozuv, 2 — odamlar, 3 — aralash
    for i, share in enumerate(text_share, start=1):
        comp_class[i] = 1 if share > 0.9 else 2 if share < 0.1 else 3
    cls = comp_class[labels]
    mixed = cls == 3
    cls = np.where(mixed & is_text_color, 1, np.where(mixed, 2, cls))
    # chekka piksellar — eng yaqin yaxlit pikselning sinfi
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    cls = np.where(solid, cls, cls[iy, ix])
    visible = alpha > 0
    text_mask = visible & (cls == 1)
    fig_mask = visible & (cls == 2)

    a8 = np.clip(np.round(alpha * 255), 0, 255).astype(np.uint8)
    a8 = np.where(a8 > 247, 255, a8).astype(np.uint8)

    def layer(mask: np.ndarray, rgb_img: Image.Image) -> Image.Image:
        out = rgb_img.convert("RGBA")
        out.putalpha(Image.fromarray(np.where(mask, a8, 0).astype(np.uint8)))
        return out

    text_rgb = Image.new("RGB", src.size, (0, 82, 243))
    # odamlar: manbadagi yumshoq soya (bosh to'qroq) saqlanadi, faqat mayda shovqin tekislanadi (ichki oq chiziqlar alfa bilan)
    smooth_color = np.stack([ndimage.gaussian_filter(np.where(fig_mask, color[..., c], np.nan_to_num(color[..., c])), sigma=1.6) for c in range(3)], axis=-1)
    fig_rgb = Image.fromarray(np.clip(smooth_color, 0, 255).astype(np.uint8))
    return layer(text_mask, text_rgb), layer(fig_mask, fig_rgb)


def displacement_map(size: int = 627) -> Image.Image:
    """R — x siljimaydi (128), G — y siljishi 128 + 127·f (f — profile), B — 128; to'liq shaffofsiz (feDisplacementMap uchun)."""
    im = Image.new("RGB", (size, size), (128, 128, 128))
    p = im.load()
    k = SIZE / size
    for j in range(size):
        for i in range(size):
            f = profile((i + 0.5) * k, (j + 0.5) * k)
            if f > 0:
                p[i, j] = (128, 128 + round(127 * f), 128)
    return im


def on_white(img: Image.Image, box: tuple[int, int, int, int], out: int, pad: float) -> Image.Image:
    """Mazmunni oq kvadrat o'rtasiga joylash (pad — har tomondan ulush)."""
    crop = img.crop(box)
    inner = round(out * (1 - 2 * pad))
    scale = inner / max(crop.size)
    crop = crop.resize((max(1, round(crop.size[0] * scale)), max(1, round(crop.size[1] * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (out, out), (255, 255, 255, 255))
    canvas.alpha_composite(crop.convert("RGBA"), ((out - crop.size[0]) // 2, (out - crop.size[1]) // 2))
    return canvas.convert("RGB")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    src = Image.open(SRC)
    assert src.size == (SIZE, SIZE), src.size
    text, figs = layers(src)
    # 640 px — 320 CSS px gacha 2x ekranda tiniq; tekis rang tufayli yo'qotishsiz WebP kichik (~20 + 35 KB)
    text.resize((640, 640), Image.LANCZOS).save(os.path.join(OUT, "logo-text.webp"), "WEBP", lossless=True, quality=100, method=6)
    figs.resize((640, 640), Image.LANCZOS).save(os.path.join(OUT, "logo-figures.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
    # sarlavha belgisi: faqat odamlar qismi (MARK_BOX), kichik fayl — har sahifada yuklanadi
    mark = figs.crop(MARK_BOX)
    mark.resize((210, round(210 * mark.size[1] / mark.size[0])), Image.LANCZOS).save(os.path.join(OUT, "mark-figures.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
    text.save(os.path.join(OUT, ".preview-text.png")) if os.environ.get("LOGO_PREVIEW") else None
    figs.save(os.path.join(OUT, ".preview-figures.png")) if os.environ.get("LOGO_PREVIEW") else None
    displacement_map().save(os.path.join(OUT, "handshake-map.png"), optimize=True)

    full = src.convert("RGB")
    # ilova belgilari: to'liq logo oq fonda (192 px da ham "TOPDIM" o'qiladi); maskable — xavfsiz zona 80%
    for size in (192, 512):
        on_white(full, FULL_BOX, size, 0.06).save(os.path.join(ICONS, f"icon-{size}.png"), optimize=True)
        on_white(full, FULL_BOX, size, 0.14).save(os.path.join(ICONS, f"maskable-{size}.png"), optimize=True)
    on_white(full, FULL_BOX, 180, 0.08).save(os.path.join(ICONS, "apple-touch-icon.png"), optimize=True)
    # brauzer yorlig'i: kichik o'lchamda faqat odamlar (yozuv 16–48 px da o'qilmaydi)
    mark48 = on_white(full, MARK_BOX, 48, 0.04)
    mark48.save(os.path.join(ICONS, "favicon-48.png"), optimize=True)
    # ICO ichidagi PNG — RGBA bo'lishi shart (Next.js/Turbopack boshqasini o'qimaydi)
    on_white(full, MARK_BOX, 256, 0.04).convert("RGBA").save(os.path.join(ROOT, "src/app/favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    # SVG favicon: ichida PNG (shakl rastr, lekin brauzer SVG ikonkani birinchi oladi)
    buf = io.BytesIO()
    on_white(full, MARK_BOX, 96, 0.04).save(buf, "PNG", optimize=True)
    data = base64.b64encode(buf.getvalue()).decode()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 96 96">'
        '<rect width="96" height="96" rx="20" fill="#ffffff"/>'
        f'<image width="96" height="96" href="data:image/png;base64,{data}"/></svg>\n'
    )
    with open(os.path.join(ROOT, "public/icon.svg"), "w") as fh:
        fh.write(svg)
    print("ok")


if __name__ == "__main__":
    main()
