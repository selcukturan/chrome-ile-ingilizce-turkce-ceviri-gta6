"""Paylaşım görselini (static/og.png, 1200x630) üretir.

Kullanım: python3 scripts/og.py   (Pillow + DejaVu Sans gerekir)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ARKA = "#111217"
MAVI = "#4f8cff"
BEYAZ = "#ececf1"
GRI = "#8b93a7"

BASLIK = "Altyazı Çeviri"
ALT_BASLIK = "Oyun altyazıları anında Türkçe"
GEREKSINIM = "PS5 + kamera + Chrome"
ORNEK_TR = '"Mahalleye geri döndük."'
ORNEK_EN = "We are back in the hood."

W, H = 1200, 630
img = Image.new("RGB", (W, H), ARKA)
d = ImageDraw.Draw(img)


def f(yol: str, boyut: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(yol, boyut)


d.text((80, 182), BASLIK, font=f(FONT_B, 92), fill=MAVI, anchor="ls")
d.text((80, 263), ALT_BASLIK, font=f(FONT_B, 52), fill=BEYAZ, anchor="ls")
d.text((80, 337), GEREKSINIM, font=f(FONT, 38), fill=GRI, anchor="ls")

d.rounded_rectangle((80, 410, 1120, 540), radius=16, fill="#000000")
d.text((W // 2, 484), ORNEK_TR, font=f(FONT_B, 42), fill="#ffffff", anchor="ms")
d.text((W // 2, 527), ORNEK_EN, font=f(FONT, 24), fill=GRI, anchor="ms")

hedef = Path(__file__).resolve().parent.parent / "static" / "og.png"
img.save(hedef, optimize=True)
print("yazıldı:", hedef)
