import type { IdAgente, Passo, Rotina, Roteiro, TipoDeRotina, Vida } from '../types'
import { AGENTES, IDS, rotulo } from './equipe'
import { LUGARES, duracaoDoPasso, fimDaRotina, tempoDoPasseio } from './rotas'

export type Nomeado = { id: IdAgente; emRevisao: boolean }

export const ROTEIRO_INICIAL: Roteiro = {
  cena: { seq: 0, inicio: 0, duracao: 0, passo: null, portador: null, ativo: false },
  fila: [],
  portador: null,
  etapa: 0,
  houveExecucao: false,
}

export const VIDA_INICIAL: Vida = { seq: 0, inicio: 0, rotinas: [] }

type Faixa = readonly [number, number]

// Quantos agentes saem da cadeira em cada período, no máximo.
const ROTINAS_POR_PERIODO = 4

// Segundos entre a saída de um agente e a do seguinte.
const ENTRE_SAIDAS: Faixa = [2, 6]

// Chamado de volta com menos do que isto de caminhada (em segundos), o agente
// nem chega a sair da cadeira.
const SAIDA_MINIMA = 0.4

// O que faz quem não está com a demanda: o peso de cada escolha no sorteio e
// os segundos que o agente fica no destino.
const ROTINAS: readonly { tipo: TipoDeRotina; peso: number; permanencia: Faixa }[] = [
  { tipo: 'cafe', peso: 35, permanencia: [7, 12] },
  { tipo: 'conversa', peso: 30, permanencia: [8, 14] },
  { tipo: 'descontracao', peso: 20, permanencia: [10, 18] },
  { tipo: 'cochilo', peso: 15, permanencia: [14, 24] },
]

// O desenho sentado destes agentes mostra as costas (eles trabalham de costas
// para quem olha); num sofá ficariam virados para a parede.
const SENTAM_DE_COSTAS: readonly IdAgente[] = ['tiquinho', 'soares']

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

// Sorteio que se repete para a mesma semente: o mesmo instante combina o
// mesmo período.
function sorteador(semente: number): () => number {
  let estado = semente >>> 0

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let valor = Math.imul(estado ^ (estado >>> 15), estado | 1)
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61)

    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296
  }
}

function entre(sorteio: () => number, [minimo, maximo]: Faixa): number {
  return Math.round((minimo + sorteio() * (maximo - minimo)) * 10) / 10
}

function embaralhar<T>(itens: readonly T[], sorteio: () => number): T[] {
  const copia = [...itens]

  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sorteio() * (i + 1))
    const guardado = copia[i] as T
    copia[i] = copia[j] as T
    copia[j] = guardado
  }

  return copia
}

// As rotinas na ordem em que o agente vai tentá-las: a sorteada pelo peso e,
// se não houver lugar para ela, as outras.
function ordemDeTentativa(sorteio: () => number): typeof ROTINAS {
  let alvo = sorteio() * ROTINAS.reduce((soma, rotina) => soma + rotina.peso, 0)

  for (const rotina of ROTINAS) {
    alvo -= rotina.peso

    if (alvo < 0) {
      return [rotina, ...ROTINAS.filter(outra => outra !== rotina)]
    }
  }

  return ROTINAS
}

// Escolhe o destino da rotina e o tira dos disponíveis; undefined sem vaga.
function destinoDaRotina(
  agente: IdAgente,
  tipo: TipoDeRotina,
  lugares: Set<string>,
  colegas: IdAgente[],
  sorteio: () => number,
): string | undefined {
  if (tipo === 'conversa') {
    return colegas.shift()
  }

  const vagas = [...lugares].filter(nome => {
    const lugar = LUGARES[nome]

    return lugar?.uso === tipo && (lugar.pose !== 'sentado' || !SENTAM_DE_COSTAS.includes(agente))
  })
  // Onde já há alguém esperando companhia, o agente vai fazer companhia.
  const comCompanhia = vagas.find(nome => {
    const par = LUGARES[nome]?.par

    return par !== undefined && !lugares.has(par)
  })
  const escolhido = comCompanhia ?? vagas[Math.floor(sorteio() * vagas.length)]

  if (escolhido !== undefined) {
    lugares.delete(escolhido)
  }

  return escolhido
}

