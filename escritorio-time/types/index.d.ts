export type IdAgente =
  | 'frank'
  | 'prime'
  | 'cas'
  | 'almeida'
  | 'tiobill'
  | 'mio'
  | 'aizen'
  | 'goku'
  | 'gojo'
  | 'saitama'
  | 'naruto'
  | 'madara'
  | 'meruem'
  | 'luffy'
  | 'ichigo'
  | 'tiquinho'
  | 'soares'

export type Passo =
  | { tipo: 'chegada' }
  | { tipo: 'entrega'; de: IdAgente; para: IdAgente }
  | { tipo: 'conclusao' }
  | { tipo: 'parada' }

export type Cena = {
  seq: number
  inicio: number
  duracao: number
  passo: Passo | null
  portador: IdAgente | null
  ativo: boolean
}

export type Roteiro = {
  cena: Cena
  fila: Passo[]
  portador: IdAgente | null
  etapa: number
  houveExecucao: boolean
}

export type TipoDeRotina = 'cafe' | 'conversa' | 'descontracao' | 'cochilo'

// O passeio de um agente que não está com a demanda. Tempos em segundos:
// `atraso` conta do início do período até ele sair da cadeira, `ida` é a
// caminhada até `destino` (um lugar do escritório ou o id do colega visitado)
// e `permanencia` é o tempo que fica lá. `alcance` é a fração do trajeto que
// ele percorre: menos de 1 quando é chamado de volta no meio do caminho.
export type Rotina = {
  agente: IdAgente
  tipo: TipoDeRotina
  destino: string
  atraso: number
  ida: number
  permanencia: number
  alcance: number
}

// Um período da vida do escritório: as rotinas combinadas a partir de `inicio`.
export type Vida = {
  seq: number
  inicio: number
  rotinas: Rotina[]
}

declare module 'claude-code' {
  interface PluginState {
    'escritorio-time': { roteiro: Roteiro; atividade: string; vida: Vida }
  }
}
