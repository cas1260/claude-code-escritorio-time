import type { IdAgente, Passo, Rotina } from '../types'
import { AGENTES } from './equipe'
import type { Ponto } from './equipe'

export type Tempos = { ida: number; pausa: number; volta: number; total: number }

export type Pose = 'frente' | 'costas' | 'lado' | 'sentado'

// `par` é o lugar de quem faz companhia: o outro lado da mesa de pebolim.
export type Lugar = { ponto: Ponto; pose: Pose; uso: 'cafe' | 'descontracao' | 'cochilo'; par?: string }

// Segundos que o papel leva para chegar à recepção e para sair dela.
export const TEMPO_CHEGADA = 1.4
export const TEMPO_SAIDA = 1.4

const VELOCIDADE = 330
const TRECHO_MINIMO = 0.9
const TRECHO_MAXIMO = 3
const PAUSA_NA_ENTREGA = 0.5

// Quem passeia sem demanda anda mais devagar do que quem leva o papel.
const VELOCIDADE_DO_PASSEIO = 230
const PASSEIO_MINIMO = 1.2
const PASSEIO_MAXIMO = 6

// Quem visita um colega para ao lado da mesa dele, e não na frente.
const AO_LADO_DO_COLEGA = 44

// Cruzamentos dos corredores, no sistema de coordenadas do escritório.
const CRUZAMENTOS: Record<string, Ponto> = {
  hall: [320, 372],
  lobby: [320, 138],
  hOeste: [320, 410],
  hCentro: [674, 410],
  lounge: [674, 302],
  juncao: [958, 410],
  vFullstack2: [958, 394],
  vFullstack1: [958, 300],
  vEspecialistas1: [958, 610],
  vBanco: [958, 640],
  vEspecialistas2: [958, 788],
  vQualidade: [958, 815],
  sulLeste: [958, 838],
  sulDescontracao: [938, 838],
  sulCafe: [505, 838],
  cafePorta: [505, 968],
  descontracaoPorta: [938, 958],
  descontracaoSofa: [1042, 958],
  descontracaoMeio: [1128, 958],
  pebolimSul: [1128, 1012],
  pebolimNorte: [1128, 912],
}

// Onde os agentes vão quando não estão com a demanda: o ponto em que ficam
// (os pés, ou a linha do assento para quem senta) e a pose em que ficam lá.
export const LUGARES: Record<string, Lugar> = {
  cafe1: { ponto: [120, 968], pose: 'frente', uso: 'cafe' },
  cafe2: { ponto: [258, 968], pose: 'frente', uso: 'cafe' },
  cafe3: { ponto: [335, 968], pose: 'frente', uso: 'cafe' },
  cafe4: { ponto: [425, 968], pose: 'frente', uso: 'cafe' },
  sofaDescontracao: { ponto: [1042, 940], pose: 'sentado', uso: 'descontracao' },
  pebolim1: { ponto: [1193, 1012], pose: 'costas', uso: 'descontracao', par: 'pebolim2' },
  pebolim2: { ponto: [1193, 912], pose: 'frente', uso: 'descontracao', par: 'pebolim1' },
  sofaCentro1: { ponto: [752, 293], pose: 'sentado', uso: 'cochilo' },
  sofaCentro2: { ponto: [802, 293], pose: 'sentado', uso: 'cochilo' },
  sofaLobby1: { ponto: [290, 112], pose: 'sentado', uso: 'cochilo' },
  sofaLobby2: { ponto: [345, 112], pose: 'sentado', uso: 'cochilo' },
}

// A malha é uma árvore: cada trilha liga os nós na ordem em que aparecem.
const TRILHAS: readonly (readonly string[])[] = [
  ['frank', 'hall', 'hOeste', 'hCentro', 'juncao'],
  ['prime', 'lounge', 'hCentro'],
  ['juncao', 'vFullstack2', 'vFullstack1', 'cas', 'almeida'],
  ['vFullstack2', 'tiobill', 'mio'],
  ['juncao', 'vEspecialistas1', 'vBanco', 'vEspecialistas2', 'vQualidade', 'sulLeste'],
  ['vEspecialistas1', 'saitama', 'gojo', 'goku', 'aizen'],
  ['vEspecialistas2', 'ichigo', 'luffy', 'meruem', 'madara', 'naruto'],
  ['vBanco', 'tiquinho'],
  ['vQualidade', 'soares'],
  ['sulLeste', 'sulDescontracao', 'sulCafe', 'cafePorta', 'cafe4', 'cafe3', 'cafe2', 'cafe1'],
  ['sulDescontracao', 'descontracaoPorta', 'descontracaoSofa', 'descontracaoMeio', 'pebolimSul', 'pebolim1'],
  ['descontracaoSofa', 'sofaDescontracao'],
  ['descontracaoMeio', 'pebolimNorte', 'pebolim2'],
  ['lounge', 'sofaCentro1', 'sofaCentro2'],
  ['hall', 'lobby', 'sofaLobby1'],
  ['lobby', 'sofaLobby2'],
]

const VIZINHOS = new Map<string, string[]>()

for (const trilha of TRILHAS) {
  for (let i = 1; i < trilha.length; i += 1) {
    const a = trilha[i - 1] as string
    const b = trilha[i] as string
    VIZINHOS.set(a, [...(VIZINHOS.get(a) ?? []), b])
    VIZINHOS.set(b, [...(VIZINHOS.get(b) ?? []), a])
  }
}

function pontoDoNo(no: string): Ponto {
  const cruzamento = CRUZAMENTOS[no] ?? LUGARES[no]?.ponto

  return cruzamento ?? AGENTES[no as IdAgente].pe
}

