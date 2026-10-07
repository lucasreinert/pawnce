# Pawnce

*paw* (patinha) + *pounce* (o bote do gato).

Jogo estilo *Winter Bells*: um gato sobe pelos telhados pulando de passarinho em passarinho.
Feito com Phaser 3. O mesmo código roda na Poki (com o Poki SDK) e como app instalável (PWA) no
GitHub Pages: **https://lucasreinert.github.io/pawnce/**

## Rodar

```bash
python tools/serve.py
```

Depois abra http://localhost:8090. O `tools/serve.py` é um servidor simples que manda o navegador
não guardar cache, então qualquer edição aparece ao recarregar a página. Em `localhost` o Poki SDK
roda em modo de teste: mostra os eventos no console e exibe um anúncio de exemplo quando você clica
em "PLAY AGAIN".

## Formato

O jogo é em retrato, com 400 de largura (`W` em `src/game.js`). Como o jogo ocupa a largura da tela
do celular, essa largura define o tamanho de tudo: quanto menor, maior aparecem gato, passarinhos e
textos. As distâncias e velocidades foram afinadas com 480 de largura e são convertidas por
`KS = W / 480`, então mudar `W` mantém o mesmo tempo de pulo e a mesma dificuldade.

A altura acompanha o formato da tela (de 820 a 1100, em escala de 480), então celulares mais
alongados, como os iPhones atuais, ficam em tela cheia sem faixas pretas. No desktop aparece
centralizado, com bordas nas laterais. Em tela cheia no iPhone, placar, frenesi e logo descem
o espaço do relógio/entalhe (`SAFE_TOP` em `src/game.js`).

## App instalável (PWA)

O jogo é publicado no GitHub Pages pelo workflow `.github/workflows/pages.yml` a cada push na `main`.

**Para instalar:**
- **iPhone**: abrir o link no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**.
- **Android**: abrir o link no **Chrome** → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").

O app abre em tela cheia com o ícone da patinha e funciona **offline** depois da primeira abertura.
Atualizações chegam sozinhas: a cada publicação, a próxima vez que o app abrir ele baixa a versão nova.

**Como funciona:**
- `manifest.webmanifest`: nome, ícones, cores e orientação do app.
- `sw.js` (service worker): guarda os arquivos para jogar offline. `tools/prepare_site.py` monta a
  pasta publicada `_site/` (sem `tools/` nem `assets/source/`) e preenche no `sw.js` a versão e a
  lista de arquivos.
- `icons/`: ícones gerados por `tools/build_icons.py` (a patinha do logo sobre o céu do jogo).
- Fora da Poki (GitHub Pages ou app instalado), o SDK da Poki não é carregado.
- O Phaser fica em `lib/` (cópia local), para funcionar offline.

**Primeira publicação:** no GitHub, **Settings → Pages → Build and deployment → Source: GitHub
Actions**. Depois disso, cada push na `main` publica sozinho (acompanhe em **Actions**).

**Testar a versão publicada localmente:**

```bash
python tools/prepare_site.py
```

```bash
python tools/serve.py 8091 --site
```

## Controles

- Dedo / mouse: guia o gato (ele acelera até o ponto, com um pouco de inércia)
- Clique / toque / espaço: pula do telhado
- Setas ou A/D: movem pelo teclado
- Enter: jogar de novo

## Regras

- Cada passarinho seguido vale 10 pontos a mais que o anterior (10, 20, 30…)
- Passarinho dourado atravessa a tela e dobra a pontuação
- Quanto mais alto, mais distantes e menores os passarinhos, e mais deles voam de um lado para o outro
- Quando o telhado sai da tela, cair é fim de jogo
- Antes do primeiro pulo, o gato passeia sozinho pelo telhado

## Frenesi (bônus)

De tempos em tempos (a cada 3.500–5.000px de altura) aparece uma estrela roxa girando no caminho
(`assets/star-spin.png`, 12 quadros), com um brilho roxo pulsando e partículas roxas em volta.
Ao pegar, toca a animação de coleta (`assets/star-collect.png`, 8 quadros: a estrela brilha, vira
luz e se desfaz em faíscas) e, por 6 segundos:

- surge uma trilha densa de passarinhos lilás logo acima do gato, fáceis de pegar
- cada passarinho vale o dobro
- o gato é impulsionado mais alto
- a tela fica arroxeada, o rastro fica roxo e uma barra mostra o tempo restante

Não aparecem estrelas durante um frenesi, então não dá para emendar um no outro.
Ajustes: `FRENZY_MS`, `FRENZY_BOUNCE_VY`, `FRENZY_MULT`, `ORB_EVERY`, `STAR_R` (raio de coleta),
`FRENZY_COLOR` e `STAR_PARTICLES` (cores) em `src/game.js`.

