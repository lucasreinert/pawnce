// Service worker do app (PWA): guarda os arquivos do jogo para jogar offline.
// tools/prepare_site.py preenche BUILD (o commit publicado) e a lista FILES. Como BUILD muda a cada
// publicação, o navegador instala a versão nova e apaga a antiga na próxima vez que o jogo abrir.
const BUILD = '__BUILD__';
const CACHE = `pawnce-${BUILD}`;
const FILES = [/*__FILES__*/];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primeiro o que está guardado (abre na hora e funciona offline); se não tiver, busca na rede.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)));
});
