"""
Bosh sahifa va kasblar katalogi suratlari (egasi bergan, 2026-11-05): python3 scripts/photos/build-photos.py <manba_papka>

Har surat bir xil nisbatga kesiladi (katalog kartasi 4:3, hero 4:5), metama'lumotsiz progressive JPEG qilib
src/assets/photos/ ga yoziladi. Brauzerga next/image AVIF/WebP ko'rinishida, kerakli o'lchamda beradi (layout siljimaydi —
o'lcham statik importdan). Kattalashtirilmaydi (manba kichik bo'lsa — o'z o'lchamida qoladi).

Manba fayllar repoda saqlanmaydi (kattaligi 1–9 MB); kesish nuqtalari shu yerda — qayta yasash bir xil natija beradi.
Kesish chegaralari faqat kompozitsiya uchun (odam markazda); suratdagi belgi/yozuvni yashirish uchun ishlatilmaydi —
boshqa sayt belgisi bor surat umuman olinmaydi (docs/MAHSULOT_REJA_2026-11.md, "Suratlar").
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "src/assets/photos")

# chiqish fayli: (manba fayl, nisbat (w, h), fokus x ulushi 0..1, maksimal eni)
PHOTOS: dict[str, tuple[str, tuple[int, int], float, int]] = {
    # hero: qurilish ishchisi (tik kadr, yuz markazda)
    "hero-construction.jpg": ("b31586b9-image.png", (4, 5), 0.60, 960),
    # katalog kartalari (4:3)
    "cat-medicine.jpg": ("ba734fe8-image.png", (4, 3), 0.52, 1200),
    "cat-education.jpg": ("61dfb5dc-image.png", (4, 3), 0.50, 1200),
    "cat-sales.jpg": ("98706d64-image.png", (4, 3), 0.63, 1200),
    "cat-restaurant.jpg": ("cc292c6f-image.png", (4, 3), 0.42, 1200),
    "cat-auto-service.jpg": ("27328f97-image.png", (4, 3), 0.37, 1200),
    "cat-agriculture.jpg": ("8b10285b-image.png", (4, 3), 0.36, 1200),
}


def crop(im: Image.Image, ratio: tuple[int, int], fx: float) -> Image.Image:
    w, h = im.size
    rw, rh = ratio
    if w * rh > h * rw:  # manba kengroq — eni kesiladi
        cw, ch = round(h * rw / rh), h
    else:
        cw, ch = w, round(w * rh / rw)
    x0 = min(max(round(fx * w - cw / 2), 0), w - cw)
    y0 = (h - ch) // 2
    return im.crop((x0, y0, x0 + cw, y0 + ch))


def main(src: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    for name, (file, ratio, fx, max_w) in PHOTOS.items():
        im = ImageOps.exif_transpose(Image.open(os.path.join(src, file))).convert("RGB")
        im = crop(im, ratio, fx)
        if im.width > max_w:
            im = im.resize((max_w, round(max_w * im.height / im.width)), Image.LANCZOS)
        path = os.path.join(OUT, name)
        im.save(path, "JPEG", quality=82, progressive=True, optimize=True)
        print(f"{name}: {im.width}x{im.height}, {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("ishlatish: python3 scripts/photos/build-photos.py <manba_papka>")
    main(sys.argv[1])
