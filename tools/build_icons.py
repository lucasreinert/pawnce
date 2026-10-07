"""
Gera os ícones do app (PWA) em icons/: a patinha do logo em pixel art sobre o céu noturno do jogo.

    icon-180.png            iPhone (apple-touch-icon)
    icon-192.png, icon-512.png
    icon-maskable-512.png   Android (a patinha fica menor, dentro da área segura do recorte)
    favicon-64.png          aba do navegador

A patinha é a mesma de src/ui.js (PAW_ROWS); se mudar lá, mude aqui também.

Uso (precisa de Pillow):
    python tools/build_icons.py
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'icons'

PAW_ROWS = [
    '...##...##...',
    '..####.####..',
    '..####.####..',
    '...##...##...',
    '##.........##',
    '###.......###',
    '.##..###..##.',
    '....#####....',
    '...#######...',
    '..#########..',
    '..#########..',
    '...#######...',
]
PAW_GRADIENT = ['#ffd6e7', '#ffc2db', '#ffb0d0', '#ff9ec4', '#ff8cb9', '#f97aae', '#ee6aa2']
BORDER = '#b98cff'
OUTLINE = '#2a1450'
SHADOW = '#120a26'
SKY_TOP = (11, 11, 36)
SKY_BOTTOM = (52, 38, 102)


def draw_glyph(draw, rows, ox, oy, fill, outline, shadow, border, ps):
    """Mesmo desenho do drawGlyph de src/ui.js: sombra, contorno e preenchimento por linha."""
    h, w = len(rows), len(rows[0])
    on = lambda x, y: 0 <= y < h and 0 <= x < w and rows[y][x] == '#'
    near = lambda x, y: any(on(x + dx, y + dy) for dy in range(-border, border + 1) for dx in range(-border, border + 1))

    def px(x, y, color):
        x0, y0 = (ox + border + x) * ps, (oy + border + y) * ps
        draw.rectangle([x0, y0, x0 + ps - 1, y0 + ps - 1], fill=color)

    for y in range(-border, h + border):
        for x in range(-border, w + border):
            if near(x, y):
                px(x, y + 1, shadow)
    for y in range(-border, h + border):
        for x in range(-border, w + border):
            if near(x, y) and not on(x, y):
                px(x, y, outline)
    for y in range(h):
        for x in range(w):
            if on(x, y):
                px(x, y, fill(y))


def paw_image(ps):
    """Patinha com borda lilás, contorno escuro, sombra e brilhinhos (igual ao logo do jogo)."""
    w = len(PAW_ROWS[0]) + 4
    h = len(PAW_ROWS) + 4 + 2
    img = Image.new('RGBA', (w * ps, h * ps), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    grad = lambda y: PAW_GRADIENT[y * len(PAW_GRADIENT) // len(PAW_ROWS)]
    draw_glyph(d, PAW_ROWS, 0, 1, lambda y: BORDER, BORDER, SHADOW, 2, ps)
    draw_glyph(d, PAW_ROWS, 1, 2, grad, OUTLINE, OUTLINE, 1, ps)
    for x, y in [(3, 1), (8, 1), (4, 8)]:
        x0, y0 = (2 + x) * ps, (3 + y) * ps
        d.rectangle([x0, y0, x0 + ps - 1, y0 + ps - 1], fill='#ffffff')
    return img


def background(size, seed=7):
    """Céu em degradê com algumas estrelas, como o fundo do jogo."""
    img = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(SKY_TOP, SKY_BOTTOM)) + (255,))
    rnd = random.Random(seed)
    for _ in range(max(6, size // 20)):
        x, y = rnd.randrange(size), rnd.randrange(size)
        r = max(1, size // 160)
        d.rectangle([x, y, x + r, y + r], fill=(255, 255, 255, rnd.randrange(90, 220)))
    return img


def icon(size, paw_fraction):
    """Ícone quadrado com a patinha centralizada ocupando ~paw_fraction da largura."""
    img = background(size)
    cells = len(PAW_ROWS[0]) + 4
    ps = max(1, int(size * paw_fraction / cells))
    paw = paw_image(ps)
    img.alpha_composite(paw, ((size - paw.width) // 2, (size - paw.height) // 2 + ps // 2))
    return img


def main():
    OUT.mkdir(exist_ok=True)
    targets = {
        'icon-180.png': (180, 0.72),
        'icon-192.png': (192, 0.72),
        'icon-512.png': (512, 0.72),
        'icon-maskable-512.png': (512, 0.56),  # Android recorta em círculo/forma: patinha na área segura
        'favicon-64.png': (64, 0.86),
    }
    for name, (size, frac) in targets.items():
        icon(size, frac).save(OUT / name)
        print(name)


if __name__ == '__main__':
    main()
