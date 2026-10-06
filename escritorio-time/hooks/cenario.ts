import type { Cena, IdAgente } from '../types'
import { FUNDO_ALTURA, FUNDO_COR, FUNDO_IMAGEM, FUNDO_LARGURA } from './dados-fundo'
import { SPRITES } from './dados-sprites'
import type { Quadro } from './dados-sprites'
import { AGENTES, IDS } from './equipe'
import type { Ponto } from './equipe'
import { TEMPO_CHEGADA, TEMPO_SAIDA, comprimento, rota, temposDaEntrega } from './rotas'
import type { Tempos } from './rotas'

// O elemento Svg aceita no máximo este número de caracteres.
export const LIMITE_SVG = 131072

// Largura, em pixels, de uma coluna do painel do app (bodyColumns): medida
// num painel real de 85 colunas, que tinha 674 px.
export const PIXELS_POR_COLUNA = 7.85

// Unidades do escritório por célula de sprite.
const U = 2.1

// Segundos em que o selo de entrega fica à vista.
const TEMPO_DO_SELO = TEMPO_SAIDA + 2

// Balão de fala: letras por linha, linhas e tamanho da letra (em unidades).
const LETRAS_DA_FALA = 24
const LINHAS_DA_FALA = 2
const FONTE_DA_FALA = 26

const FORA = '-9999 0'
const DENTRO = '0 0'
const SEMPRE = Number.POSITIVE_INFINITY

type Intervalo = readonly [number, number]

const PAPEL =
  '<path d="M-8 -11h11l5 5v17h-16z" fill="#fff" stroke="#22223b" stroke-width="2"/>' +
  '<path d="M-4 -3h8M-4 2h8M-4 7h5" fill="none" stroke="#8d99ae" stroke-width="1.6"/>'

const SELO_ENTREGUE =
  '<circle r="15" fill="#2ecc71" stroke="#fff" stroke-width="3"/>' +
  '<path d="M-7 0l5 6l9 -11" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'

function n(valor: number): string {
  return String(Math.round(valor * 10) / 10)
}

function fracao(valor: number): string {
  return String(Math.round(valor * 10000) / 10000)
}

// Atributo `begin` de uma animação que começou há `decorrido` segundos. O app
// recria o quadro do desenho a cada redesenho; com o início no passado a
// animação retoma de onde estava em vez de recomeçar.
function comeco(decorrido: number): string {
  return `begin="${String(-Math.round(decorrido * 100) / 100)}s"`
}

// Largura, em pixels, dos quadros do desenho para um painel com estas colunas.
// As camadas (fundo e agentes) usam a mesma largura e altura para ficarem
// exatamente uma sobre a outra.
export function larguraDoQuadro(colunas: number): number {
  return Math.max(200, Math.min(FUNDO_LARGURA, Math.floor(Math.max(1, colunas) * PIXELS_POR_COLUNA)))
}

// Altura, em pixels, dos quadros: a proporção da arte para a largura acima.
export function alturaDoQuadro(colunas: number): number {
  return Math.round((larguraDoQuadro(colunas) * FUNDO_ALTURA) / FUNDO_LARGURA)
}

// animateTransform discreto: vale `dentro` nos intervalos (em segundos) e
// `fora` no resto.
function alternar(
  tipo: 'translate' | 'scale',
  intervalos: readonly Intervalo[],
  dentro: string,
  fora: string,
  duracao: number,
  inicio: string,
): string {
  const valores: string[] = []
  const tempos: number[] = []

  const marcar = (tempo: number, valor: string): void => {
    if (tempos[tempos.length - 1] === tempo) {
      valores.pop()
      tempos.pop()
    }

    if (valores[valores.length - 1] !== valor) {
      valores.push(valor)
      tempos.push(tempo)
    }
  }

  marcar(0, fora)

  for (const [de, ate] of intervalos) {
    marcar(Math.max(0, de), dentro)

    if (ate < duracao) {
      marcar(ate, fora)
    }
  }

  if (valores.length < 2) {
    return ''
  }

  return (
    `<animateTransform attributeName="transform" type="${tipo}" values="${valores.join(';')}" ` +
    `keyTimes="${tempos.map(tempo => fracao(tempo / duracao)).join(';')}" calcMode="discrete" ` +
    `dur="${n(duracao)}s" ${inicio} fill="freeze"/>`
  )
}

