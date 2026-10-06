import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Roteiro } from '../types'
import { alturaDoQuadro, montarSvg } from './cenario'
import {
  ROTEIRO_INICIAL,
  aceitaInferencia,
  agentesNomeados,
  arquivoEditado,
  avancar,
  concluir,
  descreverFerramenta,
  emAnimacao,
  especialistaDoArquivo,
  falaDaCena,
  interromper,
  legenda,
  passarPara,
  podeAvancar,
  receberDemanda,
  restante,
} from './diretor'
import { ETAPAS } from './equipe'

const PAINEL = 'escritorio'
const TITULO = 'Escritório do Time'

// Tamanho que o painel pede ao abrir (o app concede até onde o layout deixa
// e respeita o tamanho que a pessoa arrastar): largura para o desenho ficar
// grande e linhas para o desenho mais a legenda.
const ABERTURA = { id: PAINEL, title: TITULO, columns: 132, rows: 44 } as const

const roteiro = atom({ plugin: 'escritorio-time', key: 'roteiro' } as const, ROTEIRO_INICIAL)
const atividade = atom({ plugin: 'escritorio-time', key: 'atividade' } as const, '')

// Cada troca do texto de atividade redesenha o painel, e o app recria o
// quadro do desenho a cada redesenho: no máximo uma troca por intervalo, e
// nenhuma enquanto um passo está sendo animado.
const INTERVALO_DA_ATIVIDADE = 3000

let espera: Timer | undefined
let ultimaAtividade = 0

function linhaDaEtapa(atual: Roteiro): string {
  return atual.etapa === 0 ? (ETAPAS[0] as string) : `Etapa ${atual.etapa}/8 · ${ETAPAS[atual.etapa] ?? ''}`
}

// Exibe o próximo passo da fila quando a animação em cena termina.
async function andar($: EngineInterface): Promise<void> {
  espera?.cancel()
  espera = undefined
  const agora = await $.clock.now()
  let atual = await read($, roteiro)

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

    return next(e)
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

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const atual = await read($, roteiro)
    const texto = await read($, atividade)
    const etapa = linhaDaEtapa(atual)
    const resumo = legenda(atual, texto)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          <Text bold>{TITULO}</Text>
          <Text>{etapa}</Text>
          {resumo !== '' && <Text dimColor>{resumo}</Text>}
        </Box>
      )
    }

    const { Box, Svg, Text } = $.ui.resolve(e)
    // O desenho retoma a animação do ponto em que o passo em cena está.
    const decorrido = ((await $.clock.now()) - atual.cena.inicio) / 1000
    const desenho = montarSvg(atual.cena, decorrido, falaDaCena(atual, texto))

    return (
      <Box flexDirection="column">
        <Svg
          source={desenho}
          alt={`${TITULO}. ${etapa}. ${resumo}`}
          height={alturaDoQuadro(e.props.bodyColumns)}
          isInteractive
        />
        <Text bold>{etapa}</Text>
        {resumo !== '' && <Text dimColor>{resumo}</Text>}
      </Box>
    )
  })
}
