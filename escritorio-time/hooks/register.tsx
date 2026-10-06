import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Roteiro, Vida } from '../types'
import { alturaDoQuadro, larguraDoQuadro, montarCena, montarFala, montarFundo, montarVida } from './cenario'
import {
  ROTEIRO_INICIAL,
  VIDA_INICIAL,
  aceitaInferencia,
  agentesNomeados,
  arquivoEditado,
  avancar,
  concluir,
  descreverFerramenta,
  emAnimacao,
  envolvidos,
  especialistaDoArquivo,
  falaDaCena,
  fimDaVida,
  interromper,
  legenda,
  passarPara,
  planejarVida,
  podeAvancar,
  receberDemanda,
  recolher,
  restante,
  voltaDe,
} from './diretor'
import { ETAPAS } from './equipe'
import { TIME } from './time'

const PAINEL = 'escritorio'
const TITULO = 'Escritório do Time'

// Tamanho que o painel pede ao abrir (o app concede até onde o layout deixa
// e respeita o tamanho que a pessoa arrastar): largura para o desenho ficar
// grande e linhas para o desenho mais a legenda.
const ABERTURA = { id: PAINEL, title: TITULO, columns: 132, rows: 44 } as const

// Chaves dos Clients do painel: um par de camadas para os agentes nas mesas,
// um para quem passeia sem demanda, um para o balão de quem trabalha, e a
// legenda. Em cada par as duas camadas se revezam, e um par só é refeito
// quando o que ele mostra muda.
const PARES = {
  cena: ['cenaA', 'cenaB'],
  vida: ['vidaA', 'vidaB'],
  fala: ['falaA', 'falaB'],
} as const
const LEGENDA = 'legenda'

type Par = keyof typeof PARES

// Milissegundos em que a cena antiga continua visível numa camada depois de a
// nova ter sido entregue à outra: a troca nunca deixa o desenho sem agentes.
const TROCA_DE_CAMADA = 350

// O texto de atividade (o balão) troca no máximo uma vez por intervalo, e
// nunca enquanto um passo está sendo animado.
const INTERVALO_DA_ATIVIDADE = 3000

// Milissegundos de escritório parado entre um período de rotinas e o seguinte.
const PAUSA_ENTRE_PERIODOS = 1500

// O time vai junto com o mod: a descrição dele entra nas instruções da sessão.
const SECAO_DO_TIME = { id: 'escritorio-time:time', text: TIME, scope: 'session' } as const

const roteiro = atom({ plugin: 'escritorio-time', key: 'roteiro' } as const, ROTEIRO_INICIAL)
const atividade = atom({ plugin: 'escritorio-time', key: 'atividade' } as const, '')
const vida = atom({ plugin: 'escritorio-time', key: 'vida' } as const, VIDA_INICIAL)

let espera: Timer | undefined
let folga: Timer | undefined
let ultimaAtividade = 0

// O que cada par de camadas deve mostrar agora, qual das duas camadas do par
// recebe o desenho e desde quando.
const quadros: Record<Par, { chave: string; alvo: string; desde: number }> = {
  cena: { chave: '', alvo: PARES.cena[0], desde: 0 },
  vida: { chave: '', alvo: PARES.vida[0], desde: 0 },
  fala: { chave: '', alvo: PARES.fala[0], desde: 0 },
}

function linhaDaEtapa(atual: Roteiro): string {
  return atual.etapa === 0 ? (ETAPAS[0] as string) : `Etapa ${atual.etapa}/8 · ${ETAPAS[atual.etapa] ?? ''}`
}

function medida(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0
}

// Chama de volta à cadeira quem saiu para passear e foi envolvido na demanda.
async function chamarDeVolta($: EngineInterface, atual: Roteiro, agora: number): Promise<Vida> {
  return update($, vida, periodo => recolher(periodo, envolvidos(atual, agora), agora))
}

// Combina um novo período de rotinas quando o anterior termina.
async function viver($: EngineInterface): Promise<void> {
  folga?.cancel()
  const agora = await $.clock.now()
  let periodo = await read($, vida)

  if (agora >= fimDaVida(periodo)) {
    const ocupados = envolvidos(await read($, roteiro), agora)
    periodo = await update($, vida, anterior => planejarVida(anterior, agora, ocupados))
  }

  folga = $.clock.after(Math.max(0, fimDaVida(periodo) - agora) + PAUSA_ENTRE_PERIODOS, () => void viver($))
}

