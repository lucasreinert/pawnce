// Interface em pixel art: fonte bitmap 5x7 (desenhada aqui, sem arquivo de fonte externo),
// logo do jogo e os textos da tela.

// Textos do jogo. Para traduzir, basta trocar aqui (a fonte tem A–Z, 0–9 e  + - ! . : ?).
const TEXT = {
  title: 'PAWNCE',
  tagline: 'CATCH BIRDS.\nREACH THE MOON.',
  tapToJump: 'TAP TO JUMP',
  dragToMove: 'DRAG TO MOVE',
  best: 'BEST',
  newBest: 'NEW BEST!',
  score: 'SCORE',
  combo: 'COMBO',
  gameOver: 'GAME OVER',
  playAgain: 'PLAY AGAIN',
  frenzy: 'FRENZY',
};

// Cada letra: 7 linhas de 5 colunas ('#' = pixel aceso)
const PIXEL_GLYPHS = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
};

const FONT_CELL_W = 8;   // 5 da letra + contorno dos dois lados + 1 de espaço
const FONT_CELL_H = 10;  // 7 da letra + contorno + 1 de sombra

// Patinha do logo (13x12, '#' = pixel aceso)
const PAW_ROWS = [
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
];

// Desenha um desenho em pixels (letra ou patinha) com sombra, contorno e preenchimento
// (fill pode variar por linha). ps = tamanho de cada pixel no canvas.
function drawGlyph(ctx, rows, ox, oy, fill, outline, shadow, border = 1, ps = 1) {
  const h = rows.length;
  const w = rows[0].length;
  const on = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === '#';
  const near = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (on(x + dx, y + dy)) return true;
    return false;
  };
  const px = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect((ox + border + x) * ps, (oy + border + y) * ps, ps, ps);
  };
  for (let y = -border; y < h + border; y++) {
    for (let x = -border; x < w + border; x++) if (near(x, y, border)) px(x, y + 1, shadow);
  }
  for (let y = -border; y < h + border; y++) {
    for (let x = -border; x < w + border; x++) if (near(x, y, border) && !on(x, y)) px(x, y, outline);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) px(x, y, fill(y));
}

// Fonte bitmap 'pixel': letras brancas (colorir com setTint) com contorno roxo-escuro e sombra.
function makePixelFont(scene) {
  const chars = Object.keys(PIXEL_GLYPHS).join('');
  const tex = scene.textures.createCanvas('pixelFontImg', chars.length * FONT_CELL_W, FONT_CELL_H);
  const ctx = tex.getContext();
  [...chars].forEach((ch, i) => {
    drawGlyph(ctx, PIXEL_GLYPHS[ch], i * FONT_CELL_W, 0, () => '#ffffff', '#1a1030', '#07040f');
  });
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  scene.cache.bitmapFont.add('pixel', Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'pixelFontImg',
    width: FONT_CELL_W,
    height: FONT_CELL_H,
    chars,
    charsPerRow: chars.length,
    spacing: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    lineSpacing: 3,
  }));
}

// Letras do logo: degradê dourado (como os olhos do gato), contorno roxo-escuro,
// borda externa lilás e sombra. Uma textura por letra, para elas poderem balançar em onda.
const LOGO_GRADIENT = ['#fff7c9', '#ffe98a', '#ffd84d', '#ffc832', '#ffb21f', '#ff9b1a', '#f07f14'];
const LOGO_LETTER_W = 5 + 4;
const LOGO_LETTER_H = 7 + 4 + 2;

function makeLogo(scene) {
  for (const ch of new Set(TEXT.title)) {
    const key = `logo_${ch}`;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, LOGO_LETTER_W, LOGO_LETTER_H);
    const ctx = tex.getContext();
    // borda externa (lilás) + sombra, depois a letra com contorno escuro por cima
    // (as duas passadas deixam a letra no mesmo lugar: x = 2..6, y = 3..9)
    drawGlyph(ctx, PIXEL_GLYPHS[ch], 0, 1, () => '#b98cff', '#b98cff', '#120a26', 2);
    drawGlyph(ctx, PIXEL_GLYPHS[ch], 1, 2, (y) => LOGO_GRADIENT[y], '#2a1450', '#2a1450', 1);
    // brilho no primeiro pixel da linha de cima
    ctx.fillStyle = '#ffffff';
    const rows = PIXEL_GLYPHS[ch];
    for (let x = 0; x < 5; x++) if (rows[0][x] === '#') { ctx.fillRect(2 + x, 3, 1, 1); break; }
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  makePaw(scene);
}

// Patinha ao lado do logo: almofadinhas rosa, mesmo contorno e borda das letras.
// Desenhada já grande (PAW_PIXEL px por pixel) para poder ficar inclinada sem serrilhar.
const PAW_PIXEL = 4;
const PAW_GRADIENT = ['#ffd6e7', '#ffc2db', '#ffb0d0', '#ff9ec4', '#ff8cb9', '#f97aae', '#ee6aa2'];

function makePaw(scene) {
  if (scene.textures.exists('logo_paw')) return;
  const w = PAW_ROWS[0].length + 4;
  const h = PAW_ROWS.length + 4 + 2;
  const tex = scene.textures.createCanvas('logo_paw', w * PAW_PIXEL, h * PAW_PIXEL);
  const ctx = tex.getContext();
  const grad = (y) => PAW_GRADIENT[Math.floor((y * PAW_GRADIENT.length) / PAW_ROWS.length)];
  drawGlyph(ctx, PAW_ROWS, 0, 1, () => '#b98cff', '#b98cff', '#120a26', 2, PAW_PIXEL);
  drawGlyph(ctx, PAW_ROWS, 1, 2, grad, '#2a1450', '#2a1450', 1, PAW_PIXEL);
  // brilhinho em cada dedo de cima e na almofada
  ctx.fillStyle = '#ffffff';
  for (const [x, y] of [[3, 1], [8, 1], [4, 8]]) ctx.fillRect((2 + x) * PAW_PIXEL, (3 + y) * PAW_PIXEL, PAW_PIXEL, PAW_PIXEL);
  tex.refresh();
}

// Atalho para criar texto em pixel art. size = quantos pixels de tela por pixel da fonte.
function pixelText(scene, x, y, str, size, tint = 0xffffff) {
  return scene.add.bitmapText(x, y, 'pixel', str).setScale(size).setTint(tint);
}
