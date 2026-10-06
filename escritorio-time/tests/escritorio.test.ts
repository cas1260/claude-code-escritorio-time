import { expect, mock, test } from 'claude-code/testing'

import type { Cena } from '../types'
import {
  LIMITE_SVG,
  alturaDoQuadro,
  larguraDoQuadro,
  montarCena,
  montarFundo,
  quebrarFala,
} from '../hooks/cenario'
import {
  ROTEIRO_INICIAL,
  agentesNomeados,
  avancar,
  concluir,
  especialistaDoArquivo,
  interromper,
  passarPara,
  receberDemanda,
} from '../hooks/diretor'
import { IDS } from '../hooks/equipe'
import { rota } from '../hooks/rotas'

const PAINEL = {
  plugin: 'escritorio-time',
  component: 'Pane',
  requestId: 'escritorio',
  props: {
    title: 'Escritório do Time',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

// Os dados de um Client chegam como props; o limite do post é 100.000.
const LIMITE_DA_CENA = 100000

test('o texto da resposta diz quem assume a demanda', () => {
  expect(agentesNomeados('**Prime (Analista Sênior):** quebrando em pacotes')).toEqual([
    { id: 'prime', emRevisao: false },
  ])
  expect(agentesNomeados('Goku — revisando o serviço de pedidos')).toEqual([{ id: 'goku', emRevisao: true }])
  expect(agentesNomeados('**Soares (Neo):** validação geral')).toEqual([{ id: 'soares', emRevisao: false }])
  expect(agentesNomeados('Primeiro passo: ler o arquivo')).toEqual([])
  expect(agentesNomeados('O fluxo é Cliente → Frank → Prime: tudo certo')).toEqual([])
  expect(agentesNomeados('- Frank: recebe\n- Prime: analisa\n- Goku: implementa')).toEqual([])
})

test('a extensão do arquivo indica o especialista', () => {
  expect(especialistaDoArquivo('src/Pedido.cs')).toBe('goku')
  expect(especialistaDoArquivo('C:\\app\\tela.TSX')).toBe('madara')
  expect(especialistaDoArquivo('estilo.css')).toBe('meruem')
  expect(especialistaDoArquivo('LEIAME')).toBeNull()
})

test('a demanda passa de mão em mão e volta ao Frank para a entrega', () => {
  let roteiro = receberDemanda(ROTEIRO_INICIAL)
  roteiro = passarPara(roteiro, 'prime', false)
  roteiro = passarPara(roteiro, 'goku', false)

  expect(roteiro.fila).toEqual([
    { tipo: 'chegada' },
    { tipo: 'entrega', de: 'frank', para: 'prime' },
    { tipo: 'entrega', de: 'prime', para: 'goku' },
  ])
  expect(roteiro.etapa).toBe(4)

  roteiro = avancar(roteiro, 1000)
  expect(roteiro.cena.passo).toEqual({ tipo: 'chegada' })
  expect(roteiro.cena.portador).toBe('frank')
  expect(avancar(roteiro, 1001)).toBe(roteiro)

  roteiro = avancar(roteiro, 1000 + roteiro.cena.duracao)
  expect(roteiro.cena.portador).toBe('prime')

  roteiro = concluir(roteiro)
  expect(roteiro.portador).toBeNull()
  expect(roteiro.etapa).toBe(8)
  expect(roteiro.fila).toEqual([
    { tipo: 'entrega', de: 'prime', para: 'goku' },
    { tipo: 'entrega', de: 'goku', para: 'frank' },
    { tipo: 'conclusao' },
  ])
})

test('a fila junta entregas em atraso e a interrupção deixa o papel onde está', () => {
  let roteiro = receberDemanda(ROTEIRO_INICIAL)

  for (const id of ['prime', 'goku', 'meruem', 'soares'] as const) {
    roteiro = passarPara(roteiro, id, false)
  }

  expect(roteiro.fila).toEqual([
    { tipo: 'chegada' },
    { tipo: 'entrega', de: 'frank', para: 'prime' },
    { tipo: 'entrega', de: 'prime', para: 'soares' },
  ])
  expect(roteiro.etapa).toBe(7)

  const parado = interromper(roteiro)
  expect(parado.portador).toBe('soares')
  expect(parado.fila[parado.fila.length - 1]).toEqual({ tipo: 'parada' })
})

test('o fundo e a cena são desenhos separados e cabem nos limites', () => {
  const fundo = montarFundo()

  // o fundo é só a arte original, como fundo CSS; o app remove a tag <image>
  expect(fundo.length).toBeLessThanOrEqual(LIMITE_SVG)
  expect(fundo).toContain('url(data:image/avif;base64,')
  expect(fundo).not.toContain('<image')
  expect(fundo).not.toContain('<path')

  // a maior fala que o balão mostra: duas linhas cheias
  const fala = `${'m'.repeat(24)} ${'m'.repeat(24)}`

  for (const de of IDS) {
    for (const para of IDS) {
      if (de !== para) {
        const cena: Cena = {
          seq: 1,
          inicio: 0,
          duracao: 0,
          passo: { tipo: 'entrega', de, para },
          portador: para,
          ativo: true,
        }
        const desenho = montarCena(cena, 0, fala)

        expect(rota(de, para).length).toBeGreaterThan(1)
        expect(desenho.length).toBeLessThanOrEqual(LIMITE_DA_CENA)
        // a camada dos agentes é transparente: nada de fundo nela
        expect(desenho).not.toContain('url(')
        expect(desenho).not.toContain('<image')
      }
    }
  }
})

test('as camadas têm o mesmo tamanho, na proporção da arte', () => {
  expect(larguraDoQuadro(85)).toBe(667)
  expect(alturaDoQuadro(85)).toBe(500)
  expect(larguraDoQuadro(1000)).toBe(1448)
  expect(alturaDoQuadro(1000)).toBe(1086)
})

test('o desenho retoma a animação do ponto em que o passo está', () => {
  const cena: Cena = {
    seq: 1,
    inicio: 0,
    duracao: 0,
    passo: { tipo: 'entrega', de: 'frank', para: 'prime' },
    portador: 'prime',
    ativo: true,
  }

  // no meio da caminhada: as animações começam no passado
  expect(montarCena(cena, 1.5, null)).toContain('begin="-1.5s"')
  expect(montarCena(cena, 1.5, null)).toContain('type="scale"')

  // depois que o passo acabou: sem caminhante, Prime trabalhando com o balão
  const parado = montarCena(cena, 60, 'lendo cenario.ts')
  expect(parado).not.toContain('type="scale"')
  expect(parado).toContain('fill="#101018">Prime</text>')
  expect(parado).toContain('>lendo cenario.ts</text>')
})

test('a fala do balão cabe em duas linhas curtas', () => {
  expect(quebrarFala('editando Login.cs')).toEqual(['editando Login.cs'])

  const longa = quebrarFala('executando: Roda os testes do mod com claude plugin test <dir> & mais')
  expect(longa).toHaveLength(2)
  expect(longa.every(linha => linha.length <= 24)).toBe(true)
  expect(longa[1]).toEndWith('…')
  expect(montarCena({ ...ROTEIRO_INICIAL.cena, portador: 'goku', ativo: true }, 0, 'a < b & c')).toContain(
    '>a &lt; b &amp; c</text>',
  )
})

test('fora do desktop o painel é um resumo em texto', async ($, on) => {
  mock.clock(on, { now: 1000 })
  on('turn.start', ($$, e) => ({ turnId: e.turnId }))

  const terminal = await $.ui.mount({ ...PAINEL, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: 'Aguardando demanda' })).toBeDefined()

  await $.turn.start({ text: 'Criar a tela de login', turnId: 't1' })
  expect(await terminal.find({ type: 'Text', text: 'Etapa 2/8' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: 'Frank · Gerente de Projetos — recebendo a nova demanda' })).toBeDefined()

  await terminal.unmount()
})

test('no desktop o fundo fica parado e as camadas de agentes se revezam', async ($, on) => {
  const relogio = mock.clock(on, { now: 1000 })
  on('turn.start', ($$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', ($$, e) => ({ text: e.answer }))

  const painel = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const fundo = async (): Promise<unknown> => (await painel.find({ type: 'Svg' }))?.props.source
  const camada = async (chave: string): Promise<string> =>
    String((await painel.find({ type: 'Svg', in: chave }))?.props.source ?? '')
  const cenas = async (): Promise<string[]> => [await camada('cenaA'), await camada('cenaB')]
  const legenda = async (texto: string): Promise<unknown> => painel.find({ type: 'Text', text: texto, in: 'legenda' })

  // o desenho do painel: fundo com a arte e 80 colunas -> quadro de 628 x 471
  const fundoInicial = await fundo()
  expect(String(fundoInicial)).toContain('url(data:image/avif;base64,')
  expect((await painel.find({ type: 'Svg' }))?.props.height).toBe(471)

  // as camadas perguntam ao mod e uma delas recebe a cena parada
  await painel.advance(600)
  expect((await cenas()).filter(desenho => desenho !== '')).toHaveLength(1)
  expect(await legenda('Aguardando demanda')).toBeDefined()

  // chega uma demanda: a cena nova vai para a OUTRA camada; a antiga continua
  const antes = await cenas()
  await $.turn.start({ text: 'Criar a tela de login', turnId: 't1' })
  await painel.advance(300)
  const durante = await cenas()
  expect(durante.filter(desenho => desenho !== '')).toHaveLength(2)
  expect(durante.some(desenho => desenho !== '' && !antes.includes(desenho))).toBe(true)

  // passado o tempo de troca, a camada antiga é limpa e sobra só a nova
  await relogio.advance(500)
  await painel.advance(600)
  expect((await cenas()).filter(desenho => desenho !== '')).toHaveLength(1)
  expect(await legenda('Etapa 2/8')).toBeDefined()

  // uma edição em .cs leva o papel ao Goku e o balão mostra o que ele faz
  await relogio.advance(20000)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'c1', file_path: 'src/Login.cs', old_string: 'a', new_string: 'b' })
  await relogio.advance(20000)
  await painel.advance(1200)
  const depois = (await cenas()).join('')
  expect(depois).toContain('fill="#101018">Goku</text>')
  expect(depois).toContain('>editando Login.cs</text>')
  expect(await legenda('Goku · C# — editando Login.cs')).toBeDefined()

  await $.turn.complete({ answer: 'Pronto.', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  await painel.advance(1200)
  expect(await legenda('Etapa 8/8')).toBeDefined()
  expect(await legenda('Demanda entregue ao cliente')).toBeDefined()

  // em toda a sessão o fundo foi o mesmo desenho: o painel não foi refeito
  expect(await fundo()).toBe(fundoInicial)

  await painel.unmount()
})