// Exibe o próximo passo da fila quando a animação em cena termina.
async function andar($: EngineInterface): Promise<void> {
  espera?.cancel()
  espera = undefined
  const agora = await $.clock.now()
  let atual = await read($, roteiro)
  const periodo = await chamarDeVolta($, atual, agora)
  const proximo = atual.fila[0]
  // Quem vai levar o papel precisa estar na cadeira antes de o passo começar.
  const chegaEm = proximo?.tipo === 'entrega' ? voltaDe(periodo, proximo.de) : 0

  if (chegaEm > agora) {
    espera = $.clock.after(chegaEm - agora + 40, () => void andar($))

    return
  }

  if (podeAvancar(atual, agora)) {
    atual = await update($, roteiro, anterior => avancar(anterior, agora))
  }

  const falta = restante(atual, agora)

  if (falta >= 0) {
    espera = $.clock.after(falta + 40, () => void andar($))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'escritorio',
      description: 'Abre o painel com o escritório do time',
    })
    void $.ui.open(ABERTURA)
    void andar($)
    void viver($)

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composto = await next(e)

    return { ...composto, sections: [...composto.sections, SECAO_DO_TIME] }
  })

  on('command.run', { command: 'escritorio' }, async $ => {
    await $.ui.open(ABERTURA)

    return { text: 'Painel do escritório aberto.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.text.trim() !== '') {
      await update($, roteiro, receberDemanda)
      await update($, atividade, () => 'recebendo a nova demanda')
      void andar($)
    }

    return next(e)
  })

  on('session.append', { door: 'response' }, async ($, e, next) => {
    if (e.agentId === undefined) {
      const texto = e.message.content
        .map(bloco => (bloco.type === 'text' && typeof bloco.text === 'string' ? bloco.text : ''))
        .join('\n')
      const nomeados = agentesNomeados(texto)

      if (nomeados.length > 0) {
        await update($, roteiro, anterior =>
          nomeados.reduce((atual, um) => passarPara(atual, um.id, um.emRevisao), anterior),
        )
        await update($, atividade, () => 'assumiu a demanda')
        void andar($)
      }
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ferramenta = String(e.tool)
    const campos = e as unknown as Readonly<Record<string, unknown>>
    const arquivo = arquivoEditado(ferramenta, campos)
    const especialista = arquivo === undefined ? null : especialistaDoArquivo(arquivo)
    let atual = await read($, roteiro)
    const semDemanda = atual.portador === null && e.agentId === undefined

    if (semDemanda || (especialista !== null && atual.portador !== null && aceitaInferencia(atual.portador))) {
      atual = await update($, roteiro, anterior => {
        if (anterior.portador === null && e.agentId !== undefined) {
          return anterior
        }

        const base = anterior.portador === null ? receberDemanda(anterior) : anterior

        return especialista !== null && aceitaInferencia(base.portador)
          ? passarPara(base, especialista, false)
          : base
      })
      void andar($)
    }

    const agora = await $.clock.now()
    const podeTrocar = !emAnimacao(atual, agora) && agora - ultimaAtividade >= INTERVALO_DA_ATIVIDADE

    if (atual.portador !== null && podeTrocar) {
      const texto = descreverFerramenta(ferramenta, campos)
      ultimaAtividade = agora
      await update($, atividade, () => texto)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const foiEntregue = e.reason === 'answer'
      await update($, roteiro, foiEntregue ? concluir : interromper)
      await update($, atividade, () => (foiEntregue ? 'Demanda entregue ao cliente' : 'demanda interrompida'))
      void andar($)
    }

    return next(e)
  })

  // As camadas e a legenda perguntam, a cada instante, se há algo novo para
  // mostrar. A resposta leva os novos dados direto à camada que perguntou,
  // sem redesenhar o painel: é isso que mantém o fundo parado.
  on('ui.message', async ($, e) => {
    const dado = (typeof e.data === 'object' && e.data !== null ? e.data : {}) as Readonly<Record<string, unknown>>
    const atual = await read($, roteiro)
    const texto = await read($, atividade)

    if (e.element === LEGENDA) {
      const nova = { etapa: linhaDaEtapa(atual), resumo: legenda(atual, texto) }

      return dado.etapa === nova.etapa && dado.resumo === nova.resumo ? {} : { props: nova }
    }

    const par = (Object.keys(PARES) as Par[]).find(nome => PARES[nome].some(camada => camada === e.element))

    if (par === undefined) {
      return {}
    }

    const agora = await $.clock.now()
    const periodo = await read($, vida)
    const fala = falaDaCena(atual, texto)
    const largura = medida(dado.largura)
    const altura = medida(dado.altura)
    // Os passeios só dependem das rotinas; os agentes nas mesas, do passo em
    // cena e das rotinas (a cadeira de quem saiu fica vazia); o balão, também
    // do texto.
    const partes = {
      cena: `${atual.cena.seq}|${periodo.seq}`,
      vida: `${periodo.seq}`,
      fala: `${atual.cena.seq}|${periodo.seq}|${fala ?? ''}`,
    }
    const chave = `${partes[par]}|${largura}x${altura}`
    const quadro = quadros[par]

    if (chave !== quadro.chave) {
      quadro.chave = chave
      quadro.alvo = quadro.alvo === PARES[par][0] ? PARES[par][1] : PARES[par][0]
      quadro.desde = agora
    }

    if (e.element === quadro.alvo) {
      if (dado.chave === chave) {
        return {}
      }

      // O desenho retoma as animações do ponto em que o passo em cena e as
      // rotinas estão.
      const decorrido = (agora - atual.cena.inicio) / 1000
      const decorridoDaVida = (agora - periodo.inicio) / 1000
      const desenhos = {
        cena: () => montarCena(atual.cena, decorrido, periodo, decorridoDaVida),
        vida: () => montarVida(periodo, decorridoDaVida),
        fala: () => montarFala(atual.cena, decorrido, fala, periodo, decorridoDaVida),
      }

      return { props: { chave, svg: desenhos[par](), largura, altura } }
    }

    // A camada com a cena antiga só é limpa depois de a nova ter aparecido.
    const podeLimpar = dado.chave !== '' && agora - quadro.desde >= TROCA_DE_CAMADA

    return podeLimpar ? { props: { chave: '', svg: '', largura, altura } } : {}
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    if (e.surface !== 'desktop') {
      // Sem camadas sobrepostas fora do app desktop: resumo em texto.
      const { Box, Text } = $.ui.resolve(e)
      const atual = await read($, roteiro)
      const resumo = legenda(atual, await read($, atividade))

      return (
        <Box flexDirection="column">
          <Text bold>{TITULO}</Text>
          <Text>{linhaDaEtapa(atual)}</Text>
          {resumo !== '' && <Text dimColor>{resumo}</Text>}
        </Box>
      )
    }

    // No desktop este desenho não lê estado nenhum: ele é feito uma vez (e a
    // cada mudança de largura) e não é refeito quando a sessão anda. O fundo
    // fica numa camada; por cima, as dos agentes, as dos passeios e as do balão.
    const { Box, Client, Svg } = $.ui.resolve(e)
    const largura = larguraDoQuadro(e.props.bodyColumns)
    const altura = alturaDoQuadro(e.props.bodyColumns)
    const vazia = { chave: '', svg: '', largura, altura }

    return (
      <Box flexDirection="column">
        <Svg source={montarFundo()} alt={TITULO} width={largura} height={altura} isInteractive />
        <Box position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="column">
          <Client key="cenaA" module="./camada.tsx" props={vazia} width="100%" flexGrow={1} />
        </Box>
        <Box position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="column">
          <Client key="cenaB" module="./camada.tsx" props={vazia} width="100%" flexGrow={1} />
        </Box>
        <Box position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="column">
          <Client key="vidaA" module="./camada.tsx" props={vazia} width="100%" flexGrow={1} />
        </Box>
        <Box position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="column">
          <Client key="vidaB" module="./camada.tsx" props={vazia} width="100%" flexGrow={1} />
        </Box>
        <Box position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="column">
          <Client key="falaA" module="./camada.tsx" props={vazia} width="100%" flexGrow={1} />
        </Box>
        <Box position="absolute" top={0} left={0} right={0} bottom={0} flexDirection="column">
          <Client key="falaB" module="./camada.tsx" props={vazia} width="100%" flexGrow={1} />
        </Box>
        <Client key="legenda" module="./legenda.tsx" props={{ etapa: ' ', resumo: ' ' }} />
      </Box>
    )
  })
}
