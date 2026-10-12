// Jogo em retrato (pensado para celular; no desktop aparece centralizado com bordas).
// W é a largura do "mundo" do jogo, que ocupa a largura da tela do celular: quanto menor, maior tudo
// aparece (gato, passarinhos, textos). 400 deixa tudo ~20% maior que os 480 originais.
const W = 400;
// As distâncias e velocidades abaixo foram afinadas com 480 de largura; KS converte para a largura
// atual, mantendo o mesmo tempo de pulo e a mesma dificuldade.
const KS = W / 480;
// A altura acompanha o formato da tela: celulares mais alongados (iPhones atuais) ganham mais céu em
// vez de faixas pretas. Telas mais largas (desktop, Poki) ficam no mínimo.
// (Se a página carregar com tamanho zero, por exemplo num quadro ainda invisível, usa a altura mínima.)
const SCREEN_RATIO = window.innerHeight / window.innerWidth;
const H = Math.round(Phaser.Math.Clamp(
  Number.isFinite(SCREEN_RATIO) && SCREEN_RATIO > 0 ? W * SCREEN_RATIO : 820 * KS, 820 * KS, 1100 * KS,
));
// Faixa do relógio/entalhe no topo quando o app roda em tela cheia no iPhone, em pixels do jogo.
// A interface (placar, frenesi, logo) desce essa quantidade para não ficar embaixo dela.
const SAFE_TOP = (() => {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top, 0px);visibility:hidden';
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return window.innerWidth > 0 ? Math.round(px * (W / window.innerWidth)) : 0;
})();
const GROUND_Y = H - Math.round(70 * KS);
const CAT_R = 20;
const CAT_SCALE = 1;         // a arte já vem no tamanho do jogo (~60px de altura)
const CAMERA_ANCHOR = 0.55; // altura da tela (0 = topo) onde a câmera segura o gato

// Dificuldade (valores em "pixels de 480", convertidos por KS)
const CAT_SPEED = 560 * KS;   // velocidade horizontal máxima do gato
const WALK_SPEED = 110 * KS;  // velocidade do passeio no telhado antes de começar
const GAP_MIN = 150 * KS;     // distância vertical entre passarinhos...
const GAP_MAX = 190 * KS;
const GAP_GROW = 110 * KS;    // ...e quanto ela aumenta lá no alto
const DX_MAX = 230 * KS;      // distância horizontal máxima entre passarinhos seguidos
const DIFF_HEIGHT = 20000 * KS; // fase 1 (0 → 500 m): passarinhos se afastam, diminuem e passam a voar
// Fase 2 (500 → 1500 m): a dificuldade continua subindo em vez de parar nos 500 m
const HARD_HEIGHT = 40000 * KS; // quanto dura a fase 2 (1000 m)
const GAP_HARD = 40 * KS;       // distância vertical extra no fim da fase 2 (ainda alcançável com folga)

// Falcão: atravessa a tela depois de um aviso. Encostar nele empurra o gato para o lado (na direção em
// que o falcão voa) com um pulinho, tira o controle por um instante e zera o combo; dá para se
// recuperar. Depois do acerto o gato fica protegido por um momento. No frenesi o gato é imune.
const HAWK_START_M = 150;       // a partir de quantos metros aparece
const HAWK_EVERY_S = [9, 3.5];  // intervalo entre falcões: no começo → lá no alto (1150 m)
const HAWK_WARN_MS = 1500;      // duração do aviso "!" antes de ele entrar
const HAWK_SPEED = [260, 420];  // px/s (escala de 480): no começo → lá no alto
const HAWK_R = 24;              // raio de colisão
const HAWK_SCALE = 1.5;         // assets/hawk.png: 6 quadros de 64x64 voando (usado como veio)
// Quanto o acerto pune (testado com bot de mira perfeita que não desvia; % = acertos dos quais ele
// se recuperou): 400 ms / -420 → 97%; 550 ms / -300 → 83% (atual); 650 ms / -250 → 65%.
const KNOCK_MS = 550;           // quanto tempo o gato fica sem controle, sendo empurrado
const KNOCK_SPEED = 650 * KS;   // velocidade do empurrão para o lado
const KNOCK_HOP = -300 * KS;    // pulinho para cima no acerto (não despenca)
const HAWK_SAFE_MS = 1000;      // proteção depois de um acerto (não leva outro em seguida)

// Passarinhos assustadiços: desviam para o lado quando o gato chega perto
const SKITTISH_START_M = 300;
const SKITTISH_MAX = 0.5;       // no máximo metade dos passarinhos (a partir de ~1000 m)

// Pulo alto: ~450px (em 480) e quase 1s subindo, então sobra bastante tempo no ar entre um passarinho e outro.
const GRAVITY = 1100 * KS;    // px/s²
const BOUNCE_VY = -1000 * KS; // impulso ao pegar um passarinho
const GROUND_JUMP_VY = -900 * KS;

// Frenesi: a estrela roxa ativa uma trilha de passarinhos fáceis, pontos em dobro e pulo mais forte.
const FRENZY_MS = 6000;
const FRENZY_BOUNCE_VY = -1250 * KS;
const FRENZY_MULT = 2;
const ORB_EVERY = [3500 * KS, 5000 * KS]; // intervalo de altura entre uma estrela e outra
const STAR_R = 22;              // raio de coleta da estrela

// Visual
const TRAIL_COLOR = 0xf3efe6;
const FRENZY_COLOR = 0xc77dff;  // roxo da estrela: tom da tela, rastro e pássaros do frenesi
const STAR_PARTICLES = [0xb14dff, 0xd59bff, 0x8f3bff, 0xf0d6ff];

// Passarinhos em pixel art (gerados por tools/build_bird_sheets.py): normal, dourado (x2) e lilás (frenesi)
const BIRD_SHEETS = { bird: 'assets/bird.png', gold: 'assets/bird-gold.png', bonus: 'assets/bird-bonus.png' };
const BIRD_FLAP_FPS = { bird: 12, gold: 16, bonus: 14 }; // quadros por segundo do bater de asas
const BIRD_SCALE = 1.5; // tamanho dos passarinhos (1 = mesma densidade de pixels do gato)
const TRAIL_LEN = 18;        // quantos quadros o rastro guarda

// Cor e tamanho dos pontos que saltam de cada passarinho: crescem e esquentam com o combo.
function pointsStyle(combo, frenzy) {
  if (frenzy) return { tint: 0xe2b8ff, size: 3 };
  if (combo >= 20) return { tint: 0xff9f3f, size: 4 };
  if (combo >= 10) return { tint: 0xffd23f, size: 3 };
  if (combo >= 5) return { tint: 0xfff1a0, size: 3 };
  return { tint: 0xffffff, size: 2 };
}

const BEST_KEY = 'pulo-do-gato-best';

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || localStorage.getItem('pulo-do-gato-best-mobile')) || 0;
  } catch (e) { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) {}
}

// Altura em metros: 1 m = 40 px (na escala de 480). Um passarinho fica a uns 4 m do outro.
const PX_PER_METER = 40 * KS;
const BEST_HEIGHT_KEY = 'pawnce-best-height';
function loadBestHeight() {
  try { return Number(localStorage.getItem(BEST_HEIGHT_KEY)) || 0; } catch (e) { return 0; }
}
function saveBestHeight(v) {
  try { localStorage.setItem(BEST_HEIGHT_KEY, String(v)); } catch (e) {}
}

