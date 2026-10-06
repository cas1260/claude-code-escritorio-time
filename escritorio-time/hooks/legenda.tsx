import type { ClientModule } from 'claude-code'

type Props = { etapa: string; resumo: string }

type Estado = { props: Props }

// Milissegundos entre duas consultas ao mod.
const PASSO = 500

// Legenda abaixo do desenho: a etapa do fluxo e quem está fazendo o quê. É
// texto nativo e pergunta ao mod se mudou, sem redesenhar o painel. Cada linha
// é cortada na largura para a altura da legenda nunca variar.
const Legenda: ClientModule<Props, Estado> = (props, surface) => {
  const { Box, Text } = surface.elements
  const atual = surface.state

  if (atual === undefined) {
    const estado: Estado = { props }
    surface.setState(estado)
    surface.every(PASSO, () => surface.post({ etapa: estado.props.etapa, resumo: estado.props.resumo }))
  } else {
    atual.props = props
  }

  return (
    <Box flexDirection="column">
      <Text bold wrap="truncate-end">
        {props.etapa === '' ? ' ' : props.etapa}
      </Text>
      <Text dimColor wrap="truncate-end">
        {props.resumo === '' ? ' ' : props.resumo}
      </Text>
    </Box>
  )
}

export default Legenda
