"""
Monta as spritesheets dos passarinhos para o jogo a partir das tiras originais em assets/source/:
    bird-fly.png    6 quadros 32x32 voando no lugar (loop)
    bird-flee.png   6 quadros 32x32 assustado fugindo

Cada spritesheet gerada tem 12 quadros em linha (0–5 voando, 6–11 fugindo) e sai em três cores,
trocando a paleta cor a cor (o desenho é o mesmo):
    assets/bird.png        normal (branco-lilás com asas azuis, como a arte original)
    assets/bird-gold.png   dourado (vale x2)
    assets/bird-bonus.png  lilás (frenesi), combinando com a estrela roxa

Uso (precisa de Pillow e numpy):
    python tools/build_bird_sheets.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'source'
OUT = ROOT / 'assets'

# Cores da arte original → cor em cada variação. Cores fora da lista (contorno, olho) não mudam.
BASE = {
    'body': '#f8f1fb', 'body_mid': '#e6daf7', 'body_shadow': '#d6c7fa',
    'wing': '#91c6fd', 'wing_light': '#89d3fc', 'wing_shine': '#8fe3fd', 'wing_dark': '#5f9bf9',
    'beak': '#f67a27', 'blush': '#f98eaf',
}
VARIANTS = {
    'bird': {},
    'bird-gold': {
        'body': '#fff6c9', 'body_mid': '#ffe58a', 'body_shadow': '#f6c24a',
        'wing': '#ffc533', 'wing_light': '#ffd65c', 'wing_shine': '#ffe98f', 'wing_dark': '#e8901c',
        'beak': '#f0661f', 'blush': '#ff8a6b',
    },
    'bird-bonus': {
        'body': '#f7e8ff', 'body_mid': '#ead1ff', 'body_shadow': '#d7b0ff',
        'wing': '#c58cff', 'wing_light': '#d6a8ff', 'wing_shine': '#e6c7ff', 'wing_dark': '#9b3dff',
        'blush': '#ff8ad8',
    },
}


def rgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))


def main():
    fly = np.asarray(Image.open(SRC / 'bird-fly.png').convert('RGBA'))
    flee = np.asarray(Image.open(SRC / 'bird-flee.png').convert('RGBA'))
    sheet = np.concatenate([fly, flee], axis=1)

    for name, swaps in VARIANTS.items():
        out = sheet.copy()
        for part, new in swaps.items():
            match = np.all(sheet[..., :3] == rgb(BASE[part]), axis=-1) & (sheet[..., 3] > 0)
            out[match, :3] = rgb(new)
        Image.fromarray(out, 'RGBA').save(OUT / f'{name}.png')
        print(f'{name}.png', out.shape[1], 'x', out.shape[0])


if __name__ == '__main__':
    main()
