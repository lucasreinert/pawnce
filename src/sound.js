// Efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio).
const Sfx = (() => {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, vol, type = 'sine', delay = 0, freqEnd = null) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Piado: um "piu" curto que desliza para o agudo e cai um pouquinho no fim.
  function chirp(f0, f1, dur, vol, delay = 0) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    osc.frequency.exponentialRampToValueAtTime(f1 * 0.85, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Bater de asas: ruído filtrado com algumas "batidas" de volume ("frrr").
  let noise = null;
  function flutter(dur, vol, beats = 4, delay = 0) {
    const c = ensure();
    if (!c || muted) return;
    if (!noise) {
      noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noise;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(1900, t);
    band.frequency.exponentialRampToValueAtTime(900, t + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < beats; i++) {
      const bt = t + (i * dur) / beats;
      gain.gain.exponentialRampToValueAtTime(vol * (1 - (i / beats) * 0.6), bt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, bt + (dur / beats) * 0.9);
    }
    src.connect(band).connect(gain).connect(c.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Patada: "tum" grave e curto do gato acertando o passarinho.
  const thump = (vol = 0.09) => tone(170, 0.09, vol, 'sine', 0, 65);

  // Escala pentatônica: a cada passarinho seguido o piado fica um pouco mais agudo.
  const STEPS = [0, 2, 4, 7, 9];
  const chirpFor = (combo) => {
    const n = Math.max(0, combo - 1);
    const semis = Math.min(12 * Math.floor(n / 5) + STEPS[n % 5], 14);
    return 1250 * Math.pow(2, semis / 12);
  };

  return {
    unlock() { ensure(); },
    setMuted(m) { muted = m; },
    context() { return ensure(); }, // mesmo AudioContext para a música (src/music.js)

    // Pegar passarinho: patada + bater de asas + "piu-piu"
    catch(combo) {
      const f = chirpFor(combo);
      thump();
      flutter(0.16, 0.05);
      chirp(f, f * 1.5, 0.07, 0.06, 0.01);
      chirp(f * 1.12, f * 1.7, 0.06, 0.05, 0.085);
    },

    // Passarinho dourado: patada mais forte, asas mais longas e um trinado de três piados
    golden() {
      thump(0.11);
      flutter(0.24, 0.06, 6);
      [0, 4, 7].forEach((s, i) => {
        const f = 1600 * Math.pow(2, s / 12);
        chirp(f, f * 1.6, 0.06, 0.06, 0.02 + i * 0.07);
      });
      tone(2637, 0.45, 0.025, 'sine', 0.22); // brilhinho no fim
    },

    powerUp() {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.25, 0.09, 'triangle', i * 0.045));
    },

    powerDown() {
      [12, 7, 0].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.3, 0.07, 'triangle', i * 0.09));
    },

    meow() {
      tone(420, 0.22, 0.08, 'triangle', 0, 720);
      tone(720, 0.5, 0.08, 'triangle', 0.2, 300);
    },
  };
})();
