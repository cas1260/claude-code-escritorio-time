import { expect, mock, test } from 'claude-code/testing'

import type { Cena, IdAgente, Rotina, Vida } from '../types'
import {
  LIMITE_SVG,
  alturaDoQuadro,
  larguraDoQuadro,
  montarCena,
  montarFala,
  montarFundo,
  montarVida,
  quebrarFala,
} from '../hooks/cenario'
import { SPRITES } from '../hooks/dados-sprites'
import {
  ROTEIRO_INICIAL,
  VIDA_INICIAL,
  agentesNomeados,
  avancar,
  concluir,
  envolvidos,
  especialistaDoArquivo,
  fimDaVida,
  interromper,
  passarPara,
  planejarVida,
  receberDemanda,
  recolher,
  voltaDe,
} from '../hooks/diretor'
import { AGENTES, IDS } from '../hooks/equipe'
import { LUGARES, fimDaRotina, rota, rotaAte, tempoDoPasseio, trajetoDaRotina } from '../hooks/rotas'
import { TIME } from '../hooks/time'

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
        const desenho = montarCena(cena, 0, VIDA_INICIAL, 0)

        expect(rota(de, para).length).toBeGreaterThan(1)
        expect(desenho.length).toBeLessThanOrEqual(LIMITE_DA_CENA)
        expect(montarFala(cena, 0, fala, VIDA_INICIAL, 0).length).toBeLessThanOrEqual(LIMITE_DA_CENA)
        // a camada dos agentes é transparente: nada de fundo nela
        expect(desenho).not.toContain('url(')
        expect(desenho).not.toContain('<image')
      }
    }
  }
})

test('as camadas transparentes acompanham o tema do app', () => {
  // cada camada fica num quadro próprio; sem esta declaração, no tema escuro
  // o quadro é pintado de branco opaco e a camada esconde o escritório
  const esquema = '<style>:root{color-scheme:light dark}</style>'
  const cena: Cena = { ...ROTEIRO_INICIAL.cena, portador: 'goku', ativo: true }
  const cafe: Rotina = { agente: 'mio', tipo: 'cafe', destino: 'cafe1', atraso: 2, ida: 5, permanencia: 10, alcance: 1 }
  const vida: Vida = { seq: 1, inicio: 0, rotinas: [cafe] }
  const camadas = [montarCena(cena, 0, vida, 5), montarVida(vida, 5), montarFala(cena, 0, 'editando Pedido.cs', vida, 5)]

  for (const camada of camadas) {
    expect(camada.startsWith('<svg ')).toBe(true)
    expect(camada.includes(esquema)).toBe(true)
  }

  // o fundo pinta a própria imagem no quadro inteiro e não depende disso
  expect(montarFundo().includes('<style')).toBe(false)
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
  expect(montarCena(cena, 1.5, VIDA_INICIAL, 0)).toContain('begin="-1.5s"')
  expect(montarCena(cena, 1.5, VIDA_INICIAL, 0)).toContain('type="scale"')

  // depois que o passo acabou: sem caminhante, Prime trabalhando com o balão,
  // que fica na camada dele
  expect(montarCena(cena, 60, VIDA_INICIAL, 0)).not.toContain('type="scale"')
  const balao = montarFala(cena, 60, 'lendo cenario.ts', VIDA_INICIAL, 0)
  expect(balao).toContain('fill="#101018">Prime</text>')
  expect(balao).toContain('>lendo cenario.ts</text>')
  expect(montarCena(cena, 60, VIDA_INICIAL, 0)).not.toContain('>lendo cenario.ts</text>')

  // sem ninguém trabalhando não há balão
  expect(montarFala(ROTEIRO_INICIAL.cena, 0, null, VIDA_INICIAL, 0)).toBe('')
})

test('a fala do balão cabe em duas linhas curtas', () => {
  expect(quebrarFala('editando Login.cs')).toEqual(['editando Login.cs'])

  const longa = quebrarFala('executando: Roda os testes do mod com claude plugin test <dir> & mais')
  expect(longa).toHaveLength(2)
  expect(longa.every(linha => linha.length <= 24)).toBe(true)
  expect(longa[1]).toEndWith('…')
  expect(
    montarFala({ ...ROTEIRO_INICIAL.cena, portador: 'goku', ativo: true }, 0, 'a < b & c', VIDA_INICIAL, 0),
  ).toContain('>a &lt; b &amp; c</text>')
})

