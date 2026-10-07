# Pawnce

*paw* (patinha) + *pounce* (o bote do gato).

Jogo estilo *Winter Bells* para a Poki: um gato sobe pelos telhados pulando de passarinho em
passarinho. Feito com Phaser 3 + Poki SDK.

## Rodar

```bash
python tools/serve.py
```

Depois abra http://localhost:8090. O `tools/serve.py` é um servidor simples que manda o navegador
não guardar cache, então qualquer edição aparece ao recarregar a página. Em `localhost` o Poki SDK roda em modo de teste: mostra
os eventos no console e exibe um anúncio de exemplo quando você clica em "PLAY AGAIN".

## Formato

O jogo é em retrato (480×820), pensado para celular. No desktop aparece centralizado,
com bordas nas laterais.

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
com janelas acesas. Os passarinhos são animados de forma contínua: a asa é uma peça separada que
gira no ombro.

O gato é pixel art (gato preto-azulado de olhos amarelos), mostrado no tamanho original
(`CAT_SCALE = 1`) com filtro "nearest" para os pixels ficarem nítidos.

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
| `src/textures.js` | Arte do cenário e dos passarinhos (Canvas 2D, estilo minimalista) |
| `src/ui.js` | Textos do jogo, fonte em pixel art, logo e patinha |
| `assets/cat.png`, `assets/cat.json` | Spritesheet do gato e suas medidas (geradas pelo script abaixo) |
| `assets/star-spin.png`, `assets/star-collect.png` | Estrela do frenesi girando e explodindo ao ser coletada (usadas como vieram) |
| `assets/source/` | Tiras originais do gato |
| `tools/build_cat_sheet.py` | Monta a spritesheet do jogo a partir das tiras |
| `tools/serve.py` | Servidor local de testes, sem cache |
| `src/sound.js` | Sons sintetizados: ao pegar passarinho, patada + bater de asas + "piu-piu" (mais agudo a cada passarinho seguido); miado no fim |
| `src/poki.js` | Wrapper do Poki SDK (o jogo funciona mesmo se ele não carregar) |

## Integração com a Poki

- `gameLoadingFinished()`: quando o jogo termina de carregar
- `gameplayStart()`: no primeiro pulo de cada partida
- `gameplayStop()`: quando o gato cai
- `commercialBreak()`: ao clicar em "PLAY AGAIN" (o som fica mudo durante o anúncio)

## Antes de enviar para a Poki

- Trocar o Phaser da CDN por uma cópia local (ou usar Vite para gerar o build)
- Incluir a pasta `assets/` no envio (`assets/source/` e `tools/` não precisam ir)
- Adicionar música
- Testar no celular de verdade
- Enviar a pasta pelo portal Poki for Developers
