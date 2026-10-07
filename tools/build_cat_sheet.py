"""
Monta a spritesheet do gato para o jogo (assets/cat.png + assets/cat.json) a partir das tiras
originais em assets/source/:
    cat-walk.png   8 quadros andando
    cat-idle.png   8 quadros sentado (rabo, olhares, piscadas)
    cat-jump.png   8 quadros do pulo (em pé, preparo, impulso, subida, voo, descida, aterrissagem, em pé)

O script:
  1. separa os quadros de cada tira (pelos pedaços conectados de pixels, porque em algumas tiras o
     rabo de um gato encosta no vizinho; se dois gatos estiverem grudados, divide pela coluna)
  2. alinha os quadros entre si para o gato não tremer: nos quadros no chão, patas numa linha fixa e
     frente do gato numa coluna fixa; nos quadros no ar, o centro de massa no mesmo ponto
  3. junta tudo numa tira de quadros do mesmo tamanho

Uso (precisa de Pillow e numpy):
    python tools/build_cat_sheet.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'source'
OUT_PNG = ROOT / 'assets' / 'cat.png'
OUT_JSON = ROOT / 'assets' / 'cat.json'

# nome da animação: (arquivo, quantidade de quadros, índices dos quadros com as patas no chão)
STRIPS = {
    'walk': ('cat-walk.png', 8, range(8)),
    'sit': ('cat-idle.png', 8, range(8)),
    'jump': ('cat-jump.png', 8, (0, 1, 2, 6, 7)),
}


def components(mask):
    """Rotula pedaços conectados (vizinhança de 8) de uma máscara booleana."""
    h, w = mask.shape
    labels = np.zeros((h, w), int)
    n = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not labels[y, x]:
                n += 1
                stack = [(y, x)]
                labels[y, x] = n
                while stack:
                    cy, cx = stack.pop()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                                labels[ny, nx] = n
                                stack.append((ny, nx))
    return labels, n


def split_strip(rgba, count):
    """Devolve uma lista de `count` imagens RGBA recortadas, uma por gato."""
    h, w, _ = rgba.shape
    cell = w / count
    mask = rgba[..., 3] > 0
    labels, n = components(mask)
    owner = np.full((h, w), -1, int)
    for lab in range(1, n + 1):
        ys, xs = np.nonzero(labels == lab)
        if xs.max() - xs.min() < cell * 1.3:
            owner[ys, xs] = min(count - 1, int(xs.mean() // cell))
        else:
            # pedaço com dois gatos grudados: cada pixel fica com a célula onde está
            owner[ys, xs] = np.minimum(count - 1, (xs // cell).astype(int))
    frames = []
    for i in range(count):
        ys, xs = np.nonzero(owner == i)
        img = np.zeros((ys.max() - ys.min() + 1, xs.max() - xs.min() + 1, 4), np.uint8)
        img[ys - ys.min(), xs - xs.min()] = rgba[ys, xs]
        frames.append(img)
    return frames


def main():
    frames = []
    for name, (file, count, ground) in STRIPS.items():
        rgba = np.asarray(Image.open(SRC / file).convert('RGBA'))
        for i, img in enumerate(split_strip(rgba, count)):
            ys, xs = np.nonzero(img[..., 3] > 0)
            frames.append({
                'name': f'{name}{i}', 'img': img, 'ground': i in ground,
                'h': img.shape[0], 'w': img.shape[1], 'com': (xs.mean(), ys.mean()),
            })

    ground = [f for f in frames if f['ground']]
    # No chão: frente do gato na coluna x = 0 e patas na linha y = 0
    for f in ground:
        f['ox'] = -f['w']
        f['oy'] = -f['h']
    # Centro de massa médio dos quadros sentados: os quadros no ar são centrados nele
    sit = [f for f in ground if f['name'].startswith('sit')]
    gcx = np.mean([f['ox'] + f['com'][0] for f in sit])
    gcy = np.mean([f['oy'] + f['com'][1] for f in sit])
    for f in frames:
        if not f['ground']:
            f['ox'] = int(round(gcx - f['com'][0]))
            f['oy'] = int(round(gcy - f['com'][1]))

    pad = 1
    min_x = min(f['ox'] for f in frames)
    min_y = min(f['oy'] for f in frames)
    cw = max(f['ox'] + f['w'] for f in frames) - min_x + pad * 2
    ch = max(f['oy'] + f['h'] for f in frames) - min_y + pad * 2
    dx, dy = pad - min_x, pad - min_y

    sheet = np.zeros((ch, cw * len(frames), 4), np.uint8)
    for n, f in enumerate(frames):
        x0 = n * cw + f['ox'] + dx
        y0 = f['oy'] + dy
        region = sheet[y0:y0 + f['h'], x0:x0 + f['w']]
        opaque = f['img'][..., 3] > 0
        region[opaque] = f['img'][opaque]
    Image.fromarray(sheet, 'RGBA').save(OUT_PNG)

    meta = {
        'frameWidth': cw,
        'frameHeight': ch,
        'frames': [f['name'] for f in frames],
        'originX': round((gcx + dx) / cw, 4),
        'originY': round((gcy + dy) / ch, 4),
        'footY': dy,
        'centerY': round(gcy + dy, 2),
    }
    OUT_JSON.write_text(json.dumps(meta, indent=2), encoding='utf-8')
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
