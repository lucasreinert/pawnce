// Wrapper do Poki SDK. Se o SDK não carregar (offline, adblock), o jogo segue funcionando.
const Poki = (() => {
  const sdk = () => window.PokiSDK;

  return {
    init() {
      if (!sdk()) return Promise.resolve();
      return sdk().init().catch(() => {});
    },

    // Chamar uma vez, quando tudo terminou de carregar.
    loadingFinished() {
      if (sdk()) sdk().gameLoadingFinished();
    },

    // Jogador começou/parou de jogar de fato (não conta menus e telas de fim de jogo).
    gameplayStart() {
      if (sdk()) sdk().gameplayStart();
    },
    gameplayStop() {
      if (sdk()) sdk().gameplayStop();
    },

    // Intervalo comercial entre partidas. onStart: pausar/mutar o áudio.
    commercialBreak(onStart) {
      if (!sdk()) return Promise.resolve();
      return sdk().commercialBreak(onStart).catch(() => {});
    },
  };
})();