// Onde ficam os pés do agente quando ele se levanta da cadeira.
export function assento(id: IdAgente): Ponto {
  const agente = AGENTES[id]

  return [agente.x, agente.corte + 13]
}

function nosEntre(de: string, para: string): string[] {
  const anterior = new Map<string, string>([[de, de]])
  const fila = [de]

  while (fila.length > 0) {
    const atual = fila.shift() as string

    if (atual === para) {
      break
    }

    for (const vizinho of VIZINHOS.get(atual) ?? []) {
      if (!anterior.has(vizinho)) {
        anterior.set(vizinho, atual)
        fila.push(vizinho)
      }
    }
  }

  const caminho = [para]

  while (caminho[0] !== de) {
    caminho.unshift(anterior.get(caminho[0] as string) as string)
  }

  return caminho
}

function alinhados(a: Ponto, b: Ponto, c: Ponto): boolean {
  return (b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0])
}

// Trajeto de quem sai da cadeira de `de` até `destino`: um lugar do
// escritório ou, com o id de um colega, o ponto de pé ao lado da mesa dele.
export function rotaAte(de: IdAgente, destino: string): Ponto[] {
  const pontos = [assento(de), ...nosEntre(de, destino).map(pontoDoNo)]

  return pontos.filter((ponto, i) => {
    const antes = pontos[i - 1]
    const depois = pontos[i + 1]

    return antes === undefined || depois === undefined || !alinhados(antes, ponto, depois)
  })
}

// Trajeto de quem sai da cadeira de `de` até ficar de pé ao lado de `para`.
export function rota(de: IdAgente, para: IdAgente): Ponto[] {
  return rotaAte(de, para)
}

export function comprimento(pontos: readonly Ponto[]): number {
  let total = 0

  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1] as Ponto
    const b = pontos[i] as Ponto
    total += Math.hypot(b[0] - a[0], b[1] - a[1])
  }

  return total
}

export function temposDaEntrega(de: IdAgente, para: IdAgente): Tempos {
  const trecho = Math.min(TRECHO_MAXIMO, Math.max(TRECHO_MINIMO, comprimento(rota(de, para)) / VELOCIDADE))
  const ida = Math.round(trecho * 100) / 100

  return { ida, pausa: PAUSA_NA_ENTREGA, volta: ida, total: ida * 2 + PAUSA_NA_ENTREGA }
}

// A parte de um trajeto percorrida até a fração `alcance` do comprimento dele.
function trechoInicial(pontos: readonly Ponto[], alcance: number): Ponto[] {
  if (alcance >= 1) {
    return [...pontos]
  }

  const alvo = comprimento(pontos) * Math.max(0, alcance)
  const trecho: Ponto[] = [pontos[0] as Ponto]
  let andado = 0

  for (let i = 1; i < pontos.length; i += 1) {
    const de = pontos[i - 1] as Ponto
    const para = pontos[i] as Ponto
    const passo = Math.hypot(para[0] - de[0], para[1] - de[1])

    if (andado + passo >= alvo) {
      const parte = passo === 0 ? 0 : (alvo - andado) / passo
      trecho.push([de[0] + (para[0] - de[0]) * parte, de[1] + (para[1] - de[1]) * parte])

      return trecho
    }

    andado += passo
    trecho.push(para)
  }

  return trecho
}

// Onde quem visita o colega `id` fica parado: ao lado da mesa, no corredor.
export function aoLadoDe(id: IdAgente): Ponto {
  const agente = AGENTES[id]
  const [x, y] = agente.pe

  return Math.abs(x - agente.x) >= AO_LADO_DO_COLEGA ? agente.pe : [x + AO_LADO_DO_COLEGA, y]
}

// O trajeto completo de uma rotina, da cadeira do agente até onde ele para.
function trajetoCompleto(agente: IdAgente, tipo: Rotina['tipo'], destino: string): Ponto[] {
  const pontos = rotaAte(agente, destino)
  const parada = tipo === 'conversa' ? aoLadoDe(destino as IdAgente) : (pontos[pontos.length - 1] as Ponto)
  const ultimo = pontos[pontos.length - 1] as Ponto

  return ultimo[0] === parada[0] && ultimo[1] === parada[1] ? pontos : [...pontos, parada]
}

// O trajeto que a rotina de fato percorre (até onde o agente foi).
export function trajetoDaRotina(rotina: Rotina): Ponto[] {
  return trechoInicial(trajetoCompleto(rotina.agente, rotina.tipo, rotina.destino), rotina.alcance)
}

// Segundos de caminhada, em ritmo de passeio, até o destino de uma rotina.
export function tempoDoPasseio(agente: IdAgente, tipo: Rotina['tipo'], destino: string): number {
  const trecho = comprimento(trajetoCompleto(agente, tipo, destino)) / VELOCIDADE_DO_PASSEIO

  return Math.round(Math.min(PASSEIO_MAXIMO, Math.max(PASSEIO_MINIMO, trecho)) * 100) / 100
}

// Segundos, desde o início do período, em que a rotina termina (o agente
// está de volta na cadeira).
export function fimDaRotina(rotina: Rotina): number {
  return rotina.atraso + rotina.ida * 2 + rotina.permanencia
}

// Milissegundos que a animação do passo ocupa antes de o próximo poder começar.
export function duracaoDoPasso(passo: Passo): number {
  if (passo.tipo === 'entrega') {
    return Math.round(temposDaEntrega(passo.de, passo.para).total * 1000) + 100
  }

  if (passo.tipo === 'chegada') {
    return TEMPO_CHEGADA * 1000 + 200
  }

  if (passo.tipo === 'conclusao') {
    return TEMPO_SAIDA * 1000 + 400
  }

  return 0
}
