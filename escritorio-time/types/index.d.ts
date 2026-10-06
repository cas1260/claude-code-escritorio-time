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

declare module 'claude-code' {
  interface PluginState {
    'escritorio-time': { roteiro: Roteiro; atividade: string }
  }
}
