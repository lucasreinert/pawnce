// Arte do cenário em estilo minimalista: formas lisas e poucas cores.
// (Gato, passarinhos e estrela são pixel art em assets/; o gato e os passarinhos são montados por
// tools/build_cat_sheet.py e tools/build_bird_sheets.py.)

const TAU = Math.PI * 2;

const PALETTE = {
  skyTop: '#0b0b24',
  skyBottom: '#2a2250',
  cityFar: '#1f1a45',
  cityNear: '#15112f',
  roof: '#0b091c',
  moon: '#f4efe1',
  window: '255, 214, 140', // luz das janelas (rgb)
};

function canvasTex(scene, key, w, h, draw) {
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
}

function drawSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawStars(ctx, w, h) {
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 0.8, 0, TAU);
    ctx.fill();
  }
}

function drawMoon(ctx, w, h) {
  const c = w / 2;
  const halo = ctx.createRadialGradient(c, c, 30, c, c, c);
  halo.addColorStop(0, 'rgba(244, 239, 225, 0.12)');
  halo.addColorStop(1, 'rgba(244, 239, 225, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = PALETTE.moon;
  ctx.beginPath();
  ctx.arc(c, c, 32, 0, TAU);
  ctx.fill();
}

function drawSkyline(ctx, w, h, color, minH, maxH, windowAlpha) {
  let x = -10;
  while (x < w) {
    const bw = 50 + Math.random() * 60;
    const bh = minH + Math.random() * (maxH - minH);
    const top = h - bh;
    ctx.fillStyle = color;
    ctx.fillRect(x, top, bw, bh);
    if (Math.random() < 0.3) ctx.fillRect(x + bw * 0.3, top - 12, 14, 12);
    // Janelas acesas, poucas e pequenas
    for (let wy = top + 12; wy < h - 10; wy += 18) {
      for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
        if (Math.random() < 0.22) {
          ctx.fillStyle = `rgba(${PALETTE.window}, ${windowAlpha * (0.6 + Math.random() * 0.4)})`;
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    x += bw + 4 + Math.random() * 16;
  }
}

function drawOrb(ctx, w) {
  const c = w / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.18, 'rgba(255, 220, 245, 1)');
  g.addColorStop(0.35, 'rgba(255, 138, 216, 0.55)');
  g.addColorStop(1, 'rgba(255, 138, 216, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
}

// Telhado liso com chaminé e antena. O topo do telhado fica em y = ROOF_TOP.
const ROOF_TOP = 80;
function drawRoof(ctx, w, h) {
  ctx.fillStyle = PALETTE.roof;
  ctx.strokeStyle = PALETTE.roof;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(90, ROOF_TOP);
  ctx.lineTo(90, 22);
  ctx.moveTo(72, 36);
  ctx.lineTo(108, 36);
  ctx.stroke();
  ctx.fillRect(360, 26, 40, ROOF_TOP - 26);
  ctx.fillRect(355, 20, 50, 8);
  ctx.fillRect(0, ROOF_TOP, w, h - ROOF_TOP);
}

function makeTextures(scene) {
  canvasTex(scene, 'orb', 72, 72, drawOrb); // brilho atrás da estrela do frenesi

  canvasTex(scene, 'sky', 480, 820, drawSky);
  canvasTex(scene, 'stars', 256, 256, drawStars);
  canvasTex(scene, 'moon', 140, 140, drawMoon);
  canvasTex(scene, 'skyline_far', 480, 300, (ctx, w, h) => drawSkyline(ctx, w, h, PALETTE.cityFar, 120, 280, 0.35));
  canvasTex(scene, 'skyline_near', 480, 220, (ctx, w, h) => drawSkyline(ctx, w, h, PALETTE.cityNear, 70, 200, 0.85));
  canvasTex(scene, 'roof', 480, 260, drawRoof);

  canvasTex(scene, 'dot', 8, 8, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 4, 4, 0, TAU);
    ctx.fill();
  });
  canvasTex(scene, 'ring', 64, 64, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, TAU);
    ctx.stroke();
  });
}
