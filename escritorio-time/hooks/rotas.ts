import type { IdAgente, Passo } from '../types'
import { AGENTES } from './equipe'
import type { Ponto } from './equipe'

export type Tempos = { ida: number; pausa: number; volta: number; total: number }

// Segundos que o papel leva para chegar à recepção e para sair dela.
export const TEMPO_CHEGADA = 1.4
export const TEMPO_SAIDA = 1.4

const VELOCIDADE = 330
const TRECHO_MINIMO = 0.9
const TRECHO_MAXIMO = 3
const PAUSA_NA_ENTREGA = 0.5

// Cruzamentos dos corredores, no sistema de coordenadas do escritório.
const CRUZAMENTOS: Record<string, Ponto> = {
  hall: [320, 372],
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
}

// A malha é uma árvore: cada trilha liga os nós na ordem em que aparecem.
const TRILHAS: readonly (readonly string[])[] = [
  ['frank', 'hall', 'hOeste', 'hCentro', 'juncao'],
  ['prime', 'lounge', 'hCentro'],
  ['juncao', 'vFullstack2', 'vFullstack1', 'cas', 'almeida'],
  ['vFullstack2', 'tiobill', 'mio'],
  ['juncao', 'vEspecialistas1', 'vBanco', 'vEspecialistas2', 'vQualidade'],
  ['vEspecialistas1', 'saitama', 'gojo', 'goku', 'aizen'],
  ['vEspecialistas2', 'ichigo', 'luffy', 'meruem', 'madara', 'naruto'],
  ['vBanco', 'tiquinho'],
  ['vQualidade', 'soares'],
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
  const cruzamento = CRUZAMENTOS[no]

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

// Trajeto de quem sai da cadeira de `de` até ficar de pé ao lado de `para`.
export function rota(de: IdAgente, para: IdAgente): Ponto[] {
  const pontos = [assento(de), ...nosEntre(de, para).map(pontoDoNo)]

  return pontos.filter((ponto, i) => {
    const antes = pontos[i - 1]
    const depois = pontos[i + 1]

    return antes === undefined || depois === undefined || !alinhados(antes, ponto, depois)
  })
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