## Visual

Cenário minimalista: formas lisas e poucas cores (paleta em `PALETTE`, `src/textures.js`), prédios
com janelas acesas.

O gato é pixel art (gato preto-azulado de olhos amarelos), mostrado no tamanho original
(`CAT_SCALE = 1`) com filtro "nearest" para os pixels ficarem nítidos.

### Passarinhos

Pixel art 32×32, em três cores com o mesmo desenho: normal (branco-lilás com asas azuis), dourado
(vale x2) e lilás (frenesi). Cada spritesheet tem 12 quadros: 0–5 voando no lugar (loop; cada
passarinho começa num quadro diferente) e 6–11 assustado fugindo, que toca quando o gato pega.

As tiras originais ficam em `assets/source/` (`bird-fly.png`, `bird-flee.png`). O script
`tools/build_bird_sheets.py` junta as duas e gera as versões dourada e lilás trocando a paleta cor a
cor (`assets/bird.png`, `bird-gold.png`, `bird-bonus.png`):

```bash
python tools/build_bird_sheets.py
```

Ajustes em `src/game.js`: `BIRD_SCALE` (tamanho; hoje 1.5) e `BIRD_FLAP_FPS` (velocidade do bater
de asas de cada tipo). As cores das versões ficam em `VARIANTS`, no topo do script.

## Música

Composta em código (`src/music.js`), sem arquivos de áudio: um sequenciador em Web Audio toca a
progressão Am – F – C – G em loop, em duas camadas.

- **Calma** (104 BPM): arpejo de caixinha de música, baixo suave, chimbal leve e uma melodia em lá
  menor pentatônica a cada duas voltas.
- **Frenesi** (138 BPM): entram bumbo, caixa, chimbal, baixo pulsante, arpejo rápido e a melodia
  marcada; a camada calma fica por baixo. A troca é um fade, e ao fim do frenesi volta à calma.

A música começa no primeiro toque (o navegador só libera som depois de uma interação), fica mais
baixa na tela de fim de jogo, muda durante os anúncios da Poki e pausa quando a aba fica escondida.
As notas são agendadas a cada quadro do jogo (`Music.update()`), com um timer de reforço.

Ajustes no topo de `src/music.js`: `TEMPO_CALM`, `TEMPO_INTENSE`, `VOLUME`, `DUCKED`, os acordes
(`CHORDS`) e a melodia (`MELODY`, passo → nota MIDI).

## Interface

Toda a interface usa uma fonte em pixel art 5×7 desenhada no código (`src/ui.js`), com contorno
roxo-escuro e sombra, sem depender de arquivo de fonte externo.

- **Tela inicial**: logo PAWNCE (letras douradas em degradê, borda lilás) caindo letra por letra e
  depois balançando em onda; ao lado, uma patinha de almofadas rosa cai como um carimbo, solta
  faíscas e fica balançando. Abaixo: frase, recorde e
  "TAP TO JUMP" pulsando. Some quando o jogador dá o primeiro pulo.
  A patinha é desenhada em `PAW_ROWS` / `makePaw` (`src/ui.js`).
- **Placar**: pontuação grande no canto (dá um "pulo" a cada ponto), recorde embaixo e
  "COMBO XN" a partir de 3 passarinhos seguidos.
- **Pontos de cada passarinho**: "+N" salta do passarinho, crescendo e esquentando de cor com o
  combo (branco → amarelo claro → dourado → laranja; lilás no frenesi; "X2!" no dourado).
  Ajuste em `pointsStyle` (`src/game.js`).
- **Frenesi**: "FRENZY X2" e uma barra com moldura no canto direito, que pisca no último 1,5s.
- **Fim de jogo**: cartão com pontuação, recorde (ou "NEW BEST!" pulsando em dourado) e botão
  "PLAY AGAIN" que pulsa; os itens entram um depois do outro.

Os textos ficam em `TEXT` (`src/ui.js`). Estão em inglês por causa do público da Poki; para
traduzir, basta trocar ali (a fonte tem A–Z, 0–9 e `+ - ! . : ?`, sem acentos).

## Animação do gato

A spritesheet tem 24 quadros (`assets/cat.png`, nomes em `assets/cat.json`), montada a partir de
três tiras de 8 quadros:

