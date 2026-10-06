import type { IdAgente } from '../types'

export type Grupo = 'gestao' | 'analise' | 'fullstack' | 'especialista' | 'dba' | 'validacao'

export type Ponto = readonly [number, number]

export type Agente = {
  id: IdAgente
  nome: string
  papel: string
  grupo: Grupo
  nomes: readonly string[]
  extensoes: readonly string[]
  x: number
  corte: number
  papelNaMesa: Ponto
  pe: Ponto
}

// Coordenadas no sistema do Escritorio-vazio.png (1448 x 1086).
// x: centro da cadeira; corte: linha em que a cadeira (ou a mesa) esconde o
// corpo; pe: ponto do corredor em que o agente fica de pé ao lado da mesa.
export const AGENTES: Record<IdAgente, Agente> = {
  frank: {
    id: 'frank',
    nome: 'Frank',
    papel: 'Gerente de Projetos',
    grupo: 'gestao',
    nomes: ['Frank'],
    extensoes: [],
    x: 158,
    corte: 270,
    papelNaMesa: [206, 268],
    pe: [272, 340],
  },
  prime: {
    id: 'prime',
    nome: 'Prime',
    papel: 'Analista de Sistemas Sênior',
    grupo: 'analise',
    nomes: ['Prime'],
    extensoes: [],
    x: 555,
    corte: 288,
    papelNaMesa: [598, 318],
    pe: [634, 302],
  },
  cas: {
    id: 'cas',
    nome: 'CAS',
    papel: 'Fullstack Sênior',
    grupo: 'fullstack',
    nomes: ['CAS'],
    extensoes: [],
    x: 1034,
    corte: 261,
    papelNaMesa: [1070, 250],
    pe: [1034, 300],
  },
  almeida: {
    id: 'almeida',
    nome: 'Almeida',
    papel: 'Fullstack Sênior',
    grupo: 'fullstack',
    nomes: ['Almeida'],
    extensoes: [],
    x: 1178,
    corte: 262,
    papelNaMesa: [1214, 251],
    pe: [1178, 300],
  },
  tiobill: {
    id: 'tiobill',
    nome: 'Tio Bill',
    papel: 'Fullstack Sênior',
    grupo: 'fullstack',
    nomes: ['Tio Bill'],
    extensoes: [],
    x: 1037,
    corte: 361,
    papelNaMesa: [1073, 350],
    pe: [1037, 394],
  },
  mio: {
    id: 'mio',
    nome: 'Mio',
    papel: 'Fullstack Sênior',
    grupo: 'fullstack',
    nomes: ['Mio'],
    extensoes: [],
    x: 1185,
    corte: 361,
    papelNaMesa: [1221, 350],
    pe: [1185, 394],
  },
  aizen: {
    id: 'aizen',
    nome: 'Aizen',
    papel: 'PHP',
    grupo: 'especialista',
    nomes: ['Aizen'],
    extensoes: ['php'],
    x: 168,
    corte: 563,
    papelNaMesa: [204, 552],
    pe: [168, 610],
  },
  goku: {
    id: 'goku',
    nome: 'Goku',
    papel: 'C#',
    grupo: 'especialista',
    nomes: ['Goku'],
    extensoes: ['cs', 'cshtml'],
    x: 386,
    corte: 564,
    papelNaMesa: [422, 553],
    pe: [386, 610],
  },
  gojo: {
    id: 'gojo',
    nome: 'Gojo Satoru',
    papel: 'TypeScript',
    grupo: 'especialista',
    nomes: ['Gojo Satoru', 'Gojo'],
    extensoes: ['ts', 'mts', 'cts'],
    x: 621,
    corte: 565,
    papelNaMesa: [657, 554],
    pe: [621, 610],
  },
  saitama: {
    id: 'saitama',
    nome: 'Saitama',
    papel: 'Node.js',
    grupo: 'especialista',
    nomes: ['Saitama'],
    extensoes: ['mjs', 'cjs'],
    x: 819,
    corte: 560,
    papelNaMesa: [855, 549],
    pe: [819, 610],
  },
  naruto: {
    id: 'naruto',
    nome: 'Naruto Uzumaki',
    papel: 'React Native',
    grupo: 'especialista',
    nomes: ['Naruto Uzumaki', 'Naruto'],
    extensoes: [],
    x: 129,
    corte: 741,
    papelNaMesa: [165, 730],
    pe: [129, 788],
  },
  madara: {
    id: 'madara',
    nome: 'Madara Uchiha',
    papel: 'React',
    grupo: 'especialista',
    nomes: ['Madara Uchiha', 'Madara'],
    extensoes: ['tsx', 'jsx'],
    x: 307,
    corte: 741,
    papelNaMesa: [343, 730],
    pe: [307, 788],
  },
  meruem: {
    id: 'meruem',
    nome: 'Meruem',
    papel: 'CSS',
    grupo: 'especialista',
    nomes: ['Meruem'],
    extensoes: ['css', 'scss', 'sass', 'less'],
    x: 477,
    corte: 740,
    papelNaMesa: [513, 729],
    pe: [477, 788],
  },
  luffy: {
    id: 'luffy',
    nome: 'Monkey D. Luffy',
    papel: 'HTML',
    grupo: 'especialista',
    nomes: ['Monkey D. Luffy', 'Luffy'],
    extensoes: ['html', 'htm'],
    x: 657,
    corte: 740,
    papelNaMesa: [693, 729],
    pe: [657, 788],
  },
  ichigo: {
    id: 'ichigo',
    nome: 'Ichigo Kurosaki',
    papel: 'JavaScript',
    grupo: 'especialista',
    nomes: ['Ichigo Kurosaki', 'Ichigo'],
    extensoes: ['js'],
    x: 833,
    corte: 740,
    papelNaMesa: [869, 729],
    pe: [833, 788],
  },
  tiquinho: {
    id: 'tiquinho',
    nome: 'Tiquinho',
    papel: 'DBA Sênior',
    grupo: 'dba',
    nomes: ['Tiquinho'],
    extensoes: ['sql'],
    x: 1149,
    corte: 590,
    papelNaMesa: [1108, 572],
    pe: [1149, 640],
  },
  soares: {
    id: 'soares',
    nome: 'Soares (Neo)',
    papel: 'Validação Final',
    grupo: 'validacao',
    nomes: ['Soares', 'Neo'],
    extensoes: [],
    x: 1189,
    corte: 787,
    papelNaMesa: [1228, 770],
    pe: [1105, 815],
  },
}

export const IDS = Object.keys(AGENTES) as IdAgente[]

// As 8 etapas do fluxo (fluxo.png); o índice 0 é o escritório sem demanda.
export const ETAPAS: readonly string[] = [
  'Aguardando demanda',
  'Cliente / Usuário — Solicitação da demanda',
  'Frank — Recebimento e Priorização',
  'Prime — Análise Técnica e Quebra por Especialidade',
  'Execução por Pacote — Especialistas',
  'Code Review — Especialista + Fullstack + Impacto',
  'Prime — Revisão Técnica Pós-Review',
  'Soares (Neo) — Validação Geral e Consolidação',
  'Frank — Validação Final e Entrega',
]

export function rotulo(id: IdAgente): string {
  const agente = AGENTES[id]

  return `${agente.nome} · ${agente.papel}`
}