test('a malha de corredores leva todo agente a todo lugar do escritório', () => {
  for (const id of IDS) {
    for (const [nome, lugar] of Object.entries(LUGARES)) {
      const trajeto = rotaAte(id, nome)
      const tempo = tempoDoPasseio(id, lugar.uso, nome)

      expect(trajeto.length).toBeGreaterThan(1)
      expect(trajeto[trajeto.length - 1]).toEqual(lugar.ponto)
      expect(tempo).toBeGreaterThanOrEqual(1.2)
      expect(tempo).toBeLessThanOrEqual(6)
    }
  }

  // quem visita um colega para ao lado da mesa, não em cima dele
  const visita: Rotina = {
    agente: 'cas',
    tipo: 'conversa',
    destino: 'goku',
    atraso: 2,
    ida: 5,
    permanencia: 10,
    alcance: 1,
  }
  const parada = trajetoDaRotina(visita).pop()
  expect(parada).toEqual([AGENTES.goku.pe[0] + 44, AGENTES.goku.pe[1]])

  // quem deu meia-volta na metade do caminho andou a metade do trajeto
  const inteiro = trajetoDaRotina(visita)
  const metade = trajetoDaRotina({ ...visita, alcance: 0.5 })
  const andar = (pontos: (readonly [number, number])[]): number =>
    pontos.reduce((soma, ponto, i) => {
      const antes = pontos[i - 1]

      return antes === undefined ? 0 : soma + Math.hypot(ponto[0] - antes[0], ponto[1] - antes[1])
    }, 0)
  expect(Math.round(andar(metade) * 2)).toBe(Math.round(andar(inteiro)))
})

test('quem está sem demanda passeia; quem está envolvido fica na cadeira', () => {
  const tipos = new Set<string>()

  for (let i = 0; i < 300; i += 1) {
    const ocupados: readonly IdAgente[] = i % 2 === 0 ? ['frank', 'goku'] : ['prime']
    const vida = planejarVida({ ...VIDA_INICIAL, seq: i }, 1000 + i * 37123, ocupados)
    const agentes = vida.rotinas.map(rotina => rotina.agente)
    const destinos = vida.rotinas.map(rotina => rotina.destino)

    expect(vida.seq).toBe(i + 1)
    expect(vida.rotinas.length).toBeGreaterThan(0)
    expect(vida.rotinas.length).toBeLessThanOrEqual(4)
    // ninguém sai duas vezes, dois não vão ao mesmo lugar e quem recebe uma
    // visita não saiu
    expect(new Set([...agentes, ...destinos]).size).toBe(agentes.length + destinos.length)

    for (const rotina of vida.rotinas) {
      tipos.add(rotina.tipo)
      expect(ocupados.some(id => id === rotina.agente || id === rotina.destino)).toBe(false)

      if (rotina.tipo === 'conversa') {
        expect(IDS.some(id => id === rotina.destino)).toBe(true)
      } else {
        const lugar = LUGARES[rotina.destino]
        expect(lugar?.uso).toBe(rotina.tipo)
        // sentados, Tiquinho e Soares mostram as costas: não vão para o sofá
        expect(lugar?.pose === 'sentado' && (rotina.agente === 'tiquinho' || rotina.agente === 'soares')).toBe(false)
      }
    }

    // saem um depois do outro e o período acaba quando o último volta
    expect(vida.rotinas.every((rotina, n) => rotina.atraso > (vida.rotinas[n - 1]?.atraso ?? 0))).toBe(true)
    expect(fimDaVida(vida)).toBe(vida.inicio + Math.max(...vida.rotinas.map(fimDaRotina)) * 1000)
  }

  expect([...tipos].sort()).toEqual(['cafe', 'cochilo', 'conversa', 'descontracao'])
  // o mesmo instante combina o mesmo período
  expect(planejarVida(VIDA_INICIAL, 1000, [])).toEqual(planejarVida(VIDA_INICIAL, 1000, []))
})

