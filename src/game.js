// Jogo em retrato (pensado para celular; no desktop aparece centralizado com bordas).
const W = 480;
const H = 820;
const GROUND_Y = H - 70;
const CAT_R = 20;
const CAT_SCALE = 1;         // a arte já vem no tamanho do jogo (~60px de altura)
const CAMERA_ANCHOR = 0.55; // altura da tela (0 = topo) onde a câmera segura o gato

// Dificuldade
const CAT_SPEED = 560;       // velocidade horizontal máxima do gato
const WALK_SPEED = 110;      // velocidade do passeio no telhado antes de começar
const GAP_MIN = 150;         // distância vertical entre passarinhos...
const GAP_MAX = 190;
const GAP_GROW = 110;        // ...e quanto ela aumenta lá no alto
const DX_MAX = 230;          // distância horizontal máxima entre passarinhos seguidos

// Pulo alto: ~450px e quase 1s subindo, então sobra bastante tempo no ar entre um passarinho e outro.
const GRAVITY = 1100;        // px/s²
const BOUNCE_VY = -1000;     // impulso ao pegar um passarinho
const GROUND_JUMP_VY = -900;

// Frenesi: a estrela roxa ativa uma trilha de passarinhos fáceis, pontos em dobro e pulo mais forte.
const FRENZY_MS = 6000;
const FRENZY_BOUNCE_VY = -1250;
const FRENZY_MULT = 2;
const ORB_EVERY = [3500, 5000]; // intervalo de altura (px) entre uma estrela e outra
const STAR_R = 22;              // raio de coleta da estrela

// Visual
const TRAIL_COLOR = 0xf3efe6;
const FRENZY_COLOR = 0xc77dff;  // roxo da estrela: tom da tela, rastro e pássaros do frenesi
const STAR_PARTICLES = [0xb14dff, 0xd59bff, 0x8f3bff, 0xf0d6ff];
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
  }

  create() {
    makeTextures(this);
    makePixelFont(this);
    makeLogo(this);
    setupCat(this);
    for (const key of ['starSpin', 'starCollect']) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.anims.create({ key: 'starSpin', frames: this.anims.generateFrameNumbers('starSpin'), frameRate: 14, repeat: -1 });
    this.anims.create({ key: 'starCollect', frames: this.anims.generateFrameNumbers('starCollect'), frameRate: 18 });
    Poki.init().then(() => {
      Poki.loadingFinished();
      this.scene.start('Game');
    });
  }
}

