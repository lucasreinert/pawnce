// Ranking online, com dois quadros: maior pontuação e maior altura.
// Cada jogador tem uma única entrada com o nome e os seus dois recordes; ela só é atualizada quando
// um recorde melhora.
//
//   - Na Poki: usa o AUDS, o armazenamento de dados da própria Poki
//     (https://developers.poki.com/guide/auds). Só funciona com o jogo publicado lá e com o
//     POKI_GAME_ID preenchido abaixo.
//   - No localhost: usa um ranking de teste guardado no navegador, com jogadores fictícios, para
//     dar para ver e testar a tela.
//   - Fora disso (GitHub Pages / app instalado): desligado; os botões de ranking não aparecem.
const Leaderboard = (() => {
  // Id do jogo na Poki (aparece no painel do Poki for Developers depois do cadastro).
  // Enquanto estiver vazio, o ranking fica desligado na Poki.
  const POKI_GAME_ID = '';
  const KEY = 'players';                     // "freeform key" do AUDS onde ficam as entradas
  const STORE = 'pawnce-leaderboard';        // { id, secret, nick, sent } deste jogador, no aparelho
  const MOCK_STORE = 'pawnce-leaderboard-mock';

  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const onPoki = !window.IS_WEB_APP && !isLocal;
  const mode = isLocal ? 'mock' : onPoki && POKI_GAME_ID ? 'auds' : 'off';

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } };
  const save = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) {} };

  // ---------------------------------------------------------------- AUDS (Poki)
  const base = `https://auds.poki.io/v0/${POKI_GAME_ID}/userdata/${KEY}`;
  const asJson = (r) => {
    if (!r.ok) throw new Error(`AUDS ${r.status}`);
    return r.json();
  };
  const post = (url, body) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(asJson);
  const auds = {
    create: (values) => post(base, { data: {}, values }),
    update: (id, secret, values) => post(`${base}/${id}`, { secret, values }),
    list: (key, limit) => fetch(`${base}?sort=-${key}&limit=${limit}`).then(asJson)
      .then((r) => r.items.map((it) => ({ id: it.id, ...it.values }))),
    // Quantos jogadores têm valor maior que o meu (posição = isso + 1)
    countAbove: (key, value) => fetch(`${base}?q=${encodeURIComponent(JSON.stringify({ [key]: { $gt: value } }))}&limit=1`)
      .then(asJson).then((r) => r.total),
  };

  // ---------------------------------------------------------------- Teste (localhost)
  const MOCK_NAMES = ['LUNAR PAW', 'SLEEPY MEW 7', 'NIGHT OWL', 'FLUFFY KIT', 'STARRY CAT', 'MOODY PAW 3',
    'SWIFT MEW', 'TINY CAT 99', 'SILKY PAW', 'JUMPY KIT 5', 'SNEAKY CAT', 'MOON RUNNER', 'COZY MEW 21', 'ROOFTOP KIT'];
  const mockRows = () => {
    try {
      const rows = JSON.parse(localStorage.getItem(MOCK_STORE));
      if (rows) return rows;
    } catch (e) {}
    const rows = MOCK_NAMES.map((name, i) => ({
      id: `mock${i}`, name, score: Math.round(180000 / (i + 1.4)) + i * 37, height: Math.round(1900 / (1 + i * 0.35)) + ((i * 7) % 11),
    }));
    localStorage.setItem(MOCK_STORE, JSON.stringify(rows));
    return rows;
  };
  const later = (v) => new Promise((r) => setTimeout(() => r(v), 300)); // simula a rede
  const mock = {
    create(values) {
      const rows = mockRows();
      const id = `me${Date.now()}`;
      rows.push({ id, ...values });
      localStorage.setItem(MOCK_STORE, JSON.stringify(rows));
      return later({ id, secret: 'mock-secret' });
    },
    update(id, secret, values) {
      const rows = mockRows();
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, values);
      localStorage.setItem(MOCK_STORE, JSON.stringify(rows));
      return later({ id });
    },
    list: (key, limit) => later([...mockRows()].sort((a, b) => b[key] - a[key]).slice(0, limit)),
    countAbove: (key, value) => later(mockRows().filter((r) => r[key] > value).length),
  };

  const backend = mode === 'auds' ? auds : mode === 'mock' ? mock : null;

  // ---------------------------------------------------------------- Nome do jogador
  // Só letras que a fonte do jogo tem; até 13 caracteres.
  const cleanName = (s) => String(s).toUpperCase().replace(/_/g, ' ').split('')
    .map((c) => (PIXEL_GLYPHS[c] ? c : ' ')).join('').replace(/\s+/g, ' ').trim().slice(0, 13);

  // Apelido gerado para quem não tem conta Poki (guardado no aparelho). Não deixamos digitar o nome:
  // um ranking público com nomes livres precisaria de moderação.
  const ADJ = ['LUNAR', 'SLEEPY', 'SNEAKY', 'FLUFFY', 'STARRY', 'TINY', 'SWIFT', 'SILKY', 'MOODY', 'JUMPY', 'COZY'];
  const NOUN = ['CAT', 'PAW', 'MEW', 'KIT'];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  async function playerName(me) {
    try {
      const sdk = window.PokiSDK;
      const user = sdk && sdk.getUser ? await sdk.getUser() : null; // conta Poki (se o jogador estiver logado)
      const name = user && user.username ? cleanName(user.username) : '';
      if (name) return name;
    } catch (e) {}
    if (!me.nick) me.nick = `${pick(ADJ)} ${pick(NOUN)} ${10 + Math.floor(Math.random() * 90)}`;
    return me.nick;
  }

  let queue = Promise.resolve(); // envios em ordem, e a tela de ranking espera o último

  return {
    enabled: !!backend,
    mode,

    // Envia os recordes do jogador ({ score, height }); só manda se algo melhorou ou o nome mudou.
    submit(best) {
      if (!backend || (best.score <= 0 && best.height <= 0)) return queue;
      queue = queue.then(async () => {
        const me = load();
        const name = await playerName(me);
        const sent = me.sent || { score: 0, height: 0 };
        const values = { name, score: Math.max(best.score, sent.score), height: Math.max(best.height, sent.height) };
        if (!me.id) {
          const r = await backend.create(values);
          Object.assign(me, { id: r.id, secret: r.secret });
        } else if (values.score > sent.score || values.height > sent.height || name !== me.name) {
          await backend.update(me.id, me.secret, values);
        } else {
          return;
        }
        Object.assign(me, { name, sent: { score: values.score, height: values.height } });
        save(me);
      }).catch(() => {}); // sem internet etc.: tenta de novo no próximo fim de jogo
      return queue;
    },

    // Top N de um quadro ('score' ou 'height') e a posição do jogador.
    async board(key, n = 10) {
      await queue;
      const me = load();
      const rows = (await backend.list(key, n)).map((r) => ({ ...r, me: r.id === me.id }));
      let mine = null;
      if (me.id && me.sent) {
        const value = me.sent[key];
        const inTop = rows.findIndex((r) => r.me);
        const rank = inTop >= 0 ? inTop + 1 : (await backend.countAbove(key, value)) + 1;
        mine = { name: me.name, value, rank };
      }
      return { rows, mine };
    },
  };
})();