// Mostra o conteúdo só nos intervalos. `parado` diz se ele aparece quando a
// superfície não anima (o desenho parado mostra o fim do passo).
function janela(
  conteudo: string,
  intervalos: readonly Intervalo[],
  duracao: number,
  parado: boolean,
  inicio: string,
): string {
  const primeiro = intervalos[0]

  if (intervalos.length === 1 && primeiro !== undefined && primeiro[0] <= 0 && primeiro[1] === SEMPRE) {
    return `<g>${conteudo}</g>`
  }

  const base = parado ? '' : ` transform="translate(${FORA})"`

  return `<g${base}>${alternar('translate', intervalos, DENTRO, FORA, duracao, inicio)}${conteudo}</g>`
}

// Sobe e desce o conteúdo, a partir de `desde` segundos (pode ser negativo).
function balanco(conteudo: string, desde: number, periodo: number): string {
  return (
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2" keyTimes="0;.5" ` +
    `calcMode="discrete" dur="${periodo}s" begin="${n(desde)}s" repeatCount="indefinite"/>${conteudo}</g>`
  )
}

// Um quadro com os pés em (x, y) e centrado na horizontal. O traçado passa
// pelo meio de cada linha de células, daí a meia célula a mais na vertical.
function quadro(q: Quadro, x: number, y: number): string {
  return `<g transform="translate(${n(x - (q.l * U) / 2)} ${n(y - q.a * U + U / 2)}) scale(${U})">${q.d}</g>`
}

function sentado(id: IdAgente, trabalhaDesde: number | null): string {
  const agente = AGENTES[id]
  const pose = SPRITES[id].sentado

  if (trabalhaDesde === null) {
    return quadro(pose, agente.x, agente.corte)
  }

  return `<g transform="translate(${agente.x} ${agente.corte})">${balanco(quadro(pose, 0, 0), trabalhaDesde, 0.5)}</g>`
}

function topoDaCabeca(id: IdAgente): number {
  return AGENTES[id].corte - SPRITES[id].sentado.a * U
}

// As etiquetas de nome dos 17 agentes, com os atributos comuns em grupos.
function etiquetas(): string {
  const fundos: string[] = []
  const pontos: string[] = []
  const nomes: string[] = []

  for (const id of IDS) {
    const agente = AGENTES[id]
    const largura = agente.nome.length * 7.2 + 30
    const x = agente.x - largura / 2
    const y = topoDaCabeca(id) - 24
    fundos.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(largura)}" height="20" rx="6"/>`)
    pontos.push(`<circle cx="${n(x + 11)}" cy="${n(y + 10)}" r="4"/>`)
    nomes.push(`<text x="${n(x + 21)}" y="${n(y + 14.2)}">${agente.nome}</text>`)
  }

  return (
    `<g fill="#101018" opacity=".88">${fundos.join('')}</g><g fill="#2ee66b">${pontos.join('')}</g>` +
    `<g font-family="monospace" font-size="12" fill="#fff">${nomes.join('')}</g>`
  )
}

function etiquetaDeDestaque(id: IdAgente): string {
  const agente = AGENTES[id]
  const largura = agente.nome.length * 12.6 + 18
  const x = agente.x - largura / 2
  const y = topoDaCabeca(id) - 35

  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${n(largura)}" height="29" rx="7" fill="#ffd23f" stroke="#101018" stroke-width="2"/>` +
    `<text x="${n(x + 9)}" y="${n(y + 21.9)}" font-family="monospace" font-size="21" font-weight="bold" fill="#101018">${agente.nome}</text>`
  )
}