test('quem é envolvido na demanda é chamado de volta para a cadeira', () => {
  expect(envolvidos(ROTEIRO_INICIAL, 0)).toEqual([])
  expect(envolvidos(passarPara(receberDemanda(ROTEIRO_INICIAL), 'prime', false), 0).sort()).toEqual(['frank', 'prime'])

  const cafe: Rotina = { agente: 'prime', tipo: 'cafe', destino: 'cafe1', atraso: 2, ida: 5, permanencia: 10, alcance: 1 }
  const visita: Rotina = { ...cafe, agente: 'cas', tipo: 'conversa', destino: 'prime' }
  const vida: Vida = { seq: 7, inicio: 0, rotinas: [cafe] }

  // ninguém chamado: o período é o mesmo
  expect(recolher(vida, ['goku'], 5000)).toBe(vida)
  expect(voltaDe(vida, 'prime')).toBe(22000)
  expect(voltaDe(vida, 'goku')).toBe(0)

  // ainda não saiu: fica
  expect(recolher(vida, ['prime'], 1000)).toEqual({ seq: 8, inicio: 0, rotinas: [] })

  // a caminho: dá meia-volta de onde está
  const aCaminho = recolher(vida, ['prime'], 4000)
  expect(aCaminho.rotinas).toEqual([{ ...cafe, ida: 2, permanencia: 0, alcance: 0.4 }])
  expect(voltaDe(aCaminho, 'prime')).toBe(6000)

  // já chegou: volta agora
  const noCafe = recolher(vida, ['prime'], 9000)
  expect(noCafe.rotinas).toEqual([{ ...cafe, permanencia: 2 }])
  expect(voltaDe(noCafe, 'prime')).toBe(14000)

  // já estava voltando: nada muda
  expect(recolher(vida, ['prime'], 18000)).toBe(vida)

  // quem está de conversa na mesa do colega chamado também volta
  const conversa: Vida = { seq: 1, inicio: 0, rotinas: [visita] }
  expect(recolher(conversa, ['prime'], 9000).rotinas).toEqual([{ ...visita, permanencia: 2 }])
})

test('as rotinas cabem na camada dos agentes e não deixam rastro', () => {
  const parada: Cena = { ...ROTEIRO_INICIAL.cena, portador: 'goku', ativo: true }
  const semVida = montarCena(parada, 0, VIDA_INICIAL, 0)

  // os quatro agentes de desenho mais pesado passeando e o quinto levando o papel
  const peso = (id: IdAgente): number =>
    Object.values(SPRITES[id]).reduce((soma, quadro) => soma + quadro.d.length, 0)
  const pesados = [...IDS].sort((a, b) => peso(b) - peso(a))
  const lugares = ['sofaLobby1', 'sofaLobby2', 'sofaCentro1', 'sofaDescontracao']
  const rotinas = lugares.map((destino, n): Rotina => {
    const agente = pesados[n] ?? 'frank'

    return { agente, tipo: 'cochilo', destino, atraso: 2, ida: tempoDoPasseio(agente, 'cochilo', destino), permanencia: 20, alcance: 1 }
  })
  const vida: Vida = { seq: 1, inicio: 0, rotinas }
  const entrega: Cena = {
    seq: 1,
    inicio: 0,
    duracao: 0,
    passo: { tipo: 'entrega', de: pesados[4] ?? 'frank', para: pesados[5] ?? 'prime' },
    portador: pesados[5] ?? 'prime',
    ativo: true,
  }
  expect(montarCena(entrega, 0.5, vida, 5).length).toBeLessThanOrEqual(LIMITE_DA_CENA)
  expect(montarVida(vida, 5).length).toBeLessThanOrEqual(LIMITE_DA_CENA)

  for (let i = 0; i < 200; i += 1) {
    const sorteada = planejarVida({ ...VIDA_INICIAL, seq: i }, 1000 + i * 37123, ['goku'])

    expect(montarCena(entrega, 0.5, sorteada, 12).length).toBeLessThanOrEqual(LIMITE_DA_CENA)
    expect(montarVida(sorteada, 12).length).toBeLessThanOrEqual(LIMITE_DA_CENA)
  }

  // no meio do período: o passeio retoma do ponto em que está, na camada das
  // rotinas, e na camada dos agentes a cadeira de quem saiu fica vazia
  const cafe: Rotina = { agente: 'mio', tipo: 'cafe', destino: 'cafe1', atraso: 2, ida: 5, permanencia: 10, alcance: 1 }
  const comCafe = montarVida({ seq: 1, inicio: 0, rotinas: [cafe] }, 9.5)
  expect(comCafe.includes('begin="-9.5s"')).toBe(true)
  expect(comCafe.includes('begin="-7.5s"')).toBe(true)
  expect(comCafe.includes('dur="20s"')).toBe(true)
  expect(comCafe.includes('url(')).toBe(false)

  const cadeiraVazia = montarCena(parada, 0, { seq: 1, inicio: 0, rotinas: [cafe] }, 9.5)
  expect(cadeiraVazia.includes('begin="-9.5s"')).toBe(true)
  expect(cadeiraVazia.includes('dur="20s"')).toBe(false)
  expect(semVida.includes('begin="-9.5s"')).toBe(false)

  // cada um leva o que é da rotina dele
  const cochilo: Rotina = { ...cafe, tipo: 'cochilo', destino: 'sofaCentro1' }
  expect(montarVida({ seq: 1, inicio: 0, rotinas: [cochilo] }, 9.5).includes('>z</text>')).toBe(true)
  expect(comCafe.includes('>z</text>')).toBe(false)

  // quem deu meia-volta antes de chegar não traz xícara
  const meiaVolta = montarVida({ seq: 1, inicio: 0, rotinas: [{ ...cafe, ida: 2, permanencia: 0, alcance: 0.4 }] }, 3)
  expect(meiaVolta.includes('dur="4s"')).toBe(true)
  expect(meiaVolta.length).toBeLessThan(comCafe.length)

  // terminado o período, não sobra passeio e o escritório é o de antes
  expect(montarVida({ seq: 1, inicio: 0, rotinas: [cafe] }, 60)).toBe('')
  expect(montarVida(VIDA_INICIAL, 0)).toBe('')
  expect(montarCena(parada, 0, { seq: 1, inicio: 0, rotinas: [cafe] }, 60) === semVida).toBe(true)

  // o balão de quem recebeu a demanda fora da cadeira espera ele voltar
  const esperando = montarFala(parada, 100, 'editando Pedido.cs', { seq: 1, inicio: 0, rotinas: [{ ...cafe, agente: 'goku' }] }, 10)
  expect(esperando.includes('begin="-100s"')).toBe(true)
  expect(esperando.includes('dur="113s"')).toBe(true)
})

