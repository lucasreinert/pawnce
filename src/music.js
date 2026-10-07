// Música do jogo, composta em código com Web Audio (sem arquivos de áudio).
// Um sequenciador toca duas camadas na mesma progressão (Am – F – C – G, 4 compassos em loop):
//   - calma: caixinha de música em arpejo, baixo suave, melodia a cada duas voltas, chimbal leve
//   - intensa (frenesi): bumbo, caixa, chimbal, baixo pulsante, arpejo rápido e a melodia marcada
// No frenesi o andamento também acelera; as camadas trocam com um fade.
const Music = (() => {
  const TEMPO_CALM = 104;
  const TEMPO_INTENSE = 138;
  const STEPS = 64;               // 4 compassos de 16 semicolcheias
  const LOOKAHEAD = 0.12;         // segundos agendados à frente
  const VOLUME = 0.9;             // volume geral da música (os efeitos sonoros ficam por cima)
  const DUCKED = 0.35;            // volume na tela de fim de jogo

  // Acordes por compasso (MIDI) e baixo
  const CHORDS = [
    { tones: [57, 60, 64], bass: 45 }, // Am
    { tones: [53, 57, 60], bass: 41 }, // F
    { tones: [60, 64, 67], bass: 48 }, // C
    { tones: [55, 59, 62], bass: 43 }, // G
  ];
  // Melodia em lá menor pentatônica: passo → nota MIDI
  const MELODY = {
    0: 76, 6: 74, 8: 72, 12: 69,
    16: 72, 22: 69, 24: 72, 28: 74,
    32: 76, 38: 79, 40: 76, 44: 74,
    48: 74, 52: 71, 56: 67, 60: 69,
  };
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3]; // índices no acorde (3 = tônica uma oitava acima)

  let ctx = null;
  let master = null;
  let calmBus = null;
  let intenseBus = null;
  let noise = null;
  let timer = null;
  let step = 0;
  let loop = 0;
  let nextTime = 0;
  let intense = false;
  let muted = false;
  let ducked = false;

  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function setup(c) {
    ctx = c;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    calmBus = ctx.createGain();
    calmBus.gain.value = 1;
    calmBus.connect(master);

    // A camada intensa passa por um passa-baixa para as ondas quadradas não ficarem ásperas
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 3200;
    soften.connect(master);
    intenseBus = ctx.createGain();
    intenseBus.gain.value = 0;
    intenseBus.connect(soften);

    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Aba escondida: pausa o áudio (e não agenda notas atrasadas quando voltar)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume().then(() => { nextTime = ctx.currentTime + 0.05; });
    });
  }

  function note(bus, freq, t, dur, vol, type = 'sine', attack = 0.005) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function hit(bus, t, dur, vol, filterType, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function kick(t) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(intenseBus);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  function scheduleStep(s, t, stepDur) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const chord = CHORDS[bar];
    const tone = (i) => (i === 3 ? chord.tones[0] + 12 : chord.tones[i]);

    // --- calma ---
    if (inBar % 2 === 0) note(calmBus, midi(tone(ARP[inBar / 2]) + 12), t, 0.6, 0.042, 'triangle');
    if (inBar === 0 || inBar === 8) note(calmBus, midi(chord.bass), t, stepDur * 7, 0.11, 'sine', 0.02);
    if (inBar % 4 === 2) hit(calmBus, t, 0.03, 0.016, 'highpass', 7000);
    if (loop % 2 === 1 && MELODY[s]) {
      note(calmBus, midi(MELODY[s]), t, 0.9, 0.065, 'sine');
      note(calmBus, midi(MELODY[s] + 12), t, 0.4, 0.016, 'sine');
    }

    // --- intensa (só agenda enquanto está audível) ---
    if (!intense && intenseBus.gain.value < 0.01) return;
    if (inBar % 4 === 0) kick(t);
    if (inBar === 4 || inBar === 12) hit(intenseBus, t, 0.14, 0.13, 'bandpass', 1800);
    if (inBar % 2 === 1) hit(intenseBus, t, 0.03, 0.035, 'highpass', 8000);
    if (inBar % 2 === 0) note(intenseBus, midi(chord.bass + (inBar % 4 === 2 ? 12 : 0)), t, stepDur * 1.6, 0.07, 'square');
    note(intenseBus, midi(tone(ARP[inBar % 8]) + 12 + (inBar >= 8 ? 12 : 0)), t, stepDur * 0.9, 0.03, 'square');
    if (MELODY[s]) note(intenseBus, midi(MELODY[s]), t, stepDur * 2.2, 0.05, 'square');
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05; // voltou de uma pausa
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const stepDur = 60 / (intense ? TEMPO_INTENSE : TEMPO_CALM) / 4;
      scheduleStep(step, nextTime, stepDur);
      nextTime += stepDur;
      step = (step + 1) % STEPS;
      if (step === 0) loop++;
    }
  }

  function fadeTo(param, value, time = 0.6) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + time);
  }

  const targetVolume = () => (muted ? 0 : ducked ? VOLUME * DUCKED : VOLUME);

  return {
    // Chamado a cada quadro do jogo: agenda as próximas notas. (O timer interno é só um reforço,
    // porque o navegador pode deixar timers mais lentos; o quadro do jogo é o relógio mais confiável.)
    update() {
      if (timer) tick();
    },

    // Começa a tocar (precisa vir depois de um toque/clique do jogador). Chamadas repetidas não fazem nada.
    start() {
      if (timer) return;
      const c = Sfx.context();
      if (!c) return;
      setup(c);
      nextTime = ctx.currentTime + 0.05;
      timer = setInterval(tick, 25);
      fadeTo(master.gain, targetVolume(), 1.5);
    },

    // Frenesi: troca para a camada intensa (e mais rápida), ou volta à calma
    setIntense(on) {
      if (!ctx || intense === on) return;
      intense = on;
      fadeTo(intenseBus.gain, on ? 1 : 0, on ? 0.25 : 0.8);
      fadeTo(calmBus.gain, on ? 0.45 : 1, 0.6);
    },

    // Volume mais baixo (tela de fim de jogo)
    duck(on) {
      ducked = on;
      if (ctx) fadeTo(master.gain, targetVolume(), 0.5);
    },

    // Sem som durante os anúncios
    setMuted(m) {
      muted = m;
      if (ctx) fadeTo(master.gain, targetVolume(), 0.15);
    },
  };
})();