// Spritesheet do gato em pixel art (gerada por tools/build_cat_sheet.py).
// CAT guarda as medidas lidas de assets/cat.json e o índice de cada quadro pelo nome (walk0, jump3, sit5...).
const CAT = { frame: {} };
let CAT_FOOT = 0;            // distância do centro do gato até a sola das patas, em pixels do jogo

function setupCat(scene) {
  const meta = scene.cache.json.get('catMeta');
  Object.assign(CAT, meta);
  const tex = scene.textures.get('catSheet');
  meta.frames.forEach((name, i) => {
    tex.add(i, 0, i * meta.frameWidth, 0, meta.frameWidth, meta.frameHeight);
    CAT.frame[name] = i;
  });
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST); // pixels nítidos, sem borrar
  CAT_FOOT = (meta.footY - meta.centerY) * CAT_SCALE;

  const frames = (...names) => names.map((n) => ({ key: 'catSheet', frame: CAT.frame[n] }));
  scene.anims.create({
    key: 'walk', frameRate: 12, repeat: -1,
    frames: frames('walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7'),
  });
  // Sentado de olhos abertos: o rabo balança devagar
  scene.anims.create({ key: 'idle', frames: frames('sit0', 'sit1', 'sit6', 'sit7', 'sit6', 'sit1'), frameRate: 4, repeat: -1 });
}

// Momentos do gato sentado: piscar (mais comum), olhar de lado, piscadinha, cochilo rápido.
const IDLE_EVENTS = [
  { frame: 'sit4', ms: 160, weight: 6 },
  { frame: 'sit2', ms: 900, weight: 2 },
  { frame: 'sit3', ms: 400, weight: 1 },
  { frame: 'sit5', ms: 1100, weight: 1 },
];

class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('catSheet', 'assets/cat.png');
    this.load.json('catMeta', 'assets/cat.json');
    this.load.spritesheet('starSpin', 'assets/star-spin.png', { frameWidth: 62, frameHeight: 60 });
    this.load.spritesheet('starCollect', 'assets/star-collect.png', { frameWidth: 80, frameHeight: 80 });
    for (const [kind, file] of Object.entries(BIRD_SHEETS)) {
      this.load.spritesheet(`${kind}Sheet`, file, { frameWidth: 32, frameHeight: 32 });
    }
    this.load.spritesheet('hawkSheet', 'assets/hawk.png', { frameWidth: 64, frameHeight: 64 });
  }

  create() {
    makeTextures(this);
    makePixelFont(this);
    makeLogo(this);
    setupCat(this);
    for (const key of ['starSpin', 'starCollect']) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.anims.create({ key: 'starSpin', frames: this.anims.generateFrameNumbers('starSpin'), frameRate: 14, repeat: -1 });
    this.anims.create({ key: 'starCollect', frames: this.anims.generateFrameNumbers('starCollect'), frameRate: 18 });
    // Passarinhos: quadros 0–5 voando no lugar (loop), 6–11 assustado fugindo
    for (const kind of Object.keys(BIRD_SHEETS)) {
      const key = `${kind}Sheet`;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.anims.create({
        key: `${kind}Fly`, repeat: -1, frameRate: BIRD_FLAP_FPS[kind],
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
      });
      this.anims.create({ key: `${kind}Flee`, frameRate: 14, frames: this.anims.generateFrameNumbers(key, { start: 6, end: 11 }) });
    }
    this.textures.get('hawkSheet').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.anims.create({ key: 'hawkFly', frameRate: 14, repeat: -1, frames: this.anims.generateFrameNumbers('hawkSheet') });
    Poki.init().then(() => {
      Poki.loadingFinished();
      this.scene.start('Game');
    });
  }
}