test('no painel os agentes passeiam e voltam quando a demanda chega para eles', async ($, on) => {
  const relogio = mock.clock(on, { now: 1000 })
  on('session.start', ($$, e) => ({ cwd: e.cwd }))
  on('command.register', ($$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('turn.start', ($$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/projeto', surface: 'desktop', isInteractive: true })

  const painel = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const camada = async (chave: string): Promise<string> =>
    String((await painel.find({ type: 'Svg', in: chave }))?.props.source ?? '')
  const cenas = async (): Promise<string> => `${await camada('cenaA')}${await camada('cenaB')}`
  const passeios = async (): Promise<string> => `${await camada('vidaA')}${await camada('vidaB')}`
  const falas = async (): Promise<string> => `${await camada('falaA')}${await camada('falaB')}`

  // o período que o mod combinou ao começar a sessão, e nele alguém que tem
  // extensão de arquivo (para a demanda chegar a ele por uma edição)
  const combinado = planejarVida(VIDA_INICIAL, 1000, [])
  const passeio = combinado.rotinas.find(rotina => AGENTES[rotina.agente].extensoes.length > 0)
  expect(passeio).toBeDefined()
  expect(combinado.rotinas.some(rotina => rotina.agente === 'frank' || rotina.destino === 'frank')).toBe(false)

  if (passeio === undefined) {
    return
  }

  // no meio da ida dele o desenho mostra as rotinas no ponto em que estão
  const meio = Math.round(passeio.atraso * 1000 + passeio.ida * 500)
  const inteiro = `dur="${String(Math.round((passeio.ida * 2 + passeio.permanencia) * 10000) / 10000)}s"`
  await relogio.advance(meio)
  await painel.advance(600)
  expect((await passeios()).includes(`begin="${String(-Math.round(meio / 10) / 100)}s"`)).toBe(true)
  expect((await passeios()).includes(inteiro)).toBe(true)
  // os passeios ficam na camada deles, não na dos agentes nas mesas
  expect((await cenas()).includes(inteiro)).toBe(false)

  // a demanda chega à recepção: os agentes nas mesas são refeitos, mas quem
  // está passeando não é (nada de recomeçar a caminhada no meio do caminho)
  const antes = { cenas: await cenas(), passeios: await passeios() }
  await $.turn.start({ text: 'Criar a tela de login', turnId: 't1' })
  await painel.advance(600)
  expect((await cenas()) === antes.cenas).toBe(false)
  expect((await passeios()) === antes.passeios).toBe(true)

  // a demanda chega a ele: dá meia-volta e leva para voltar o que já andou
  const andado = Math.round((meio / 1000 - passeio.atraso) * 100) / 100
  const arquivo = `src/arquivo.${AGENTES[passeio.agente].extensoes[0] ?? ''}`
  await $.tool.call({ tool: 'Edit', tool_use_id: 'v1', file_path: arquivo, old_string: 'a', new_string: 'b' })
  await painel.advance(600)
  expect((await passeios()).includes(`dur="${String(Math.round(andado * 2 * 10000) / 10000)}s"`)).toBe(true)

  // de volta à cadeira, é ele quem aparece trabalhando
  await relogio.advance(60000)
  await painel.advance(1200)
  expect((await falas()).includes(`fill="#101018">${AGENTES[passeio.agente].nome}</text>`)).toBe(true)

  await painel.unmount()
})

test('o time vai junto com o mod, nas instruções da sessão', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }))

  const { sections } = await $.prompt.compose({
    model: 'claude-opus-5-5',
    promptModel: 'claude-opus-5-5',
    surfaces: ['desktop'],
    tools: [],
    outputStyle: null,
    traits: [],
  })
  const time = sections[sections.length - 1]

  expect(sections[0]).toEqual({ id: 'intro', text: 'base', scope: 'shared' })
  expect(time).toEqual({ id: 'escritorio-time:time', text: TIME, scope: 'session' })

  // o texto apresenta os 17 agentes e a forma de se identificar que o painel lê
  for (const id of IDS) {
    expect(TIME).toContain(AGENTES[id].nomes[0] ?? '')
  }

  const exemplos = TIME.split('\n').flatMap(linha => linha.match(/\*\*[^*]+:\*\* .*$/) ?? [])
  expect(exemplos.length).toBeGreaterThan(1)
  expect(exemplos.map(exemplo => agentesNomeados(exemplo)[0]?.id)).toEqual(['prime', 'mio'])
  expect(agentesNomeados(exemplos[1] ?? '')[0]?.emRevisao).toBe(true)
  expect(TIME).toContain('mySystem')
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
  const falas = async (): Promise<string[]> => [await camada('falaA'), await camada('falaB')]
  const legenda = async (texto: string): Promise<unknown> => painel.find({ type: 'Text', text: texto, in: 'legenda' })

  // o desenho do painel: fundo com a arte e 80 colunas -> quadro de 628 x 471
  const fundoInicial = await fundo()
  expect(String(fundoInicial)).toContain('url(data:image/avif;base64,')
  expect((await painel.find({ type: 'Svg' }))?.props.height).toBe(471)

  // as camadas perguntam ao mod e uma delas recebe a cena parada
  await painel.advance(600)
  expect((await cenas()).filter(desenho => desenho !== '')).toHaveLength(1)
  expect((await falas()).filter(desenho => desenho !== '')).toHaveLength(0)
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
  const baloes = (await falas()).join('')
  expect(baloes).toContain('fill="#101018">Goku</text>')
  expect(baloes).toContain('>editando Login.cs</text>')
  expect(await legenda('Goku · C# — editando Login.cs')).toBeDefined()

  // o texto do balão troca na camada dele: a dos agentes não é refeita
  const agentes = await cenas()
  await $.tool.call({ tool: 'Read', tool_use_id: 'c2', file_path: 'src/Login.cs' })
  await painel.advance(1200)
  expect((await falas()).join('')).toContain('>lendo Login.cs</text>')
  expect(await cenas()).toEqual(agentes)

  await $.turn.complete({ answer: 'Pronto.', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  await painel.advance(1200)
  expect(await legenda('Etapa 8/8')).toBeDefined()
  expect(await legenda('Demanda entregue ao cliente')).toBeDefined()

  // em toda a sessão o fundo foi o mesmo desenho: o painel não foi refeito
  expect(await fundo()).toBe(fundoInicial)

  await painel.unmount()
})