| Quadros | Quando aparecem |
|---|---|
| `walk0`–`walk7` | Andando no telhado (o ciclo acelera quanto mais rápido ele anda) |
| `sit0`, `sit1`, `sit6`, `sit7` | Sentado, rabo balançando |
| `sit4` / `sit2` / `sit3` / `sit5` | De vez em quando: pisca / olha de lado / piscadinha / cochila |
| `jump2` | Impulso, logo ao pular ou pegar um passarinho |
| `jump3` | Subindo |
| `jump4` | Voo, no topo do pulo |
| `jump5` | Descendo |
| `jump6` | Aterrissando no telhado |
| `jump0`, `jump1`, `jump7` | Não usados (gato em pé no começo e no fim da tira do pulo) |

A escolha do quadro fica em `animateCat` (`src/game.js`); os gestos sentado e a frequência deles em `IDLE_EVENTS`.

### Trocar ou atualizar a arte do gato

As tiras originais ficam em `assets/source/` (`cat-walk.png`, `cat-idle.png`, `cat-jump.png`).
O script `tools/build_cat_sheet.py` separa os quadros (mesmo quando o rabo de um gato encosta no
vizinho), alinha todos para o gato não tremer (patas na mesma linha, frente do gato na mesma coluna;
no ar, centro de massa no mesmo ponto) e gera `assets/cat.png` + `assets/cat.json`.

```bash
pip install pillow numpy
```

```bash
python tools/build_cat_sheet.py
```

Para trocar a arte, substitua as tiras mantendo os nomes. Se mudar a quantidade de quadros ou quais
quadros do pulo tocam o chão, ajuste `STRIPS` no topo do script.

## Ajustes

Os números de dificuldade ficam no topo de `src/game.js`:

- `CAT_SPEED`, `GAP_MIN` / `GAP_MAX` / `GAP_GROW`, `DX_MAX`: velocidade do gato e distâncias entre passarinhos
- `WALK_SPEED`: velocidade do passeio antes de começar
- `GRAVITY` / `BOUNCE_VY`: altura e duração do pulo
- `TRAIL_COLOR`, `TRAIL_LEN`: cor e tamanho do rastro

## Estrutura

| Arquivo | O que faz |
|---|---|
| `src/game.js` | Regras do jogo: física, passeio, animação do gato, rastro, frenesi, pontuação, câmera, fim de jogo |
| `src/textures.js` | Arte do cenário (Canvas 2D, estilo minimalista) |
| `src/ui.js` | Textos do jogo, fonte em pixel art, logo e patinha |
| `assets/cat.png`, `assets/cat.json` | Spritesheet do gato e suas medidas (geradas por `tools/build_cat_sheet.py`) |
| `assets/bird.png`, `bird-gold.png`, `bird-bonus.png` | Passarinhos normal, dourado e lilás (gerados por `tools/build_bird_sheets.py`) |
| `assets/star-spin.png`, `assets/star-collect.png` | Estrela do frenesi girando e explodindo ao ser coletada (usadas como vieram) |
| `assets/source/` | Tiras originais do gato e dos passarinhos |
| `tools/build_cat_sheet.py` | Monta a spritesheet do gato a partir das tiras |
| `tools/build_bird_sheets.py` | Monta as spritesheets dos passarinhos e gera as versões dourada e lilás |
| `tools/serve.py` | Servidor local de testes, sem cache (`--site` serve a versão publicada) |
| `tools/prepare_site.py` | Monta a versão publicada em `_site/` e o `sw.js` final |
| `tools/build_icons.py` | Gera os ícones do app em `icons/` |
| `manifest.webmanifest`, `sw.js`, `icons/` | App instalável (PWA): manifesto, service worker (offline) e ícones |
| `lib/phaser.min.js` | Phaser 3.80.1 (cópia local, para funcionar offline) |
| `.github/workflows/pages.yml` | Publica no GitHub Pages a cada push na `main` |
| `src/sound.js` | Sons sintetizados: ao pegar passarinho, patada + bater de asas + "piu-piu" (mais agudo a cada passarinho seguido); miado no fim |
| `src/music.js` | Música de fundo e do frenesi, compostas em código |
| `src/poki.js` | Wrapper do Poki SDK (o jogo funciona mesmo se ele não carregar) |

## Integração com a Poki

- `gameLoadingFinished()`: quando o jogo termina de carregar
- `gameplayStart()`: no primeiro pulo de cada partida
- `gameplayStop()`: quando o gato cai
- `commercialBreak()`: ao clicar em "PLAY AGAIN" (o som fica mudo durante o anúncio)

## Antes de enviar para a Poki

- Enviar o conteúdo de `_site/` (gerado por `tools/prepare_site.py`); o `sw.js` e o manifesto não
  atrapalham na Poki (o service worker só é registrado fora dela)
- Botão para ligar/desligar o som
- Testar no celular de verdade
- Enviar a pasta pelo portal Poki for Developers