class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    Music.setIntense(false);
    Music.duck(false);
    this.state = 'ready'; // ready | playing | over
    this.score = 0;
    this.combo = 0;
    this.best = loadBest();
    this.bestHeight = loadBestHeight(); // maior altura já alcançada (m)
    this.maxHeight = 0;                 // maior altura nesta partida (m)
    this.passedBest = false;
    this.rankUI = null;                 // tela de ranking aberta
    this.vx = 0;
    this.vy = 0;
    this.now = 0;
    this.facing = 1;
    this.walking = false;
    this.pushUntil = 0;       // quadro de impulso logo após pular/pegar passarinho
    this.landUntil = 0;       // quadro de aterrissagem ao cair no telhado
    this.idleEventUntil = 0;
    this.nextIdleEvent = 2500;
    this.wanderAt = 1500;     // quando o gato escolhe o próximo ponto do passeio
    this.onGround = true;
    this.groundGone = false;
    this.targetX = W / 2;
    this.birds = [];
    this.goldens = [];
    this.orbs = [];
    this.nextY = GROUND_Y - 220 * KS;
    this.lastX = W / 2;
    this.nextOrbY = GROUND_Y - Phaser.Math.FloatBetween(1800 * KS, 2400 * KS);
    this.frenzy = false;
    this.frenzyUntil = 0;
    this.trail = [];
    this.hawks = [];           // falcões voando
    this.hawkWarnings = [];    // avisos "!" de falcões que ainda vão entrar
    this.nextHawkAt = 0;       // quando agendar o próximo falcão (0 = ainda não agendado)
    this.knockUntil = 0;       // gato sendo empurrado pelo falcão (sem controle) até este instante
    this.hawkSafeUntil = 0;    // protegido de outro acerto até este instante

    this.createBackground();
    this.createBestLine();

    this.trailGfx = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);    this.cat = this.add.sprite(W / 2, GROUND_Y - CAT_FOOT, 'catSheet', CAT.frame.sit0)
      .setScale(CAT_SCALE).setDepth(5);
    this.setFacing(1);
    this.cat.play('idle');
    this.cameras.main.setRoundPixels(true); // evita a pixel art "tremer" em posições quebradas

    this.dots = this.add.particles(0, 0, 'dot', {
      speed: { min: 50, max: 170 },
      lifespan: 500,
      scale: { start: 0.7, end: 0 },
      emitting: false,
    }).setDepth(6);
    this.goldDots = this.add.particles(0, 0, 'dot', {
      speed: { min: 80, max: 240 },
      lifespan: 700,
      scale: { start: 0.9, end: 0 },
      tint: 0xffd23f,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(6);
    this.frenzyDots = this.add.particles(0, 0, 'dot', {
      speed: { min: 80, max: 300 },
      lifespan: 800,
      scale: { start: 1, end: 0 },
      tint: FRENZY_COLOR,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(6);

    this.createHud();
    this.spawnBirds();

    // Controles: dedo/mouse guia o gato, toque/clique/espaço pula do telhado.
    // Antes de começar o gato passeia sozinho, então o movimento do mouse é ignorado.
    this.input.on('pointermove', (p) => {
      if (this.state !== 'ready') this.targetX = p.x;
    });
    // O navegador só libera som depois de um toque/tecla: é aí que a música começa.
    const wakeAudio = () => {
      Sfx.unlock();
      Music.start();
    };
    this.input.on('pointerdown', (p) => {
      wakeAudio();
      // Toque num botão (ranking etc.) ou com a tela de ranking aberta não faz o gato pular
      if (this.rankUI || this.input.hitTestPointer(p).length) return;
      this.targetX = p.x;
      this.tryJump();
    });
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,A,D');
    this.input.keyboard.on('keydown-SPACE', () => { wakeAudio(); if (!this.rankUI) this.tryJump(); });
    this.input.keyboard.on('keydown-UP', () => { wakeAudio(); if (!this.rankUI) this.tryJump(); });
  }

  // Botão em pílula (fixo na tela). filled = roxo cheio; senão só contorno.
  // Sem Container de propósito: objetos interativos dentro de um Container com scrollFactor 0
  // recebem o clique na posição errada quando a câmera já subiu.
  makeButton(x, y, w, h, label, { filled = false, depth = 30, size = 2, onPress }) {
    const g = this.add.graphics({ x, y }).setScrollFactor(0).setDepth(depth);
    if (filled) {
      g.fillStyle(0x07040f, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, h / 2.6);
      g.fillStyle(0x8f3bff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2.6);
      g.lineStyle(2, 0xe6c7ff, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2.6);
    } else {
      g.fillStyle(0x120c2a, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2.6);
      g.lineStyle(2, 0xb98cff, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2.6);
    }
    const t = pixelText(this, x, y, label, size, filled ? 0xffffff : 0xd59bff)
      .setOrigin(0.5).setScrollFactor(0).setDepth(depth);
    const zone = this.add.zone(x, y, w, h).setScrollFactor(0).setDepth(depth)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: g, scale: 0.94, duration: 70, yoyo: true });
      onPress();
    });
    return [g, t, zone];
  }

  // Linha tracejada e translúcida na maior altura já alcançada, com o valor em metros.
  createBestLine() {
    if (this.bestHeight <= 0) return;
    const y = GROUND_Y - CAT_FOOT - this.bestHeight * PX_PER_METER;
    const g = this.add.graphics().setDepth(2);
    this.drawDashedLine(g, y, 0xffffff, 0.35);
    const label = pixelText(this, 12, y - 24, `${TEXT.best} ${this.bestHeight} ${TEXT.meters}`, 2, 0xffffff)
      .setDepth(2).setAlpha(0.55);
    this.bestLine = { g, label, y };
  }

  drawDashedLine(g, y, color, alpha) {
    g.clear();
    g.fillStyle(color, alpha);
    for (let x = 0; x < W; x += 20) g.fillRect(x, y - 1, 12, 3);
  }

  // O gato passou da linha de recorde: ela brilha em dourado, aparece "NEW RECORD!" e depois some.
  passBestLine() {
    this.passedBest = true;
    const { g, label, y } = this.bestLine;
    this.drawDashedLine(g, y, 0xffd23f, 0.9);
    label.setText(TEXT.newRecord).setTint(0xffd23f).setAlpha(1).setScale(2.8);
    this.tweens.add({ targets: label, scale: 2, duration: 250, ease: 'Back.easeOut' });
    this.goldDots.explode(20, this.cat.x, y);
    this.tweens.add({ targets: [g, label], alpha: 0, delay: 900, duration: 900 });
  }

  createBackground() {
    this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(-10);
    this.stars = this.add.tileSprite(0, 0, W, H, 'stars').setOrigin(0).setScrollFactor(0).setDepth(-9);
    this.add.image(W - 90, 120, 'moon').setScrollFactor(0).setDepth(-8);

    // Prédios em duas camadas: os do fundo se movem mais devagar (paralaxe)
    this.add.image(0, GROUND_Y + 10, 'skyline_far').setOrigin(0, 1).setScrollFactor(0.5).setDepth(-5);
    this.add.image(0, GROUND_Y + 10, 'skyline_near').setOrigin(0, 1).setScrollFactor(0.8).setDepth(-4);
    this.add.image(0, GROUND_Y - ROOF_TOP, 'roof').setOrigin(0).setDepth(1);

    // Tom arroxeado na tela durante o frenesi
    this.frenzyTint = this.add.rectangle(0, 0, W, H, FRENZY_COLOR, 0.09).setOrigin(0)
      .setScrollFactor(0).setDepth(-3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  }

  // Placar (só aparece quando a partida começa), combo e barra do frenesi.
  createHud() {
    const fix = (o) => o.setScrollFactor(0).setDepth(20);
    this.scoreText = fix(pixelText(this, 18, SAFE_TOP + 14, '0', 4));
    // Sem recorde ainda (primeira partida): não mostra "BEST 0" e o combo sobe para o lugar dele
    const hasBest = this.best > 0;
    this.bestText = fix(pixelText(this, 20, SAFE_TOP + 58, hasBest ? `${TEXT.best} ${this.best}` : '', 2, 0x9d99c9));
    this.comboText = fix(pixelText(this, 20, SAFE_TOP + (hasBest ? 82 : 58), '', 2, 0xffd23f)).setAlpha(0);
    this.hud = [this.scoreText, this.bestText];
    this.hud.forEach((o) => o.setAlpha(0));

    this.frenzyLabel = fix(pixelText(this, W - 16, SAFE_TOP + 14, `${TEXT.frenzy} X${FRENZY_MULT}`, 2, 0xd59bff))
      .setOrigin(1, 0).setAlpha(0);
    this.frenzyBar = this.add.graphics().setScrollFactor(0).setDepth(20);

    this.createTitle();
  }

  // Tela inicial: logo PAWNCE com as letras balançando em onda, patinha "carimbada" ao lado,
  // recorde e instruções.
  createTitle() {
    const fix = (o) => o.setScrollFactor(0).setDepth(20);
    const letters = [...TEXT.title];
    const scale = 6;
    const step = 8 * scale;
    // Letras + patinha centralizadas juntas na largura da tela
    const letterW = LOGO_LETTER_W * scale;
    const pawGap = 6;
    const pawW = this.textures.get('logo_paw').getSourceImage().width;
    const left = (W - ((letters.length - 1) * step + letterW + pawGap + pawW)) / 2;
    const x0 = left + letterW / 2;
    const y0 = SAFE_TOP + 170;
    this.title = [];

    letters.forEach((ch, i) => {
      const l = fix(this.add.image(x0 + i * step, y0 - 260, `logo_${ch}`).setScale(scale));
      // cai do topo, uma letra de cada vez, e depois fica balançando em onda
      this.tweens.add({
        targets: l, y: y0, duration: 650, delay: 150 + i * 90, ease: 'Bounce.easeOut',
        onComplete: () => this.tweens.add({
          targets: l, y: y0 - 9, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 110,
        }),
      });
      this.title.push(l);
    });

    // Patinha: cai grande e girada como um carimbo depois das letras, solta faíscas e fica balançando
    const pawX = left + (letters.length - 1) * step + letterW + pawGap + pawW / 2;
    const pawY = y0 - 18;
    const pawDelay = 150 + letters.length * 90 + 450;
    const paw = this.add.image(pawX, pawY, 'logo_paw').setScrollFactor(0).setDepth(21)
      .setScale(2.2).setAngle(34).setAlpha(0);
    this.tweens.add({
      targets: paw, scale: 1, angle: 16, alpha: 1, delay: pawDelay, duration: 260, ease: 'Quad.easeIn',
      onComplete: () => {
        this.frenzyDots.explode(16, pawX, pawY);
        this.tweens.add({ targets: paw, scaleX: 1.15, scaleY: 0.88, duration: 70, yoyo: true });
        this.tweens.add({ targets: paw, angle: 9, duration: 1100, delay: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
    this.title.push(paw);

    const sub = [
      fix(pixelText(this, W / 2, y0 + 74, TEXT.tagline, 2, 0xb9a8ff).setCenterAlign().setOrigin(0.5)),
    ];
    if (this.best > 0) {
      const heightPart = this.bestHeight > 0 ? `   ${this.bestHeight} ${TEXT.meters}` : '';
      sub.push(fix(pixelText(this, W / 2, y0 + 120, `${TEXT.best} ${this.best}${heightPart}`, 2, 0xffd23f).setOrigin(0.5)));
    }
    const tap = fix(pixelText(this, W / 2, H * 0.53, TEXT.tapToJump, 4).setOrigin(0.5));
    const drag = fix(pixelText(this, W / 2, H * 0.53 + 42, TEXT.dragToMove, 2, 0x9d99c9).setOrigin(0.5));
    sub.push(tap, drag);
    let zone = null;
    if (Leaderboard.enabled) {
      const [g, t, z] = this.makeButton(W / 2, H * 0.53 + 112, 190, 48, TEXT.ranking, {
        depth: 20, onPress: () => this.openRanking('score'),
      });
      sub.push(g, t);
      zone = z;
    }
    sub.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: sub, alpha: 1, delay: 800, duration: 400 });
    this.tweens.add({ targets: tap, scale: 4.25, delay: 1200, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.title.push(...sub);
    if (zone) this.titleZone = zone;
  }

  tryJump() {
    if (this.state === 'over') return;
    if (this.state === 'ready') {
      this.state = 'playing';
      // Tela inicial sobe e some; o placar aparece
      for (const o of this.title) {
        this.tweens.killTweensOf(o);
        this.tweens.add({ targets: o, alpha: 0, y: o.y - 30, duration: 300, ease: 'Quad.easeIn', onComplete: () => o.destroy() });
      }
      if (this.titleZone) this.titleZone.destroy();
      this.tweens.add({ targets: this.hud, alpha: 1, duration: 300, delay: 150 });
      Poki.gameplayStart();
    }
    if (this.onGround) {
      this.onGround = false;
      this.vy = GROUND_JUMP_VY;
      this.pushUntil = this.now + 90;
    }
  }

  // Passarinho em pixel art batendo as asas (cada um começa num quadro diferente, para não baterem juntos)
  makeBird(x, y, kind) {
    const bird = this.add.sprite(x, y, `${kind}Sheet`).setDepth(3).setScale(BIRD_SCALE)
      .play({ key: `${kind}Fly`, startFrame: Phaser.Math.Between(0, 5) });
    bird.kind = kind;
    bird.phase = Math.random() * TAU;
    bird.hit = false;
    bird.vx = 0;
    return bird;
  }

  // Os quadros olham para a direita
  face(bird, dir) {
    bird.dir = dir;
    bird.setFlipX(dir < 0);
  }

  spawnBirds() {
    const top = this.cameras.main.scrollY - 300;
    while (this.nextY > top) {
      const height = GROUND_Y - this.nextY;
      const diff = Math.min(height / DIFF_HEIGHT, 1);                                   // fase 1: 0 → 1 até 500 m
      const hard = Phaser.Math.Clamp((height - DIFF_HEIGHT) / HARD_HEIGHT, 0, 1);       // fase 2: 0 → 1 de 500 a 1500 m
      const meters = height / PX_PER_METER;

      // Próximo passarinho longe do anterior, mas sempre alcançável.
      const dxMax = DX_MAX * (0.55 + 0.45 * diff + 0.15 * hard);
      const off = Phaser.Math.FloatBetween(dxMax * 0.35, dxMax);
      let x = this.lastX + (Math.random() < 0.5 ? -off : off);
      if (x < 40 || x > W - 40) x = this.lastX * 2 - x;
      x = Phaser.Math.Clamp(x, 40, W - 40);
      this.lastX = x;

      const bird = this.makeBird(x, this.nextY, 'bird');
      bird.baseX = x;
      bird.baseY = this.nextY;
      // A arte fica sempre no mesmo tamanho (pixel art nítida); lá no alto só a área de captura diminui.
      bird.r = 17 * (1 - diff * 0.25 - hard * 0.1);
      // Mais alto, mais passarinhos voam de um lado para o outro (e mais rápido).
      const moveChance = Math.min(diff * 0.8 + hard * 0.15, 0.95);
      bird.vx = Math.random() < moveChance
        ? Phaser.Math.FloatBetween(40, 110) * KS * (1 + diff + hard * 0.6) * (Math.random() < 0.5 ? -1 : 1) : 0;
      this.face(bird, bird.vx ? Math.sign(bird.vx) : (Math.random() < 0.5 ? -1 : 1));
      // Assustadiço: desvia para o lado quando o gato chega perto (bate as asas mais nervoso)
      const skittishChance = Phaser.Math.Clamp((meters - SKITTISH_START_M) / 700, 0, 1) * SKITTISH_MAX;
      if (Math.random() < skittishChance) {
        bird.skittish = true;
        bird.anims.timeScale = 1.6;
      }
      this.birds.push(bird);

      const gap = Phaser.Math.FloatBetween(GAP_MIN, GAP_MAX) + diff * GAP_GROW + hard * GAP_HARD;
      if (height > 1200 * KS && Math.random() < 0.06) this.spawnGolden(this.nextY - gap / 2);
      // Estrela do frenesi no meio do caminho entre este passarinho e o próximo (nunca durante um frenesi)
      if (!this.frenzy && this.nextY < this.nextOrbY) {
        this.spawnOrb(Phaser.Math.Clamp(x + Phaser.Math.FloatBetween(-70, 70) * KS, 40, W - 40), this.nextY - gap / 2);
        this.nextOrbY -= Phaser.Math.FloatBetween(ORB_EVERY[0], ORB_EVERY[1]);
      }
      this.nextY -= gap;
    }
  }

  // Passarinho dourado atravessa a tela rápido e dobra a pontuação.
  spawnGolden(y) {
    const fromLeft = Math.random() < 0.5;
    const bird = this.makeBird(fromLeft ? -30 : W + 30, y, 'gold');
    bird.vx = (fromLeft ? 1 : -1) * Phaser.Math.FloatBetween(160, 240) * KS;
    bird.baseY = y;
    this.face(bird, fromLeft ? 1 : -1);
    this.goldens.push(bird);
  }

  // Estrela do frenesi: gira no lugar, com um brilho roxo suave e partículas roxas atrás.
  spawnOrb(x, y) {
    const orb = this.add.sprite(x, y, 'starSpin').setDepth(3).play('starSpin');
    orb.baseY = y;
    orb.phase = Math.random() * TAU;
    orb.hit = false;

    orb.halo = this.add.image(x, y, 'orb').setDepth(2).setTint(0xb14dff).setAlpha(0.8)
      .setScale(1.6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: orb.halo, scale: 2.1, alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    orb.sparkles = this.add.particles(0, 0, 'dot', {
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 26) },
      speed: { min: 15, max: 55 },
      lifespan: { min: 700, max: 1300 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: STAR_PARTICLES,
      blendMode: 'ADD',
      frequency: 28,
    }).setDepth(2);
    orb.sparkles.startFollow(orb);

    orb.on('destroy', () => {
      orb.halo.destroy();
      orb.sparkles.destroy();
    });
    this.orbs.push(orb);
  }

  // Trilha de passarinhos lilás logo acima do gato enquanto o frenesi dura.
  spawnBonusBirds(cam) {
    while (this.nextBonusY > cam.scrollY - 150) {
      const x = Phaser.Math.Clamp(this.lastBonusX + Phaser.Math.FloatBetween(-110, 110) * KS, 40, W - 40);
      this.lastBonusX = x;
      const bird = this.makeBird(x, this.nextBonusY, 'bonus');
      bird.baseX = x;
      bird.baseY = this.nextBonusY;
      bird.r = 18;
      this.face(bird, Math.random() < 0.5 ? -1 : 1);
      bird.setAlpha(0);
      this.tweens.add({ targets: bird, alpha: 1, duration: 200 });
      this.birds.push(bird);
      this.nextBonusY -= Phaser.Math.FloatBetween(75, 100) * KS;
    }
  }

  update(time, delta) {
    Music.update();
    if (this.state === 'over') return;
    const dt = Math.min(delta, 50) / 1000;
    const cam = this.cameras.main;
    const t = time / 1000;
    this.now = time;

    // Antes de começar: o gato passeia pelo telhado, para e senta, e volta a andar.
    if (this.state === 'ready' && time > this.wanderAt) {
      let nx;
      do { nx = Phaser.Math.Between(50, W - 50); } while (Math.abs(nx - this.cat.x) < 90 * KS);
      this.targetX = nx;
      this.wanderAt = time + Phaser.Math.Between(3500, 5500);
    }

    if (this.keys.LEFT.isDown || this.keys.A.isDown) this.targetX = this.cat.x - 300;
    if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.targetX = this.cat.x + 300;
    this.targetX = Phaser.Math.Clamp(this.targetX, 24, W - 24);

    // Gato acelera até o alvo (com inércia, não teleporta). Empurrado pelo falcão: sem controle por um
    // instante, só deslizando para o lado e perdendo velocidade.
    if (time < this.knockUntil) {
      this.vx *= Math.max(0, 1 - dt * 2.5);
    } else {
      const maxSpeed = this.state === 'ready' ? WALK_SPEED : CAT_SPEED;
      const dx = this.targetX - this.cat.x;
      const desired = Phaser.Math.Clamp(dx * 8, -maxSpeed, maxSpeed);
      this.vx += (desired - this.vx) * Math.min(1, dt * 10);
    }
    const nextX = this.cat.x + this.vx * dt;
    this.cat.x = Phaser.Math.Clamp(nextX, 24, W - 24);
    if (nextX !== this.cat.x && time < this.knockUntil) this.vx = 0; // bateu na borda: para
    if (Math.abs(this.vx) > 15) this.setFacing(Math.sign(this.vx));

    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.cat.y += this.vy * dt;

      if (!this.groundGone && this.cat.y >= GROUND_Y - CAT_FOOT) {
        this.cat.y = GROUND_Y - CAT_FOOT;
        this.vy = 0;
        this.onGround = true;
        this.combo = 0;
        this.updateCombo();
        this.landUntil = time + 140;
      }
    }
    this.animateCat(time);
    this.updateTrail();

    // Altura (m) desta partida e a passagem pela linha de recorde
    if (this.state === 'playing') {
      const h = Math.max(0, Math.floor((GROUND_Y - CAT_FOOT - this.cat.y) / PX_PER_METER));
      if (h > this.maxHeight) this.maxHeight = h;
      if (this.bestLine && !this.passedBest && h > this.bestHeight) this.passBestLine();
    }

    for (const bird of this.birds) {
      if (bird.hit) continue;
      if (bird.skittish && !bird.dodged && this.state === 'playing') this.maybeDodge(bird);
      if (bird.vx) {
        bird.baseX += bird.vx * dt;
        if (bird.baseX < 40 || bird.baseX > W - 40) {
          bird.vx = -bird.vx;
          bird.baseX = Phaser.Math.Clamp(bird.baseX, 40, W - 40);
          this.face(bird, Math.sign(bird.vx));
        }
      }
      bird.x = bird.baseX;
      bird.y = bird.baseY + Math.sin(t * 2.5 + bird.phase) * 6;
      if (this.touches(bird, bird.r)) this.catchBird(bird);
    }

    for (const bird of this.goldens) {
      if (bird.hit) continue;
      bird.x += bird.vx * dt;
      bird.y = bird.baseY + Math.sin(t * 4 + bird.phase) * 10;
      if (this.touches(bird, 18)) this.catchGolden(bird);
    }

    for (const orb of this.orbs) {
      if (orb.hit) continue;
      orb.y = orb.baseY + Math.sin(t * 2 + orb.phase) * 8;
      orb.halo.setPosition(orb.x, orb.y);
      if (this.touches(orb, STAR_R)) this.catchOrb(orb);
    }

    this.updateHawks(time, dt, t);

    // Câmera sobe com o gato. Enquanto o telhado ainda existe, ela também desce para mostrar o gato
    // voltando ao telhado; depois disso, só sobe.
    const targetScroll = this.cat.y - H * CAMERA_ANCHOR;
    if (targetScroll < cam.scrollY) cam.scrollY = targetScroll;
    if (!this.groundGone) {
      const down = this.cat.y - H * 0.75;
      if (down > cam.scrollY) cam.scrollY = Math.min(down, 0);
    }
    this.stars.tilePositionY = cam.scrollY * 0.12;

    this.updateFrenzy(time, cam);

    // Quando o telhado sai da tela, cair é fim de jogo
    if (!this.groundGone && cam.scrollY + H < GROUND_Y - 200) this.groundGone = true;
    if (this.groundGone && this.cat.y > cam.scrollY + H + 60) {
      this.gameOver();
      return;
    }

    this.spawnBirds();
    this.cleanup(cam);
  }

  // Escolhe a animação/quadro do gato conforme o movimento.
  //   No ar: impulso → subindo → voo (topo do pulo) → descendo. Ao cair no telhado: aterrissagem.
  //   No telhado: andando (ciclo de 8 quadros, mais rápido quanto mais rápido ele anda) ou sentado.
  animateCat(time) {
    const speed = Math.abs(this.vx);
    // Histerese para não ficar alternando entre andar e sentar
    this.walking = this.onGround && (this.walking ? speed > 12 : speed > 30);

    if (time < this.landUntil) return this.showFrame('jump6');
    if (!this.onGround) {
      if (time < this.pushUntil) return this.showFrame('jump2');
      if (this.vy < -200) return this.showFrame('jump3');
      if (this.vy < 250) return this.showFrame('jump4');
      return this.showFrame('jump5');
    }
    if (this.walking) {
      this.nextIdleEvent = Math.max(this.nextIdleEvent, time + 1500); // ao parar, senta um pouco antes de piscar/lamber
      this.playAnim('walk');
      this.cat.anims.timeScale = Phaser.Math.Clamp(speed / WALK_SPEED, 0.7, 2.5);
      return;
    }

    // Sentado: rabo balançando, e de vez em quando pisca, dá uma piscadinha, lambe a pata ou olha para cima
    if (time < this.idleEventUntil) return;
    if (time > this.nextIdleEvent) {
      const total = IDLE_EVENTS.reduce((s, e) => s + e.weight, 0);
      let r = Math.random() * total;
      const ev = IDLE_EVENTS.find((e) => (r -= e.weight) < 0);
      this.showFrame(ev.frame);
      this.idleEventUntil = time + ev.ms;
      this.nextIdleEvent = time + ev.ms + Phaser.Math.Between(2000, 4500);
      return;
    }
    this.cat.anims.timeScale = 1;
    this.playAnim('idle');
  }

  showFrame(name) {
    if (this.cat.anims.isPlaying) this.cat.stop();
    const f = CAT.frame[name];
    if (this.cat.frame.name !== f) this.cat.setFrame(f);
  }

  playAnim(key) {
    if (!this.cat.anims.isPlaying || this.cat.anims.currentAnim.key !== key) this.cat.play(key);
  }

  // Os quadros olham para a direita. Ao virar, a origem é espelhada também,
  // para o gato girar em torno do próprio centro e não "pular" de lado.
  setFacing(dir) {
    if (dir === this.facing && this.cat.flipX === (dir < 0)) return;
    this.facing = dir;
    this.cat.setFlipX(dir < 0);
    this.cat.setOrigin(dir < 0 ? 1 - CAT.originX : CAT.originX, CAT.originY);
  }

  // Passarinho assustadiço: quando o gato chega perto por baixo, dá um pulinho para o lado (uma vez só).
  maybeDodge(bird) {
    const dx = bird.x - this.cat.x;
    const dy = bird.y - this.cat.y;
    if (dy > 10 || dy < -130 * KS || Math.abs(dx) > 110 * KS) return;
    bird.dodged = true;
    let dir = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
    const dist = Phaser.Math.FloatBetween(70, 100) * KS;
    if (bird.baseX + dir * dist < 40 || bird.baseX + dir * dist > W - 40) dir = -dir; // perto da parede: vai para o outro lado
    this.face(bird, dir);
    this.tweens.add({ targets: bird, baseX: Phaser.Math.Clamp(bird.baseX + dir * dist, 40, W - 40), duration: 260, ease: 'Cubic.easeOut' });
    this.dots.explode(4, bird.x, bird.y);
    const alert = pixelText(this, bird.x, bird.y - 26, '!', 2, 0xffffff).setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: alert, y: alert.y - 14, alpha: 0, duration: 450, onComplete: () => alert.destroy() });
  }

  // Falcões: a partir de HAWK_START_M, de tempos em tempos um "!" vermelho pisca na borda da tela e,
  // depois do aviso, o falcão atravessa na altura do aviso. Fica mais frequente e rápido lá no alto.
  updateHawks(time, dt, t) {
    if (this.state !== 'playing') return;
    const meters = (GROUND_Y - CAT_FOOT - this.cat.y) / PX_PER_METER;
    const k = Phaser.Math.Clamp((meters - HAWK_START_M) / 1000, 0, 1);

    if (meters >= HAWK_START_M && !this.frenzy) {
      if (!this.nextHawkAt) {
        this.nextHawkAt = time + 1500;
      } else if (time >= this.nextHawkAt) {
        this.warnHawk(time);
        const every = Phaser.Math.Linear(HAWK_EVERY_S[0], HAWK_EVERY_S[1], k);
        this.nextHawkAt = time + every * 1000 * Phaser.Math.FloatBetween(0.8, 1.2);
      }
    }

    // Avisos que chegaram ao fim: entra o falcão
    this.hawkWarnings = this.hawkWarnings.filter((w) => {
      if (time < w.at) return true;
      w.sign.destroy();
      this.spawnHawk(w.side, this.cameras.main.scrollY + w.screenY, k);
      return false;
    });

    for (const hawk of this.hawks) {
      hawk.x += hawk.vx * dt;
      hawk.y = hawk.baseY + Math.sin(t * 5 + hawk.phase) * 8;
      hawk.aura.setPosition(hawk.x, hawk.y);
      if (!hawk.hit && !this.frenzy && this.now >= this.hawkSafeUntil && this.touches(hawk, HAWK_R)) this.hitByHawk(hawk);
    }
  }

  warnHawk(time) {
    const side = Math.random() < 0.5 ? -1 : 1; // -1 = entra pela esquerda
    const screenY = H * Phaser.Math.FloatBetween(0.22, 0.48); // acima do gato, onde ele vai passar
    const sign = pixelText(this, side < 0 ? 22 : W - 22, screenY, '!', 5, 0xff5a4a)
      .setOrigin(0.5).setScrollFactor(0).setDepth(25);
    this.tweens.add({ targets: sign, alpha: 0.25, scale: 6, duration: 180, yoyo: true, repeat: -1 });
    this.hawkWarnings.push({ side, screenY, sign, at: time + HAWK_WARN_MS });
    Sfx.hawkWarn();
  }

  spawnHawk(side, y, k) {
    const hawk = this.add.sprite(side < 0 ? -40 : W + 40, y, 'hawkSheet').setDepth(4).setScale(HAWK_SCALE).play('hawkFly');
    hawk.setFlipX(side > 0); // os quadros olham para a direita
    hawk.vx = -side * Phaser.Math.Linear(HAWK_SPEED[0], HAWK_SPEED[1], k) * KS;
    hawk.baseY = y;
    hawk.phase = Math.random() * TAU;
    hawk.hit = false;
    // Brilho vermelho em volta: deixa claro que é perigo, não um passarinho
    hawk.aura = this.add.image(hawk.x, y, 'orb').setDepth(3).setTint(0xff3b30).setAlpha(0.55)
      .setScale(1.5).setBlendMode(Phaser.BlendModes.ADD);
    hawk.on('destroy', () => hawk.aura.destroy());
    this.hawks.push(hawk);
  }

  // Falcão acertou: empurra o gato para o lado (na direção em que o falcão voa) com um pulinho, tira o
  // controle por um instante e zera o combo. Ele continua podendo pegar passarinhos, então dá para se
  // recuperar. Por um momento não leva outro acerto.
  hitByHawk(hawk) {
    hawk.hit = true;
    this.knockUntil = this.now + KNOCK_MS;
    this.hawkSafeUntil = this.now + HAWK_SAFE_MS;
    this.vx = Math.sign(hawk.vx) * KNOCK_SPEED;
    this.vy = Math.min(this.vy, KNOCK_HOP); // se já estava subindo mais rápido, mantém
    this.onGround = false;
    this.combo = 0;
    this.updateCombo();
    Sfx.hawkHit();
    this.cameras.main.shake(180, 0.008);
    this.dots.explode(12, this.cat.x, this.cat.y);
    this.flashCat();
  }

  // Pisca em branco algumas vezes (entre as piscadas o gato aparece normal, olho amarelo)
  flashCat() {
    let n = 0;
    this.time.addEvent({
      delay: 70, repeat: 7,
      callback: () => {
        n++;
        if (n % 2) this.cat.setTintFill(0xffffff);
        else this.cat.clearTint();
      },
    });
  }

  // Rastro de luz suave: linha que afina e some atrás do gato (roxo e mais forte no frenesi).
  updateTrail() {
    this.trail.push({ x: this.cat.x, y: this.cat.y + 4 });
    if (this.trail.length > TRAIL_LEN) this.trail.shift();
    const g = this.trailGfx;
    g.clear();
    const color = this.frenzy ? FRENZY_COLOR : TRAIL_COLOR;
    const strength = this.frenzy ? 0.5 : 0.22;
    const n = this.trail.length;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      g.lineStyle(1 + 7 * f, color, strength * f * f);
      g.lineBetween(this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i].x, this.trail[i].y);
    }
  }

  catchOrb(orb) {
    orb.hit = true;
    // A estrela some e no lugar toca a animação de coleta (brilha, vira luz e se desfaz em faíscas)
    const burst = this.add.sprite(orb.x, orb.y, 'starCollect').setDepth(7).play('starCollect');
    burst.once('animationcomplete', () => burst.destroy());
    orb.destroy();
    this.frenzyDots.explode(30, burst.x, burst.y);
    const ring = this.add.image(burst.x, burst.y, 'ring').setDepth(6).setTint(FRENZY_COLOR).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 550, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    Sfx.powerUp();
    Music.setIntense(true);

    if (!this.frenzy) {
      this.frenzy = true;
      this.nextBonusY = this.cat.y - 110 * KS;
      this.lastBonusX = this.cat.x;
      this.tweens.add({ targets: [this.frenzyTint, this.frenzyLabel], alpha: 1, duration: 300 });
    }
    this.frenzyUntil = this.now + FRENZY_MS;
    this.combo++;
    this.updateCombo();
    this.bounce();
  }

  updateFrenzy(time, cam) {
    const g = this.frenzyBar;
    g.clear();
    if (!this.frenzy) return;

    const left = (this.frenzyUntil - time) / FRENZY_MS;
    if (left <= 0) {
      this.frenzy = false;
      // A próxima estrela só aparece bem acima de onde o frenesi terminou
      this.nextOrbY = Math.min(this.nextOrbY, this.nextY - Phaser.Math.FloatBetween(ORB_EVERY[0], ORB_EVERY[1]));
      Sfx.powerDown();
      Music.setIntense(false);
      this.tweens.add({ targets: [this.frenzyTint, this.frenzyLabel], alpha: 0, duration: 500 });
      return;
    }
    this.spawnBonusBirds(cam);

    // Barra com moldura, preenchimento roxo e um brilho em cima; pisca no último 1,5s
    const bw = 150;
    const bh = 10;
    const bx = W - 16 - bw;
    const by = SAFE_TOP + 42;
    g.fillStyle(0x07040f, 0.85).fillRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, 7);
    g.lineStyle(2, 0xd59bff, 0.8).strokeRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, 7);
    const fw = Math.max(bh, bw * left);
    g.fillStyle(0x9b3dff, 1).fillRoundedRect(bx, by, fw, bh, 5);
    g.fillStyle(0xe6c7ff, 0.9).fillRect(bx + 4, by + 2, Math.max(0, fw - 8), 2);
    const msLeft = this.frenzyUntil - time;
    g.setAlpha(msLeft < 1500 ? 0.55 + 0.45 * Math.abs(Math.sin(time / 90)) : 1);
  }

  // "COMBO XN" embaixo do placar a partir de 3 passarinhos seguidos
  updateCombo() {
    const c = this.comboText;
    if (this.combo >= 3) {
      c.setText(`${TEXT.combo} X${this.combo}`);
      this.tweens.killTweensOf(c);
      c.setAlpha(1).setScale(2.6);
      this.tweens.add({ targets: c, scale: 2, duration: 180, ease: 'Quad.easeOut' });
    } else if (c.alpha > 0) {
      this.tweens.killTweensOf(c);
      this.tweens.add({ targets: c, alpha: 0, duration: 250 });
    }
  }

  touches(obj, r) {
    const dx = obj.x - this.cat.x;
    const dy = obj.y - this.cat.y;
    const rr = r + CAT_R;
    return dx * dx + dy * dy < rr * rr;
  }

  catchBird(bird) {
    bird.hit = true;
    this.combo++;
    const pts = 10 * this.combo * (this.frenzy ? FRENZY_MULT : 1);
    const style = pointsStyle(this.combo, this.frenzy);
    this.addScore(pts, bird.x, bird.y - 20, `+${pts}`, style.tint, style.size);
    this.updateCombo();
    this.bounce();
    Sfx.catch(this.combo);
    (this.frenzy ? this.frenzyDots : this.dots).explode(7, bird.x, bird.y);
    this.impact(bird, this.frenzy ? FRENZY_COLOR : 0xffffff);
  }

  catchGolden(bird) {
    bird.hit = true;
    this.addScore(this.score, bird.x, bird.y - 20, 'X2!', 0xffd23f, 4);
    this.bounce();
    Sfx.golden();
    this.goldDots.explode(18, bird.x, bird.y);
    this.impact(bird, 0xffd23f);
  }

  // Anel de impacto, e o passarinho foge assustado (animação de fuga da spritesheet).
  impact(bird, color) {
    const ring = this.add.image(bird.x, bird.y, 'ring').setDepth(6).setTint(color).setScale(0.3).setAlpha(0.8);
    this.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });

    const dir = bird.x < this.cat.x ? -1 : 1;
    this.face(bird, dir);
    bird.play(`${bird.kind}Flee`);
    this.tweens.killTweensOf(bird);
    this.tweens.add({
      targets: bird, x: bird.x + dir * 150, y: bird.y - 170, alpha: 0, duration: 700, ease: 'Sine.easeIn',
      onComplete: () => bird.destroy(),
    });
  }

  bounce() {
    this.vy = this.frenzy ? FRENZY_BOUNCE_VY : BOUNCE_VY;
    this.onGround = false;
    this.pushUntil = this.now + 90; // quadro de impulso antes de esticar
  }

  // Soma os pontos: o placar dá um "pulo" e o valor salta do passarinho (cresce com o combo).
  addScore(pts, x, y, label, tint, size) {
    this.score += pts;
    this.scoreText.setText(String(this.score));
    // Só reinicia o "pulo" do placar (não mexe no fade de entrada do placar)
    if (this.scoreBump) this.scoreBump.stop();
    const base = this.score >= 1e6 ? 3 : 4; // a partir de 7 dígitos fica menor para não encostar no "FRENZY"
    this.scoreText.setScale(base * 1.15);
    this.scoreBump = this.tweens.add({ targets: this.scoreText, scale: base, duration: 160, ease: 'Quad.easeOut' });

    const txt = pixelText(this, x + Phaser.Math.Between(-8, 8), y, label, size * 0.4, tint)
      .setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: txt, scale: size, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: txt, y: y - 55, alpha: 0, delay: 280, duration: 600, ease: 'Sine.easeIn',
      onComplete: () => txt.destroy(),
    });
  }

  cleanup(cam) {
    const bottom = cam.scrollY + H + 100;
    const keep = (b) => {
      if (b.hit) return b.active;
      if (b.y > bottom || b.x < -80 || b.x > W + 80) { b.destroy(); return false; }
      return true;
    };
    this.birds = this.birds.filter(keep);
    this.goldens = this.goldens.filter(keep);
    this.orbs = this.orbs.filter(keep);
    // Falcão continua voando mesmo depois de acertar: some só quando sai da tela
    this.hawks = this.hawks.filter((h) => {
      if (h.y > bottom || h.x < -90 || h.x > W + 90) { h.destroy(); return false; }
      return true;
    });
  }

  gameOver() {
    this.state = 'over';
    this.hawkWarnings.forEach((w) => w.sign.destroy());
    this.hawkWarnings = [];
    Poki.gameplayStop();
    Sfx.meow();
    Music.setIntense(false);
    Music.duck(true);
    this.frenzyBar.clear();

    const isRecord = this.score > this.best;
    if (isRecord) {
      this.best = this.score;
      saveBest(this.best);
    }
    const isHeightRecord = this.maxHeight > this.bestHeight;
    if (isHeightRecord) {
      this.bestHeight = this.maxHeight;
      saveBestHeight(this.bestHeight);
    }
    Leaderboard.submit({ score: this.best, height: this.bestHeight });

    // Placar some; no lugar entra um cartão com a pontuação e o botão de jogar de novo.
    // Sem Container de propósito: objetos interativos dentro de um Container com
    // scrollFactor 0 recebem o clique na posição errada quando a câmera já subiu.
    this.tweens.add({ targets: [...this.hud, this.comboText, this.frenzyLabel], alpha: 0, duration: 200 });
    const fix = (o) => o.setScrollFactor(0).setDepth(30);
    const cy = H * 0.44;

    const overlay = fix(this.add.rectangle(0, 0, W, H, 0x05030f, 0.72).setOrigin(0)).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 300 });

    // Cartão: GAME OVER, pontuação, recorde, altura da partida, PLAY AGAIN e (se houver) RANKING
    const withRanking = Leaderboard.enabled;
    const cw = Math.min(380, W - 32);
    const top = -200;
    const bottom = withRanking ? 200 : 140;
    const chh = bottom - top;
    const card = fix(this.add.graphics({ x: W / 2, y: cy }));
    card.fillStyle(0x07040f, 0.9).fillRoundedRect(-cw / 2, top + 8, cw, chh, 24); // sombra
    card.fillStyle(0x1a1238, 1).fillRoundedRect(-cw / 2, top, cw, chh, 24);
    card.lineStyle(4, 0x8f6bd8, 1).strokeRoundedRect(-cw / 2, top, cw, chh, 24);
    card.lineStyle(2, 0x3a2a70, 1).strokeRoundedRect(-cw / 2 + 10, top + 10, cw - 20, chh - 20, 16);

    const items = [card];
    const text = (dy, str, size, tint) => {
      const t = fix(pixelText(this, W / 2, cy + dy, str, size, tint).setOrigin(0.5));
      items.push(t);
      return t;
    };
    text(-160, TEXT.gameOver, 4, 0xd59bff);
    text(-122, TEXT.score, 2, 0x8f88c0);
    const scoreStr = String(this.score);
    text(-76, scoreStr, Phaser.Math.Clamp(Math.floor((cw - 60) / (scoreStr.length * 8)), 3, 6));
    if (isRecord) {
      const nb = text(-20, TEXT.newBest, 3, 0xffd23f);
      this.tweens.add({ targets: nb, scale: 3.3, delay: 700, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      text(-20, `${TEXT.best} ${this.best}`, 2, 0x9d99c9);
    }
    const heightLine = `${TEXT.height} ${this.maxHeight} ${TEXT.meters}${isHeightRecord ? '  NEW!' : ''}`;
    text(18, heightLine, 2, isHeightRecord ? 0xffd23f : 0xb9a8ff);

    // Botão "PLAY AGAIN": sombra, corpo roxo, faixa de brilho e borda clara
    const btnDy = 84;
    const bw = 280;
    const bh = 66;
    const btnG = fix(this.add.graphics({ x: W / 2, y: cy + btnDy }));
    btnG.fillStyle(0x07040f, 1).fillRoundedRect(-bw / 2, -bh / 2 + 6, bw, bh, 20);
    btnG.fillStyle(0x8f3bff, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    btnG.fillStyle(0xb46bff, 1).fillRoundedRect(-bw / 2 + 8, -bh / 2 + 6, bw - 16, bh / 2 - 8, 12);
    btnG.lineStyle(3, 0xe6c7ff, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    items.push(btnG);
    const btnT = text(btnDy, TEXT.playAgain, 3);
    if (withRanking) {
      const [g, t] = this.makeButton(W / 2, cy + 156, 190, 46, TEXT.ranking, { depth: 30, onPress: () => this.openRanking('score') });
      items.push(g, t);
    }

    // Entrada: cada item sobe e aparece, um atrás do outro
    items.forEach((o, i) => {
      const y = o.y;
      o.setAlpha(0).setY(y + 30);
      this.tweens.add({ targets: o, alpha: 1, y, duration: 420, delay: 100 + i * 45, ease: 'Back.easeOut' });
    });
    const pulse = () => {
      this.tweens.add({ targets: btnG, scale: 1.04, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: btnT, scale: 3.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    this.time.delayedCall(100 + items.length * 45 + 420, pulse);

    const btn = this.add.zone(W / 2, cy + btnDy, bw, bh).setScrollFactor(0).setInteractive({ useHandCursor: true });
    const restart = () => {
      btn.disableInteractive();
      this.tweens.killTweensOf([btnG, btnT]);
      this.tweens.add({ targets: btnG, scale: 0.92, duration: 90, yoyo: true });
      this.tweens.add({ targets: btnT, scale: 2.76, duration: 90, yoyo: true });
      // Anúncio entre partidas: muta o som enquanto passa e reinicia quando terminar.
      Poki.commercialBreak(() => {
        Sfx.setMuted(true);
        Music.setMuted(true);
      }).then(() => {
        Sfx.setMuted(false);
        Music.setMuted(false);
        this.scene.restart();
      });
    };
    btn.on('pointerdown', restart);
    this.input.keyboard.once('keydown-ENTER', restart);
  }

  // Tela de ranking: abas SCORE / HEIGHT, Top 10, a linha do jogador destacada e, se ele estiver
  // fora do Top 10, a posição dele embaixo.
  openRanking(kind) {
    this.closeRanking();
    const depth = 40;
    const ui = [];
    const fix = (o) => {
      o.setScrollFactor(0).setDepth(depth);
      ui.push(o);
      return o;
    };
    const pw = Math.min(380, W - 24);
    const ph = Math.min(620, H - 60 - SAFE_TOP);
    const cx = W / 2;
    const cy = SAFE_TOP + (H - SAFE_TOP) / 2;
    const left = cx - pw / 2;
    const right = cx + pw / 2;
    const top = cy - ph / 2;

    fix(this.add.rectangle(0, 0, W, H, 0x05030f, 0.82).setOrigin(0)).setInteractive(); // bloqueia cliques atrás
    const panel = fix(this.add.graphics({ x: cx, y: cy }));
    panel.fillStyle(0x1a1238, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    panel.lineStyle(4, 0x8f6bd8, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    fix(pixelText(this, cx, top + 40, TEXT.ranking, 4, 0xd59bff).setOrigin(0.5));

    [['score', TEXT.score], ['height', TEXT.height]].forEach(([key, label], i) => {
      const onPress = () => { if (key !== kind) this.openRanking(key); };
      ui.push(...this.makeButton(cx + (i === 0 ? -80 : 80), top + 96, 150, 44, label, { filled: key === kind, depth, onPress }));
    });
    ui.push(...this.makeButton(cx, top + ph - 44, 190, 48, TEXT.back, { depth, onPress: () => this.closeRanking() }));

    const listTop = top + 146;
    const rowH = 30;
    const status = fix(pixelText(this, cx, listTop + 120, TEXT.loading, 2, 0x9d99c9).setOrigin(0.5));
    this.rankUI = ui;
    const token = {};
    this.rankToken = token;

    const fmt = (v) => (kind === 'height' ? `${v} ${TEXT.meters}` : String(v));
    const RANK_COLORS = [0xffd23f, 0xd8d8f0, 0xe0995a]; // ouro, prata, bronze
    const row = (y, rank, name, value, isMe) => {
      if (isMe) {
        fix(this.add.graphics()).fillStyle(0x8f3bff, 0.35).fillRoundedRect(left + 10, y - rowH / 2 + 2, pw - 20, rowH - 4, 8);
      }
      const color = isMe ? 0xffd23f : 0xffffff;
      fix(pixelText(this, left + 56, y, String(rank), 2, RANK_COLORS[rank - 1] || 0xb9a8ff).setLetterSpacing(-1).setOrigin(1, 0.5));
      fix(pixelText(this, left + 68, y, name, 2, color).setLetterSpacing(-1).setOrigin(0, 0.5));
      fix(pixelText(this, right - 18, y, fmt(value), 2, color).setLetterSpacing(-1).setOrigin(1, 0.5));
    };

    Leaderboard.board(kind, 10).then(({ rows, mine }) => {
      if (this.rankToken !== token) return; // fechou ou trocou de aba enquanto carregava
      status.setText(TEXT.empty).setVisible(rows.length === 0);
      rows.forEach((r, i) => row(listTop + i * rowH, i + 1, r.name, r[kind], r.me));
      if (mine && mine.rank > rows.length) {
        fix(pixelText(this, cx, listTop + rows.length * rowH + 2, '...', 2, 0x9d99c9).setOrigin(0.5));
        row(listTop + (rows.length + 1) * rowH, mine.rank, mine.name, mine.value, true);
      }
    }).catch(() => {
      if (this.rankToken === token) status.setText(TEXT.unavailable);
    });
  }

  closeRanking() {
    if (!this.rankUI) return;
    this.rankUI.forEach((o) => o.destroy());
    this.rankUI = null;
    this.rankToken = null;
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0b0b24',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Game],
});
