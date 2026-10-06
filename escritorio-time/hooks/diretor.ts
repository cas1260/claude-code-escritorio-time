import type { IdAgente, Passo, Roteiro } from '../types'
import { AGENTES, IDS, rotulo } from './equipe'
import { duracaoDoPasso } from './rotas'

export type Nomeado = { id: IdAgente; emRevisao: boolean }

export const ROTEIRO_INICIAL: Roteiro = {
  cena: { seq: 0, inicio: 0, duracao: 0, passo: null, portador: null, ativo: false },
  fila: [],
  portador: null,
  etapa: 0,
  houveExecucao: false,
}

// Entregas que podem esperar na fila; além disso as duas últimas viram uma só,
// para a animação não ficar para trás do que a sessão está fazendo.
const ENTREGAS_NA_FILA = 2

// Um bloco de texto que rotula mais agentes do que isto é uma listagem (plano,
// resumo, equipe), não uma troca de responsável.
const AGENTES_POR_BLOCO = 2

const NOMES: readonly (readonly [string, IdAgente])[] = IDS.flatMap(id =>
  AGENTES[id].nomes.map(nome => [nome, id] as const),
).sort((a, b) => b[0].length - a[0].length)

const ID_POR_NOME = new Map(NOMES)

const ALTERNATIVAS = NOMES.map(([nome]) => nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

// Linha que começa pelo nome de um agente seguido de ":" ou de um travessão:
// "**Prime (Analista Sênior):** ...", "Goku — implementando ...".
const ROTULO = new RegExp(
  `^[^\\p{L}\\n]{0,12}(${ALTERNATIVAS})(?![\\p{L}\\p{N}])(?:[^\\n:]{0,60}:|\\s*(?:\\([^)\\n]{0,40}\\))?\\**\\s+[—–-]\\s)`,
  'gmu',
)

const REVISAO = /\b(?:code review|review|revis[aã]o|revisando|revisor|revisora)\b/iu

const EXECUTORES: readonly string[] = ['fullstack', 'especialista', 'dba']

const ID_POR_EXTENSAO = new Map(IDS.flatMap(id => AGENTES[id].extensoes.map(ext => [ext, id] as const)))

function enfileirar(fila: readonly Passo[], passo: Passo): Passo[] {
  const ultimo = fila[fila.length - 1]
  const entregas = fila.filter(um => um.tipo === 'entrega').length

  if (passo.tipo === 'entrega' && ultimo?.tipo === 'entrega' && entregas >= ENTREGAS_NA_FILA) {
    const resto = fila.slice(0, -1)

    return ultimo.de === passo.para ? resto : [...resto, { tipo: 'entrega', de: ultimo.de, para: passo.para }]
  }

  return [...fila, passo]
}

function etapaAoPassar(para: IdAgente, emRevisao: boolean, houveExecucao: boolean): number {
  if (para === 'frank') {
    return houveExecucao ? 8 : 2
  }

  if (para === 'prime') {
    return houveExecucao ? 6 : 3
  }

  if (para === 'soares') {
    return 7
  }

  return emRevisao ? 5 : 4
}

// Uma demanda nova chega à recepção: o papel vai para o Frank.
export function receberDemanda(roteiro: Roteiro): Roteiro {
  return {
    ...roteiro,
    fila: enfileirar(roteiro.fila, { tipo: 'chegada' }),
    portador: 'frank',
    etapa: 2,
    houveExecucao: false,
  }
}

// O agente `para` assume a demanda: quem está com o papel leva até ele.
export function passarPara(roteiro: Roteiro, para: IdAgente, emRevisao: boolean): Roteiro {
  const base = roteiro.portador === null ? receberDemanda(roteiro) : roteiro
  const de = base.portador ?? 'frank'
  const etapa = etapaAoPassar(para, emRevisao, base.houveExecucao)
  const houveExecucao = base.houveExecucao || EXECUTORES.includes(AGENTES[para].grupo)

  if (de === para) {
    return { ...base, etapa, houveExecucao }
  }

  return {
    ...base,
    fila: enfileirar(base.fila, { tipo: 'entrega', de, para }),
    portador: para,
    etapa,
    houveExecucao,
  }
}

// O turno terminou com resposta: a demanda volta ao Frank, que entrega.
export function concluir(roteiro: Roteiro): Roteiro {
  if (roteiro.portador === null) {
    return roteiro
  }

  const fila =
    roteiro.portador === 'frank'
      ? roteiro.fila
      : enfileirar(roteiro.fila, { tipo: 'entrega', de: roteiro.portador, para: 'frank' })

  return { ...roteiro, fila: [...fila, { tipo: 'conclusao' }], portador: null, etapa: 8 }
}

// O turno foi interrompido: todos param, o papel fica onde está.
export function interromper(roteiro: Roteiro): Roteiro {
  if (roteiro.portador === null) {
    return roteiro
  }

  return { ...roteiro, fila: [...roteiro.fila, { tipo: 'parada' }] }
}

// Há um passo sendo animado em cena neste instante.
export function emAnimacao(roteiro: Roteiro, agora: number): boolean {
  return agora < roteiro.cena.inicio + roteiro.cena.duracao
}

export function podeAvancar(roteiro: Roteiro, agora: number): boolean {
  return roteiro.fila.length > 0 && !emAnimacao(roteiro, agora)
}

// Milissegundos até o próximo passo da fila poder ser exibido; -1 sem fila.
export function restante(roteiro: Roteiro, agora: number): number {
  if (roteiro.fila.length === 0) {
    return -1
  }

  return Math.max(0, roteiro.cena.inicio + roteiro.cena.duracao - agora)
}

// Exibe o próximo passo da fila, se a animação em cena já terminou.
export function avancar(roteiro: Roteiro, agora: number): Roteiro {
  const passo = roteiro.fila[0]

  if (passo === undefined || !podeAvancar(roteiro, agora)) {
    return roteiro
  }

  let portador = roteiro.cena.portador

  if (passo.tipo === 'chegada') {
    portador = 'frank'
  } else if (passo.tipo === 'entrega') {
    portador = passo.para
  } else if (passo.tipo === 'conclusao') {
    portador = null
  }

  // Depois de uma chegada ou de uma entrega, quem ficou com o papel trabalha.
  const ativo = passo.tipo === 'chegada' || passo.tipo === 'entrega'

  return {
    ...roteiro,
    fila: roteiro.fila.slice(1),
    cena: { seq: roteiro.cena.seq + 1, inicio: agora, duracao: duracaoDoPasso(passo), passo, portador, ativo },
  }
}

// Agentes que o texto rotula, na ordem em que aparecem.
export function agentesNomeados(texto: string): Nomeado[] {
  const achados: Nomeado[] = []

  for (const achado of texto.matchAll(ROTULO)) {
    const id = ID_POR_NOME.get(achado[1] ?? '')

    if (id !== undefined) {
      const fim = texto.indexOf('\n', achado.index)
      const linha = texto.slice(achado.index, fim < 0 ? undefined : fim)
      achados.push({ id, emRevisao: REVISAO.test(linha) })
    }
  }

  return new Set(achados.map(um => um.id)).size > AGENTES_POR_BLOCO ? [] : achados
}

// O especialista da stack do arquivo, pela extensão.
export function especialistaDoArquivo(caminho: string): IdAgente | null {
  const ponto = caminho.lastIndexOf('.')

  if (ponto < 0) {
    return null
  }

  return ID_POR_EXTENSAO.get(caminho.slice(ponto + 1).toLowerCase()) ?? null
}

// A extensão só decide enquanto ninguém que implementa foi nomeado no texto.
export function aceitaInferencia(portador: IdAgente | null): boolean {
  return portador === null || portador === 'frank' || portador === 'prime'
}

function nomeDoArquivo(caminho: string): string {
  return caminho.split(/[\\/]/).pop() ?? caminho
}

function encurtar(texto: string, limite: number): string {
  const linha = texto.replace(/\s+/g, ' ').trim()

  return linha.length > limite ? `${linha.slice(0, limite - 1)}…` : linha
}

function campo(campos: Readonly<Record<string, unknown>>, nome: string): string | undefined {
  const valor = campos[nome]

  return typeof valor === 'string' && valor !== '' ? valor : undefined
}

// O arquivo que a chamada de ferramenta escreve, quando escreve algum.
export function arquivoEditado(ferramenta: string, campos: Readonly<Record<string, unknown>>): string | undefined {
  if (ferramenta === 'Edit' || ferramenta === 'Write') {
    return campo(campos, 'file_path')
  }

  return ferramenta === 'NotebookEdit' ? campo(campos, 'notebook_path') : undefined
}

// O que a chamada de ferramenta está fazendo, em poucas palavras.
export function descreverFerramenta(ferramenta: string, campos: Readonly<Record<string, unknown>>): string {
  const arquivo = campo(campos, 'file_path') ?? campo(campos, 'notebook_path')

  if (ferramenta === 'Edit' || ferramenta === 'NotebookEdit') {
    return `editando ${nomeDoArquivo(arquivo ?? 'arquivo')}`
  }

  if (ferramenta === 'Write') {
    return `escrevendo ${nomeDoArquivo(arquivo ?? 'arquivo')}`
  }

  if (ferramenta === 'Read') {
    return `lendo ${nomeDoArquivo(arquivo ?? 'arquivo')}`
  }

  if (ferramenta === 'Bash' || ferramenta === 'PowerShell') {
    return `executando: ${encurtar(campo(campos, 'description') ?? campo(campos, 'command') ?? 'comando', 60)}`
  }

  if (ferramenta === 'Grep' || ferramenta === 'Glob') {
    return `pesquisando ${encurtar(campo(campos, 'pattern') ?? 'no projeto', 40)}`
  }

  if (ferramenta === 'Agent' || ferramenta === 'Task') {
    return `delegando: ${encurtar(campo(campos, 'description') ?? 'subagente', 50)}`
  }

  if (ferramenta === 'WebFetch' || ferramenta === 'WebSearch') {
    return 'pesquisando na web'
  }

  return `usando ${encurtar(ferramenta.split('__').pop() ?? ferramenta, 40)}`
}

// Linha de legenda: quem está com a demanda e o que está fazendo.
export function legenda(roteiro: Roteiro, atividade: string): string {
  if (roteiro.portador === null || atividade === '') {
    return atividade
  }

  return `${rotulo(roteiro.portador)} — ${atividade}`
}

// O que vai no balão de fala: a atividade de quem aparece trabalhando, desde
// que a cena já tenha alcançado quem de fato está com a demanda.
export function falaDaCena(roteiro: Roteiro, atividade: string): string | null {
  const { cena } = roteiro

  return cena.ativo && cena.portador !== null && cena.portador === roteiro.portador && atividade !== ''
    ? atividade
    : null
}