function escapar(texto: string): string {
  return texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

// Quebra a fala em poucas linhas curtas; o que não couber termina em reticências.
export function quebrarFala(fala: string): string[] {
  const palavras = fala
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .split(' ')
    .filter(palavra => palavra !== '')
  const linhas: string[] = []
  let atual = ''
  let sobrou = false

  for (const palavra of palavras) {
    const candidata = atual === '' ? palavra : `${atual} ${palavra}`

    if (candidata.length <= LETRAS_DA_FALA) {
      atual = candidata
    } else if (linhas.length === LINHAS_DA_FALA - 1) {
      sobrou = true
      atual = atual === '' ? palavra : atual
      break
    } else {
      if (atual !== '') {
        linhas.push(atual)
      }

      atual = palavra
    }
  }

  linhas.push(atual)

  return linhas.map((linha, i) => {
    const ultima = i === linhas.length - 1
    const cortada = linha.length > LETRAS_DA_FALA || (ultima && sobrou)

    return cortada ? `${linha.slice(0, LETRAS_DA_FALA - 1)}…` : linha
  })
}

// Balão de diálogo acima de quem trabalha, com o que ele está fazendo.
function balaoDeFala(id: IdAgente, fala: string): string {
  const agente = AGENTES[id]
  const linhas = quebrarFala(fala)
  const maior = Math.max(...linhas.map(linha => linha.length))
  const largura = maior * FONTE_DA_FALA * 0.6 + 28
  const altura = linhas.length * 32 + 18
  const ponta = topoDaCabeca(id) - 38
  const y = ponta - 14 - altura
  const x = Math.min(FUNDO_LARGURA - largura - 8, Math.max(8, agente.x - largura / 2))
  const rabo = Math.min(x + largura - 20, Math.max(x + 20, agente.x))
  const baixo = y + altura
  const texto = linhas
    .map((linha, i) => `<text x="${n(x + 14)}" y="${n(y + 33 + i * 32)}">${escapar(linha)}</text>`)
    .join('')

  return (
    `<g stroke="#22223b" stroke-width="2.5" fill="#fff">` +
    `<path d="M${n(rabo - 10)} ${n(baixo - 2)}L${n(rabo)} ${n(ponta)}L${n(rabo + 10)} ${n(baixo - 2)}z"/>` +
    `<rect x="${n(x)}" y="${n(y)}" width="${n(largura)}" height="${altura}" rx="10"/></g>` +
    `<path d="M${n(rabo - 8)} ${n(baixo)}h16" stroke="#fff" stroke-width="4"/>` +
    `<g font-family="monospace" font-size="${FONTE_DA_FALA}" font-weight="bold" fill="#22223b">${texto}</g>`
  )
}

// Balão sem texto: três pontos que aparecem em sequência.
function balaoDePontos(id: IdAgente): string {
  const agente = AGENTES[id]
  const pontos = [0, 1, 2]
    .map(i => {
      const ponto = `<circle cx="${10 + i * 10}" cy="11" r="3" fill="#22223b"/>`

      if (i === 0) {
        return ponto
      }

      return (
        `<g><animateTransform attributeName="transform" type="translate" values="${FORA};${DENTRO}" ` +
        `keyTimes="0;${fracao(i / 4)}" calcMode="discrete" dur="1.2s" repeatCount="indefinite"/>${ponto}</g>`
      )
    })
    .join('')

  return (
    `<g transform="translate(${n(agente.x + 22)} ${n(topoDaCabeca(id) + 2)})">` +
    `<path d="M8 20l-5 9l13 -9z" fill="#fff" stroke="#22223b" stroke-width="2"/>` +
    `<rect width="40" height="22" rx="7" fill="#fff" stroke="#22223b" stroke-width="2"/>${pontos}</g>`
  )
}

function papelEm(ponto: Ponto): string {
  return `<g transform="translate(${n(ponto[0])} ${n(ponto[1])})">${PAPEL}</g>`
}

// Papel que desliza pelos pontos em `segundos` e fica parado no último.
function papelDeslizando(pontos: readonly Ponto[], segundos: number, inicio: string): string {
  const fim = pontos[pontos.length - 1] as Ponto
  const total = comprimento(pontos)
  let andado = 0
  const tempos = pontos.map((ponto, i) => {
    const antes = pontos[i - 1]

    if (antes !== undefined) {
      andado += Math.hypot(ponto[0] - antes[0], ponto[1] - antes[1])
    }

    return fracao(i === pontos.length - 1 ? 1 : andado / total)
  })

  return (
    `<g transform="translate(${n(fim[0])} ${n(fim[1])})"><animateTransform attributeName="transform" type="translate" ` +
    `values="${pontos.map(ponto => `${n(ponto[0])} ${n(ponto[1])}`).join(';')}" keyTimes="${tempos.join(';')}" ` +
    `dur="${segundos}s" ${inicio} fill="freeze"/>${PAPEL}</g>`
  )
}

// Quem leva o papel: anda de `ida[0]` até o fim de `ida`, entrega e volta.
function caminhante(id: IdAgente, ida: readonly Ponto[], tempos: Tempos, duracao: number, inicio: string): string {
  const poses = SPRITES[id]
  const extensao = comprimento(ida)
  const pontos: Ponto[] = []
  const instantes: number[] = []
  const deLado: Intervalo[] = []
  const paraDireita: Intervalo[] = []
  const deFrente: Intervalo[] = []
  const deCostas: Intervalo[] = []

  const trecho = (de: Ponto, para: Ponto, desde: number, ate: number): void => {
    const dx = para[0] - de[0]
    const dy = para[1] - de[1]

    if (Math.abs(dx) >= Math.abs(dy)) {
      deLado.push([desde, ate])

      if (dx > 0) {
        paraDireita.push([desde, ate])
      }
    } else if (dy > 0) {
      deFrente.push([desde, ate])
    } else {
      deCostas.push([desde, ate])
    }
  }

  let andado = 0
  pontos.push(ida[0] as Ponto)
  instantes.push(0)

  for (let i = 1; i < ida.length; i += 1) {
    const de = ida[i - 1] as Ponto
    const para = ida[i] as Ponto
    const desde = (andado / extensao) * tempos.ida
    andado += Math.hypot(para[0] - de[0], para[1] - de[1])
    const ate = i === ida.length - 1 ? tempos.ida : (andado / extensao) * tempos.ida
    trecho(de, para, desde, ate)
    pontos.push(para)
    instantes.push(ate)
  }

  const retorno = tempos.ida + tempos.pausa
  deFrente.push([tempos.ida, retorno])
  pontos.push(ida[ida.length - 1] as Ponto)
  instantes.push(retorno)
  andado = 0

  for (let i = ida.length - 1; i > 0; i -= 1) {
    const de = ida[i] as Ponto
    const para = ida[i - 1] as Ponto
    const desde = retorno + (andado / extensao) * tempos.volta
    andado += Math.hypot(para[0] - de[0], para[1] - de[1])
    const ate = i === 1 ? tempos.total : retorno + (andado / extensao) * tempos.volta
    trecho(de, para, desde, ate)
    pontos.push(para)
    instantes.push(ate)
  }

  const ordenar = (intervalos: Intervalo[]): Intervalo[] => [...intervalos].sort((a, b) => a[0] - b[0])
  const passada =
    `<g><animateTransform attributeName="transform" type="translate" values="${DENTRO};${FORA}" keyTimes="0;.5" ` +
    `calcMode="discrete" dur=".36s" repeatCount="indefinite"/>${quadro(poses.lado1, 0, 0)}</g>` +
    `<g transform="translate(${FORA})"><animateTransform attributeName="transform" type="translate" ` +
    `values="${FORA};${DENTRO}" keyTimes="0;.5" calcMode="discrete" dur=".36s" repeatCount="indefinite"/>` +
    `${quadro(poses.lado2, 0, 0)}</g>`
  const corpo =
    janela(
      `<g>${alternar('scale', ordenar(paraDireita), '-1 1', '1 1', duracao, inicio)}${passada}</g>`,
      ordenar(deLado),
      duracao,
      false,
      inicio,
    ) +
    janela(balanco(quadro(poses.frente, 0, 0), 0, 0.36), ordenar(deFrente), duracao, false, inicio) +
    (deCostas.length > 0
      ? janela(balanco(quadro(poses.costas, 0, 0), 0, 0.36), ordenar(deCostas), duracao, false, inicio)
      : '') +
    janela(`<g transform="translate(16 -24)">${PAPEL}</g>`, [[0, tempos.ida]], duracao, false, inicio)
  const origem = ida[0] as Ponto

  return janela(
    `<g transform="translate(${n(origem[0])} ${n(origem[1])})"><animateTransform attributeName="transform" ` +
      `type="translate" values="${pontos.map(ponto => `${n(ponto[0])} ${n(ponto[1])}`).join(';')}" ` +
      `keyTimes="${instantes.map((instante, i) => fracao(i === instantes.length - 1 ? 1 : instante / tempos.total)).join(';')}" ` +
      `dur="${n(tempos.total)}s" ${inicio} fill="freeze"/>${corpo}</g>`,
    [[0, tempos.total]],
    duracao,
    false,
    inicio,
  )
}

const RAIZ =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FUNDO_LARGURA} ${FUNDO_ALTURA}" ` +
  `width="${FUNDO_LARGURA}" height="${FUNDO_ALTURA}"`

