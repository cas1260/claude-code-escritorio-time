import type { ClientModule, RenderElement } from 'claude-code'

type Props = { chave: string; svg: string; largura: number; altura: number }

type Estado = { props: Props; semNovidade: number }

// Milissegundos entre duas consultas ao mod.
const PASSO = 250

// Consultas sem novidade até a camada reduzir o ritmo (10 segundos) e, daí em
// diante, de quantos em quantos passos ela consulta (1 vez por segundo).
const CALMA_APOS = 40
const RITMO_CALMO = 4

// Camada de agentes: mostra o desenho que recebeu e pergunta ao mod se há um
// mais novo. O mod responde com novos dados sem redesenhar o painel, então o
// fundo (outra camada) nunca é refeito.
const Camada: ClientModule<Props, Estado> = (props, surface) => {
  const { Box } = surface.elements
  const atual = surface.state

  if (atual === undefined) {
    const estado: Estado = { props, semNovidade: 0 }
    surface.setState(estado)
    surface.every(PASSO, () => {
      estado.semNovidade += 1

      if (estado.semNovidade <= CALMA_APOS || estado.semNovidade % RITMO_CALMO === 0) {
        surface.post({ chave: estado.props.chave, largura: estado.props.largura, altura: estado.props.altura })
      }
    })
  } else {
    if (atual.props.chave !== props.chave) {
      atual.semNovidade = 0
    }

    atual.props = props
  }

  if (props.svg === '') {
    return <Box />
  }

  // No app desktop a árvore de um Client aceita um nó Svg, embora a tabela de
  // elementos do módulo (a do terminal) não traga o construtor.
  const desenho = {
    type: 'Svg',
    props: {
      source: props.svg,
      alt: 'Agentes do escritório',
      width: props.largura,
      height: props.altura,
      isInteractive: true,
    },
  }

  return desenho as unknown as RenderElement
}

export default Camada