// Quem está envolvido com a demanda neste instante e não sai da cadeira: quem
// está com o papel, quem o está levando e quem vai recebê-lo.
export function envolvidos(roteiro: Roteiro, agora: number): IdAgente[] {
  const emCena = emAnimacao(roteiro, agora) && roteiro.cena.passo !== null ? [roteiro.cena.passo] : []
  const ids = new Set<IdAgente>()

  for (const id of [roteiro.portador, roteiro.cena.portador]) {
    if (id !== null) {
      ids.add(id)
    }
  }

  for (const passo of [...emCena, ...roteiro.fila]) {
    if (passo.tipo === 'entrega') {
      ids.add(passo.de)
      ids.add(passo.para)
    } else if (passo.tipo !== 'parada') {
      ids.add('frank')
    }
  }

  return [...ids]
}

// Combina o próximo período da vida do escritório: quem sai da cadeira, para
// onde e quando. Só passeia quem não está em `ocupados`.
export function planejarVida(anterior: Vida, agora: number, ocupados: readonly IdAgente[]): Vida {
  const sorteio = sorteador(agora + anterior.seq * 7919)
  const livres = embaralhar(
    IDS.filter(id => !ocupados.includes(id)),
    sorteio,
  )
  const colegas = livres.slice(ROTINAS_POR_PERIODO)
  const lugares = new Set(Object.keys(LUGARES))
  const rotinas: Rotina[] = []
  let atraso = 0

  for (const agente of livres.slice(0, ROTINAS_POR_PERIODO)) {
    for (const { tipo, permanencia } of ordemDeTentativa(sorteio)) {
      const destino = destinoDaRotina(agente, tipo, lugares, colegas, sorteio)

      if (destino !== undefined) {
        atraso = Math.round((atraso + entre(sorteio, ENTRE_SAIDAS)) * 10) / 10
        rotinas.push({
          agente,
          tipo,
          destino,
          atraso,
          ida: tempoDoPasseio(agente, tipo, destino),
          permanencia: entre(sorteio, permanencia),
          alcance: 1,
        })
        break
      }
    }
  }

  return { seq: anterior.seq + 1, inicio: agora, rotinas }
}

// O instante (em milissegundos) em que o período termina: todos de volta.
export function fimDaVida(vida: Vida): number {
  return vida.inicio + Math.max(0, ...vida.rotinas.map(fimDaRotina)) * 1000
}

// O instante em que o agente chega de volta à cadeira; 0 se ele não saiu.
export function voltaDe(vida: Vida, id: IdAgente): number {
  const rotina = vida.rotinas.find(uma => uma.agente === id)

  return rotina === undefined ? 0 : vida.inicio + fimDaRotina(rotina) * 1000
}

// Chama de volta quem saiu e passou a ser necessário: o próprio agente, ou
// quem está de conversa na mesa de um colega chamado. Quem ainda não saiu
// fica; quem está a caminho dá meia-volta; quem já chegou volta agora.
export function recolher(vida: Vida, chamados: readonly IdAgente[], agora: number): Vida {
  const tempo = (agora - vida.inicio) / 1000
  const rotinas: Rotina[] = []
  let mudou = false

  for (const rotina of vida.rotinas) {
    const andado = tempo - rotina.atraso
    const chamado =
      chamados.includes(rotina.agente) ||
      (rotina.tipo === 'conversa' && chamados.includes(rotina.destino as IdAgente))

    if (!chamado || andado >= rotina.ida + rotina.permanencia) {
      rotinas.push(rotina)
    } else {
      mudou = true

      if (andado >= rotina.ida) {
        rotinas.push({ ...rotina, permanencia: Math.round((andado - rotina.ida) * 100) / 100 })
      } else if (andado >= SAIDA_MINIMA) {
        const ida = Math.round(andado * 100) / 100
        rotinas.push({ ...rotina, ida, permanencia: 0, alcance: (rotina.alcance * ida) / rotina.ida })
      }
    }
  }

  return mudou ? { ...vida, seq: vida.seq + 1, rotinas } : vida
}