// A camada de fundo: só a arte original, que entra como fundo CSS do <svg>
// (o app remove a tag <image>, mas aceita imagem em CSS). `contain` e `center`
// encaixam a imagem do mesmo jeito que o viewBox encaixa o desenho das outras
// camadas. Não depende de nada: é desenhada uma vez e não muda.
export function montarFundo(): string {
  return `${RAIZ} style="background:${FUNDO_COR} url(${FUNDO_IMAGEM}) center/contain no-repeat"></svg>`
}

// A camada dos agentes para a cena, em desenho transparente. `decorrido` são
// os segundos desde que o passo em cena começou: o desenho retoma a animação
// daquele ponto e, se ela já acabou, mostra o estado final. `fala` é o texto
// do balão de quem trabalha.
export function montarCena(cena: Cena, tempo: number, fala: string | null): string {
  const decorrido = Math.max(0, tempo)
  const passo = cena.passo
  const inicio = comeco(decorrido)
  const personagens: string[] = []
  const camadas: string[] = []
  let duracao = 1
  let trabalhador: IdAgente | null = null
  let trabalhaDesde = 0
  let ausente: IdAgente | null = null
  let voltaEm = 0
  let andando = ''
  let animando = true

  if (passo?.tipo === 'chegada' && decorrido < TEMPO_CHEGADA) {
    duracao = TEMPO_CHEGADA + 1
    trabalhador = 'frank'
    trabalhaDesde = TEMPO_CHEGADA
    camadas.push(papelDeslizando([[-30, 372], [262, 372], AGENTES.frank.papelNaMesa], TEMPO_CHEGADA, inicio))
  } else if (passo?.tipo === 'entrega' && decorrido < temposDaEntrega(passo.de, passo.para).total) {
    const tempos = temposDaEntrega(passo.de, passo.para)
    duracao = tempos.total + 1
    trabalhador = passo.para
    trabalhaDesde = tempos.ida
    ausente = passo.de
    voltaEm = tempos.total
    andando = caminhante(passo.de, rota(passo.de, passo.para), tempos, duracao, inicio)
    camadas.push(janela(papelEm(AGENTES[passo.para].papelNaMesa), [[tempos.ida, SEMPRE]], duracao, true, inicio))
  } else if (passo?.tipo === 'conclusao' && decorrido < TEMPO_DO_SELO) {
    duracao = TEMPO_DO_SELO + 1
    camadas.push(
      janela(
        papelDeslizando([AGENTES.frank.papelNaMesa, [262, 372], [-30, 372]], TEMPO_SAIDA, inicio),
        [[0, TEMPO_SAIDA]],
        duracao,
        false,
        inicio,
      ),
    )
    camadas.push(
      janela(
        `<g transform="translate(${AGENTES.frank.x} ${n(topoDaCabeca('frank') - 44)})">${SELO_ENTREGUE}</g>`,
        [[0.2, TEMPO_DO_SELO]],
        duracao,
        false,
        inicio,
      ),
    )
  } else {
    // Cena parada: o passo já terminou e o desenho mostra como ele acabou.
    animando = false

    if (cena.portador !== null) {
      camadas.push(papelEm(AGENTES[cena.portador].papelNaMesa))
      trabalhador = cena.ativo ? cena.portador : null
    }
  }

  const naOrdem = [...IDS].sort((a, b) => AGENTES[a].corte - AGENTES[b].corte)

  for (const id of naOrdem) {
    if (id === ausente) {
      personagens.push(janela(sentado(id, null), [[voltaEm, SEMPRE]], duracao, true, inicio))
    } else if (id === trabalhador) {
      personagens.push(sentado(id, animando ? trabalhaDesde - decorrido : 0))
    } else {
      personagens.push(sentado(id, null))
    }
  }

  const destaque =
    trabalhador === null
      ? ''
      : janela(
          etiquetaDeDestaque(trabalhador) +
            (fala === null ? balaoDePontos(trabalhador) : balaoDeFala(trabalhador, fala)),
          [[trabalhaDesde, SEMPRE]],
          duracao,
          true,
          inicio,
        )

  return (
    `${RAIZ}><g fill="none" stroke-width="1.06">${personagens.join('')}${andando}</g>` +
    `${camadas.join('')}${etiquetas()}${destaque}</svg>`
  )
}
