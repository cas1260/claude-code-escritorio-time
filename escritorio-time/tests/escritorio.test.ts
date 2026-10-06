import { expect, mock, test } from 'claude-code/testing'

import type { Cena } from '../types'
import { LIMITE_SVG, montarSvg, quebrarFala } from '../hooks/cenario'
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

test('toda entrega tem rota e o desenho cabe no limite do Svg', () => {
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
        const svg = montarSvg(cena, 0, fala)

        expect(rota(de, para).length).toBeGreaterThan(1)
        expect(svg.length).toBeLessThanOrEqual(LIMITE_SVG)
        // a arte original vai como fundo CSS; o app remove a tag <image>
        expect(svg).toContain('url(data:image/avif;base64,')
        expect(svg).not.toContain('<image')
      }
    }
  }
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
  expect(montarSvg(cena, 1.5, null)).toContain('begin="-1.5s"')
  expect(montarSvg(cena, 1.5, null)).toContain('type="scale"')

  // depois que o passo acabou: sem caminhante, Prime trabalhando com o balão
  const parado = montarSvg(cena, 60, 'lendo cenario.ts')
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
  expect(montarSvg({ ...ROTEIRO_INICIAL.cena, portador: 'goku', ativo: true }, 0, 'a < b & c')).toContain(
    '>a &lt; b &amp; c</text>',
  )
})

test('o painel acompanha a sessão no desktop e no terminal', async ($, on) => {
  const relogio = mock.clock(on, { now: 1000 })
  on('turn.start', ($$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', ($$, e) => ({ text: e.answer }))

  const desktop = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const terminal = await $.ui.mount({ ...PAINEL, surface: 'terminal' })

  expect((await desktop.find({ type: 'Text', text: 'Aguardando demanda' }))?.text).toBe('Aguardando demanda')
  expect(String((await desktop.find({ type: 'Svg' }))?.props.source)).toStartWith('<svg')
  // 80 colunas de painel: quadro de 628 x 471 px, na proporção do escritório.
  expect((await desktop.find({ type: 'Svg' }))?.props.height).toBe(471)
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()

  await $.turn.start({ text: 'Criar a tela de login', turnId: 't1' })
  expect(await desktop.find({ type: 'Text', text: 'Etapa 2/8' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: 'Etapa 2/8' })).toBeDefined()

  // Abaixo dos plugins o kit não tem quem guarde a linha: a chamada rejeita
  // depois de o hook do mod já ter lido o texto, que é o que se verifica aqui.
  await $.session
    .append({
      message: {
        type: 'assistant',
        role: 'assistant',
        content: [{ type: 'text', text: '**Prime (Analista Sênior):** quebrando em pacotes.' }],
      },
      door: 'response',
      origin: { kind: 'model', model: 'teste' },
      uuid: 'linha-1',
    })
    .catch(() => undefined)
  expect(await desktop.find({ type: 'Text', text: 'Etapa 3/8' })).toBeDefined()

  // A chegada e a entrega ao Prime terminam de ser animadas.
  await relogio.advance(20000)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'c1', file_path: 'src/Login.cs', old_string: 'a', new_string: 'b' })
  expect(await desktop.find({ type: 'Text', text: 'Etapa 4/8' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: 'Goku · C# — editando Login.cs' })).toBeDefined()

  // O Prime leva o papel ao Goku, que passa a ser o destaque do desenho,
  // com o balão dizendo o que ele está fazendo.
  await relogio.advance(20000)
  const desenho = String((await desktop.find({ type: 'Svg' }))?.props.source)
  expect(desenho).toContain('fill="#101018">Goku</text>')
  expect(desenho).toContain('>editando Login.cs</text>')

  await $.turn.complete({ answer: 'Pronto.', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(await desktop.find({ type: 'Text', text: 'Etapa 8/8' })).toBeDefined()
  expect(await desktop.find({ type: 'Text', text: 'Demanda entregue ao cliente' })).toBeDefined()

  await desktop.unmount()
  await terminal.unmount()
})