class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.state = 'ready'; // ready | playing | over
    this.score = 0;
    this.combo = 0;
    this.best = loadBest();
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
    this.nextY = GROUND_Y - 220;
    this.lastX = W / 2;
    this.nextOrbY = GROUND_Y - Phaser.Math.Between(1800, 2400);
    this.frenzy = false;
    this.frenzyUntil = 0;
    this.trail = [];

    this.createBackground();

    this.trailGfx = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.cat = this.add.sprite(W / 2, GROUND_Y - CAT_FOOT, 'catSheet', CAT.frame.sit0)
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
    this.input.on('pointerdown', (p) => {
      this.targetX = p.x;
      Sfx.unlock();
      this.tryJump();
    });
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,A,D');
    this.input.keyboard.on('keydown-SPACE', () => { Sfx.unlock(); this.tryJump(); });
    this.input.keyboard.on('keydown-UP', () => { Sfx.unlock(); this.tryJump(); });
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
    this.scoreText = fix(pixelText(this, 18, 14, '0', 4));
    this.bestText = fix(pixelText(this, 20, 58, `${TEXT.best} ${this.best}`, 2, 0x9d99c9));
    this.comboText = fix(pixelText(this, 20, 82, '', 2, 0xffd23f)).setAlpha(0);
    this.hud = [this.scoreText, this.bestText];
    this.hud.forEach((o) => o.setAlpha(0));

    this.frenzyLabel = fix(pixelText(this, W - 16, 14, `${TEXT.frenzy} X${FRENZY_MULT}`, 2, 0xd59bff))
      .setOrigin(1, 0).setAlpha(0);
    this.frenzyBar = this.add.graphics().setScrollFactor(0).setDepth(20);

    this.createTitle();
  }

  // Tela inicial: logo PAWNCE com as letras balançando em onda, patinha "carimbada" ao lado,
  // recorde e instruções.
  createTitle() {
    const fix = (o) => o.setScrollFactor(0).setDepth(20);
    const letters = [...TEXT.title];
    const scale = 7;
    const step = 8 * scale;
    const x0 = W / 2 - ((letters.length - 1) * step) / 2 - 28; // um pouco para a esquerda, abrindo espaço para a patinha
    const y0 = 190;
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
    const pawX = x0 + (letters.length - 1) * step + 66;
    const pawY = y0 - 22;
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
      fix(pixelText(this, W / 2, y0 + 64, TEXT.tagline, 2, 0xb9a8ff).setLetterSpacing(-1).setOrigin(0.5)),
    ];
    if (this.best > 0) sub.push(fix(pixelText(this, W / 2, y0 + 94, `${TEXT.best} ${this.best}`, 2, 0xffd23f).setOrigin(0.5)));
    const tap = fix(pixelText(this, W / 2, H * 0.53, TEXT.tapToJump, 4).setOrigin(0.5));
    const drag = fix(pixelText(this, W / 2, H * 0.53 + 42, TEXT.dragToMove, 2, 0x9d99c9).setOrigin(0.5));
    sub.push(tap, drag);
    sub.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: sub, alpha: 1, delay: 800, duration: 400 });
    this.tweens.add({ targets: tap, scale: 4.25, delay: 1200, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.title.push(...sub);
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
      this.tweens.add({ targets: this.hud, alpha: 1, duration: 300, delay: 150 });
      Poki.gameplayStart();
    }
    if (this.onGround) {
      this.onGround = false;
      this.vy = GROUND_JUMP_VY;
      this.pushUntil = this.now + 90;
    }
  }

  makeBird(x, y, kind, size) {
    const body = this.add.image(0, 0, `${kind}_body`);
    const wing = this.add.image(4, -1, `${kind}_wing`).setOrigin(0.9, 0.5);
    const bird = this.add.container(x, y, [body, wing]).setDepth(3);
    bird.wing = wing;
    bird.size = size;
    bird.flapT = Math.random() * TAU;
    bird.flapSpeed = 13;
    bird.phase = Math.random() * TAU;
    bird.hit = false;
    bird.vx = 0;
    return bird;
  }

  face(bird, dir) {
    bird.dir = dir;
    bird.setScale(dir * bird.size, bird.size);
  }

  spawnBirds() {
    const top = this.cameras.main.scrollY - 300;
    while (this.nextY > top) {
      const height = GROUND_Y - this.nextY;
      const diff = Math.min(height / 20000, 1); // 0 → 1 conforme sobe

      // Próximo passarinho longe do anterior, mas sempre alcançável.
      const dxMax = DX_MAX * (0.55 + 0.45 * diff);
      const off = Phaser.Math.FloatBetween(dxMax * 0.35, dxMax);
      let x = this.lastX + (Math.random() < 0.5 ? -off : off);
      if (x < 40 || x > W - 40) x = this.lastX * 2 - x;
      x = Phaser.Math.Clamp(x, 40, W - 40);
      this.lastX = x;

      const size = 1 - diff * 0.25;
      const bird = this.makeBird(x, this.nextY, 'bird', size);
      bird.baseX = x;
      bird.baseY = this.nextY;
      bird.r = 17 * size;
      // Mais alto, mais passarinhos voam de um lado para o outro.
      bird.vx = Math.random() < diff * 0.8 ? Phaser.Math.Between(40, 110) * (1 + diff) * (Math.random() < 0.5 ? -1 : 1) : 0;
      this.face(bird, bird.vx ? Math.sign(bird.vx) : (Math.random() < 0.5 ? -1 : 1));
      this.birds.push(bird);

      const gap = Phaser.Math.Between(GAP_MIN, GAP_MAX) + diff * GAP_GROW;
      if (height > 1200 && Math.random() < 0.06) this.spawnGolden(this.nextY - gap / 2);
      // Estrela do frenesi no meio do caminho entre este passarinho e o próximo (nunca durante um frenesi)
      if (!this.frenzy && this.nextY < this.nextOrbY) {
        this.spawnOrb(Phaser.Math.Clamp(x + Phaser.Math.Between(-70, 70), 40, W - 40), this.nextY - gap / 2);
        this.nextOrbY -= Phaser.Math.Between(ORB_EVERY[0], ORB_EVERY[1]);
      }
      this.nextY -= gap;
    }
  }

  // Passarinho dourado atravessa a tela rápido e dobra a pontuação.
  spawnGolden(y) {
    const fromLeft = Math.random() < 0.5;
    const bird = this.makeBird(fromLeft ? -30 : W + 30, y, 'gold', 1);
    bird.vx = (fromLeft ? 1 : -1) * Phaser.Math.Between(160, 240);
    bird.baseY = y;
    bird.flapSpeed = 18;
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
      const x = Phaser.Math.Clamp(this.lastBonusX + Phaser.Math.FloatBetween(-110, 110), 40, W - 40);
      this.lastBonusX = x;
      const bird = this.makeBird(x, this.nextBonusY, 'bonus', 0.9);
      bird.baseX = x;
      bird.baseY = this.nextBonusY;
      bird.r = 18;
      bird.flapSpeed = 16;
      this.face(bird, Math.random() < 0.5 ? -1 : 1);
      bird.setAlpha(0);
      this.tweens.add({ targets: bird, alpha: 1, duration: 200 });
      this.birds.push(bird);
      this.nextBonusY -= Phaser.Math.Between(75, 100);
    }
  }

  update(time, delta) {
    if (this.state === 'over') return;
    const dt = Math.min(delta, 50) / 1000;
    const cam = this.cameras.main;
    const t = time / 1000;
    this.now = time;

    // Antes de começar: o gato passeia pelo telhado, para e senta, e volta a andar.
    if (this.state === 'ready' && time > this.wanderAt) {
      let nx;
      do { nx = Phaser.Math.Between(50, W - 50); } while (Math.abs(nx - this.cat.x) < 90);
      this.targetX = nx;
      this.wanderAt = time + Phaser.Math.Between(3500, 5500);
    }

    if (this.keys.LEFT.isDown || this.keys.A.isDown) this.targetX = this.cat.x - 300;
    if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.targetX = this.cat.x + 300;
    this.targetX = Phaser.Math.Clamp(this.targetX, 24, W - 24);

    // Gato acelera até o alvo (com inércia, não teleporta)
    const maxSpeed = this.state === 'ready' ? WALK_SPEED : CAT_SPEED;
    const dx = this.targetX - this.cat.x;
    const desired = Phaser.Math.Clamp(dx * 8, -maxSpeed, maxSpeed);
    this.vx += (desired - this.vx) * Math.min(1, dt * 10);
    this.cat.x = Phaser.Math.Clamp(this.cat.x + this.vx * dt, 24, W - 24);
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

    for (const bird of [...this.birds, ...this.goldens]) {
      bird.flapT += dt * bird.flapSpeed;
      bird.wing.rotation = Math.sin(bird.flapT) * 0.85;
    }

    for (const bird of this.birds) {
      if (bird.hit) continue;
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

    if (!this.frenzy) {
      this.frenzy = true;
      this.nextBonusY = this.cat.y - 110;
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
      this.nextOrbY = Math.min(this.nextOrbY, this.nextY - Phaser.Math.Between(ORB_EVERY[0], ORB_EVERY[1]));
      Sfx.powerDown();
      this.tweens.add({ targets: [this.frenzyTint, this.frenzyLabel], alpha: 0, duration: 500 });
      return;
    }
    this.spawnBonusBirds(cam);

    // Barra com moldura, preenchimento roxo e um brilho em cima; pisca no último 1,5s
    const bw = 150;
    const bh = 10;
    const bx = W - 16 - bw;
    const by = 42;
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

  // Anel de impacto, e o passarinho foge batendo as asas rápido.
  impact(bird, color) {
    const ring = this.add.image(bird.x, bird.y, 'ring').setDepth(6).setTint(color).setScale(0.3).setAlpha(0.8);
    this.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });

    const dir = bird.x < this.cat.x ? -1 : 1;
    this.face(bird, dir);
    bird.flapSpeed = 34;
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
    this.scoreText.setScale(4.6);
    this.scoreBump = this.tweens.add({ targets: this.scoreText, scale: 4, duration: 160, ease: 'Quad.easeOut' });

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
  }

  gameOver() {
    this.state = 'over';
    Poki.gameplayStop();
    Sfx.meow();
    this.frenzyBar.clear();

    const isRecord = this.score > this.best;
    if (isRecord) {
      this.best = this.score;
      saveBest(this.best);
    }

    // Placar some; no lugar entra um cartão com a pontuação e o botão de jogar de novo.
    // Sem Container de propósito: objetos interativos dentro de um Container com
    // scrollFactor 0 recebem o clique na posição errada quando a câmera já subiu.
    this.tweens.add({ targets: [...this.hud, this.comboText, this.frenzyLabel], alpha: 0, duration: 200 });
    const fix = (o) => o.setScrollFactor(0).setDepth(30);
    const cy = H * 0.44;

    const overlay = fix(this.add.rectangle(0, 0, W, H, 0x05030f, 0.72).setOrigin(0)).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 300 });

    const cw = 380;
    const chh = 370;
    const card = fix(this.add.graphics({ x: W / 2, y: cy }));
    card.fillStyle(0x07040f, 0.9).fillRoundedRect(-cw / 2, -chh / 2 + 8, cw, chh, 24); // sombra
    card.fillStyle(0x1a1238, 1).fillRoundedRect(-cw / 2, -chh / 2, cw, chh, 24);
    card.lineStyle(4, 0x8f6bd8, 1).strokeRoundedRect(-cw / 2, -chh / 2, cw, chh, 24);
    card.lineStyle(2, 0x3a2a70, 1).strokeRoundedRect(-cw / 2 + 10, -chh / 2 + 10, cw - 20, chh - 20, 16);

    const items = [card];
    const text = (dy, str, size, tint) => {
      const t = fix(pixelText(this, W / 2, cy + dy, str, size, tint).setOrigin(0.5));
      items.push(t);
      return t;
    };
    text(-135, TEXT.gameOver, 4, 0xd59bff);
    text(-80, TEXT.score, 2, 0x8f88c0);
    const scoreStr = String(this.score);
    text(-38, scoreStr, Phaser.Math.Clamp(Math.floor(320 / (scoreStr.length * 8)), 3, 6));
    if (isRecord) {
      const nb = text(28, TEXT.newBest, 3, 0xffd23f);
      this.tweens.add({ targets: nb, scale: 3.3, delay: 700, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      text(28, `${TEXT.best} ${this.best}`, 2, 0x9d99c9);
    }

    // Botão "PLAY AGAIN": sombra, corpo roxo, faixa de brilho e borda clara
    const btnDy = 112;
    const bw = 280;
    const bh = 66;
    const btnG = fix(this.add.graphics({ x: W / 2, y: cy + btnDy }));
    btnG.fillStyle(0x07040f, 1).fillRoundedRect(-bw / 2, -bh / 2 + 6, bw, bh, 20);
    btnG.fillStyle(0x8f3bff, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    btnG.fillStyle(0xb46bff, 1).fillRoundedRect(-bw / 2 + 8, -bh / 2 + 6, bw - 16, bh / 2 - 8, 12);
    btnG.lineStyle(3, 0xe6c7ff, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    items.push(btnG);
    const btnT = text(btnDy, TEXT.playAgain, 3);

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
      Poki.commercialBreak(() => Sfx.setMuted(true)).then(() => {
        Sfx.setMuted(false);
        this.scene.restart();
      });
    };
    btn.on('pointerdown', restart);
    this.input.keyboard.once('keydown-ENTER', restart);
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
