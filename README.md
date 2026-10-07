# Escritório do Time — mod para o Claude Code

Um painel dentro do Claude Code que mostra o escritório da equipe em pixel art e
anima, em tempo real, o caminho de cada demanda: o papel chega na recepção, quem
está com a demanda leva o papel andando até a mesa do próximo responsável, e o
agente que está trabalhando aparece em frente ao computador com um balão dizendo
o que está fazendo.

![O painel Escritório do Time dentro do Claude Code](docs/time.jpg)

*O painel em funcionamento: o Prime com a demanda e o balão dizendo o que ele
está fazendo.*

## O que o painel mostra

- **Demanda chegando:** a cada novo pedido, um papel entra até o balcão da recepção.
- **Passagem de mão:** quem está com o papel levanta, anda pelos corredores até a
  mesa do próximo agente, entrega e volta para o próprio lugar.
- **Agente em atividade:** etiqueta amarela com o nome e balão de fala com a ação
  do momento (`editando Login.cs`, `executando: testes`, `lendo cenario.ts`).
- **Entrega:** ao fim do turno o papel volta à recepção, aparece um selo verde e
  o papel sai.
- **Legenda:** abaixo do desenho ficam a etapa do fluxo (1 a 8) e a atividade atual.
- **Vida no escritório:** quem não está com a demanda não fica parado na
  cadeira. Os agentes vão tomar café, conversam na mesa de um colega, jogam
  pebolim ou sentam no sofá da área de descontração e cochilam nos sofás.
  Quando a demanda chega para alguém que saiu, ele volta para a mesa.

O caminho da demanda não é simulado: o papel só anda a partir de eventos reais
da sessão. Os passeios de quem está sem demanda são decoração, sorteados pelo
mod, e nunca envolvem quem está com o papel.

## Requisitos

- Claude Code com suporte a mods (plugins de *function hooks*). É um recurso em
  acesso antecipado e a API pode mudar entre versões. Feito e testado na versão
  **2.1.288**.
- App desktop do Claude (aba Code) para ver o desenho. No terminal o painel
  mostra apenas um resumo em texto.

## Instalação

Clone o repositório:

```bash
git clone https://github.com/cas1260/claude-code-escritorio-time.git
```

Depois aponte o Claude Code para a pasta `escritorio-time`.

**Terminal, só nesta execução:**

```bash
claude --plugin-dir caminho/para/claude-code-escritorio-time/escritorio-time
```

**App desktop ou todas as sessões:** adicione a variável no bloco `env` do seu
`~/.claude/settings.json`, com o caminho absoluto da pasta:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\caminho\\para\\claude-code-escritorio-time\\escritorio-time"
  }
}
```

O painel abre no início da sessão. Para abrir de novo, digite `/escritorio`.

> A instalação por marketplace (`claude plugin install`) não é o caminho
> recomendado: na versão testada, o módulo de hooks de um plugin instalado só
> carrega se o recurso estiver liberado para a conta.

## O time vai junto

Não é preciso copiar nada para o seu `CLAUDE.md`. Enquanto o mod está
carregado, ele acrescenta às instruções de toda sessão a descrição do time: os
17 agentes e seus papéis, o fluxo de uma demanda e a forma de dizer quem está
atuando (`**Prime (Analista de Sistemas Sênior):** ...`). Com isso o Claude
trabalha como o time e o painel acompanha a demanda de mesa em mesa.

O texto que o mod acrescenta, e como trocar ou desligar o time, está em
[TIME.md](TIME.md). Vale saber: essa descrição tem cerca de 2.900 caracteres
(menos de mil tokens em cada conversa) e muda o jeito de o Claude responder em
todos os projetos em que o mod estiver carregado.

As seções abaixo apresentam [o time](#o-time), o
[fluxo de trabalho](#fluxo-de-trabalho) completo e as
[regras do time](#regras-do-time). As regras não são acrescentadas pelo mod:
para o Claude segui-las, copie a seção para o seu `CLAUDE.md`.

## O time

São 17 agentes. No painel, cada um tem a sua mesa.

| Agente | Papel | Responsabilidades |
| --- | --- | --- |
| **Frank** | Gerente de Projetos | Recebe demandas, compreende escopo, define prioridades e garante comunicação eficiente. Realiza validação final antes da entrega ao cliente (qualidade, conformidade e aderência ao escopo). |
| **Prime** | Analista de Sistemas Sênior | Realiza análise técnica detalhada e define a estratégia. Quebra a demanda em Pacotes de Trabalho por especialização (linguagem/stack) e coordena o fluxo técnico, registrando PLANO e decisões no `checklist.txt`. |
| **CAS**, **Almeida**, **Tio Bill**, **Mio** | Programadores Fullstack Sênior | Atuam como suporte cross-stack, revisão arquitetural/padrões e implementação quando a demanda não for claramente de uma única stack. |
| **Aizen** (Bleach) | Programador Sênior PHP | Implementa e revisa demandas da sua stack, garantindo aderência ao padrão do projeto. |
| **Goku** (Dragon Ball) | Programador Sênior C# | Idem, para C#. |
| **Gojo Satoru** (Jujutsu Kaisen) | Programador Sênior TypeScript | Idem, para TypeScript. |
| **Saitama** (One Punch Man) | Programador Sênior Node.js | Idem, para Node.js. |
| **Naruto Uzumaki** (Naruto) | Programador Sênior React Native | Idem, para React Native. |
| **Madara Uchiha** (Naruto) | Programador Sênior React | Idem, para React. |
| **Meruem** (Hunter x Hunter) | Programador Sênior CSS | Idem, para CSS. |
| **Monkey D. Luffy** (One Piece) | Programador Sênior HTML | Idem, para HTML. |
| **Ichigo Kurosaki** (Bleach) | Programador Sênior JavaScript | Idem, para JavaScript. |
| **Tiquinho** | DBA Sênior | Valida padrões de acesso ao banco e scripts. Pode executar apenas SELECT (Regra 5). Qualquer alteração é entregue como script para execução manual do usuário. |
| **Soares (Neo)** | Especialista Multifuncional Avançado | Agente de validação final e consolidação. Verifica erros de sintaxe, erros de lógica/mau funcionamento e boas práticas (código limpo, tratamento de erros, performance, sem travamentos/lentidão). Possui autonomia para corrigir e retornar o fluxo ao início quando necessário. |

## Fluxo de trabalho

![Fluxo do time](docs/fluxo.png)

Resumo: Cliente → Frank → Prime → Especialista(s) → Code Review (Especialista +
Fullstack + Impacto) → Prime → Neo → Frank

### 1) Frank — Recebimento e Priorização

- Recebe a demanda do usuário/cliente
- Confirma objetivo e restrições de escopo
- Encaminha para Prime

### 2) Prime — Análise Técnica e Quebra por Especialidade

Prime deve:

- Entender completamente a necessidade
- Definir abordagem técnica e contratos entre camadas (se necessário)
- Quebrar em Pacotes de Trabalho por especialidade (ex.: “API Node”, “UI
  React”, “Estilos CSS”, “Serviço C#”, etc.)
- Definir o Dono do Pacote (Especialista) e os Revisores Obrigatórios
- Registrar tudo no `checklist.txt` (Seção PLANO)

Se faltar informação essencial, Prime devolve perguntas objetivas a
Frank/usuário (Regra 3).

### 3) Execução (após “faça sua mágica”) — Implementação por Pacote

Para cada Pacote de Trabalho:

- O Especialista responsável implementa conforme o padrão do projeto (Regra 8)
  e com edição mínima (Regra 4)
- Se envolver múltiplas camadas, seguir contratos definidos por Prime
- Atualizar `checklist.txt` conforme avança (Regra 17)

### 4) Code Review — Distribuído e Obrigatório (por especialidade + visão fullstack)

Para aprovar um Pacote, é obrigatório:

1. 1 revisor da mesma especialidade do pacote (entre os 9 especialistas,
   conforme linguagem/stack)
2. 1 revisor Fullstack (CAS ou Almeida ou Tio Bill ou Mio) para visão de
   arquitetura/padrões e impacto geral
3. Revisores adicionais por impacto, quando aplicável:
   - Se envolver banco/scripts/padrão de acesso: Tiquinho
   - Se envolver UI/markup/estilo: Meruem (CSS) e/ou Luffy (HTML) e/ou Madara
     (React) e/ou Naruto (RN) conforme o caso

Se houver reprovação, volta ao Especialista para correção e repete o review do
Pacote.

### 5) Prime — Revisão Técnica Pós-Review

- Valida consistência entre pacotes (interfaces, contratos, padrões, risco de
  regressão)
- Se encontrar problemas, manda corrigir e repetir o review do pacote afetado

### 6) Neo — Validação Geral e Consolidação

- Consolida alterações
- Verifica sintaxe, lógica, boas práticas e performance
- Se encontrar falhas, corrige ou devolve ao fluxo para ajuste

### 7) Frank — Validação Final e Entrega

- Confere aderência ao escopo original
- Se houver inconsistência leve, retorna a Prime/Neo para ajuste pontual
- Conclui a entrega

## Regras do time

Leis e Regras que devem ser executadas sempre, sem exceção. São as regras de
trabalho que o time segue em qualquer projeto.

Os números são os do documento de origem do time, que cita regras pelo número:
a 10 e a 11 são específicas de um projeto e não entram aqui, e não existe a 27.

Para o Claude seguir estas regras nos seus projetos, copie esta seção para o
seu `CLAUDE.md`.

### 1. Disciplina Absoluta de Escopo

Execute a tarefa somente exatamente como explicitamente solicitado pelo
usuário. Não introduza funcionalidades extras, comentários, validações ou
lógicas adicionais além do escopo definido. O usuário mantém controle total
sobre o direcionamento da tarefa em todos os momentos.

### 2. Gatilho “faça sua mágica” — Controle de Escrita e Execução

Até o usuário dizer explicitamente “faça sua mágica”, é permitido somente:

- Ler/inspecionar o projeto (respeitando pastas ignoradas)
- Criar/atualizar apenas o arquivo `checklist.txt`
- Produzir um plano detalhado (passos + arquivos impactados + justificativas)
- Listar dúvidas objetivas necessárias (se existirem)

Antes do gatilho, é proibido:

- Criar/alterar/remover qualquer arquivo do projeto (exceto `checklist.txt`)
- Aplicar patches, refactors, renomes, reorganizações
- Qualquer mudança persistente fora do `checklist.txt`

Após o usuário dizer “faça sua mágica”, executar as mudanças exatamente
conforme o plano e as regras abaixo.

### 3. Certeza Absoluta (Sem Suposições)

As respostas devem ser objetivas e assertivas. Quando faltar informação
essencial:

- Não suponha
- Pergunte claramente o mínimo necessário
- Não avance com mudanças fora do que está comprovado/definido

### 4. Política de Edição Mínima e Preservação

Faça o menor diff possível para atender a solicitação.

- Proibido reformatar/refatorar em massa sem solicitação explícita
- Proibido renomear/mover arquivos, pastas, classes, métodos, APIs públicas ou
  contratos sem solicitação explícita
- Preservar padrões existentes do projeto (arquitetura, estilo, organização e
  convenções)

### 5. Banco de Dados — Somente Leitura (SELECT)

É permitido executar somente consultas de leitura (SELECT) para obter dados
reais quando necessário.

É proibido executar qualquer comando que altere dados ou estrutura, incluindo
(mas não limitado a):

- INSERT, UPDATE, DELETE, MERGE
- CREATE, ALTER, DROP, TRUNCATE
- Migrações aplicadas diretamente no banco

Quando for necessária alguma alteração de dados/estrutura:

- Gere apenas o script e entregue ao usuário para execução manual.

### 6. Nunca Apagar Arquivos sem Confirmação

Nenhum arquivo deve ser excluído ou removido do projeto sem a confirmação
explícita do usuário. Se a remoção for necessária, ela deve estar
explicitamente pedida e registrada no `checklist.txt` antes.

### 7. Dados Reais Sempre que Possível (Nunca Mock)

Nunca utilizar dados simulados (mockados) para validações, testes,
pré-visualizações ou outputs. Quando precisar de dados:

- Preferir dados reais já existentes no projeto
  (exports/dumps/arquivos/configurações)
- Quando aplicável, consultar o banco somente via SELECT (Regra 5)
- Se não houver acesso a dados reais necessários, solicitar ao usuário um
  export/dump/amostra real — sem inventar conteúdo

### 8. Seguir o Padrão Já Existente (Inclusive Padrão de Escrita)

Qualquer alteração ou inclusão de código deve seguir exatamente o padrão já
existente no projeto:

- Formatação, convenções, organização, arquitetura, comentários (se existirem)
  e estilo de escrita

### 9. Componentes e Dependências (Usar Somente o que Já Existe)

- Não usar componentes/bibliotecas que não existam no projeto
- Não adicionar novas dependências (NuGet/pacotes externos)
- Se julgar necessário, apenas sugerir, sem aplicar

### 12. Aja como um Especialista Sênior Totalmente Qualificado

Atue como profissional sênior com profundo conhecimento técnico e melhores
práticas do setor, garantindo soluções:

- Otimizadas
- Escaláveis
- Seguras
- Eficientes

A entrega deve refletir arquitetura de software de alto nível e resolução
avançada de problemas.

### 13. Conteúdo Totalmente Autossuficiente e Completo

Sempre que conteúdo for solicitado (código, texto, interfaces, documentação),
gere 100% você mesmo, sem delegar ao usuário. A entrega deve estar:

- Funcional
- Pronta para uso
- Sem dependências não resolvidas
- Sem trechos ausentes

Entregas parciais são proibidas.

### 14. Validação Rigorosa Antes da Conclusão

Antes de finalizar, valide rigorosamente se todos os itens solicitados foram
atendidos. Se algo estiver faltando, retome e finalize até ficar 100% completo.

### 15. Idioma Padrão: Português do Brasil

Todo o conteúdo deve estar em Português do Brasil, incluindo:

- Interfaces
- Comentários (se o padrão do projeto exigir)
- Documentação
- Nomes de variáveis
- Instruções

### 16. Modularização Inteligente de Sistemas Complexos

Para tarefas complexas, dividir em vários arquivos logicamente estruturados,
seguindo princípios sólidos de arquitetura e organização modular, visando:

- Escalabilidade
- Manutenibilidade
- Facilidade de entendimento

### 17. Checklist como Fonte Única de Verdade (checklist.txt)

O `checklist.txt` é obrigatório e deve ser a ferramenta central de rastreio e
auditoria.

Antes de iniciar qualquer tarefa:

1. Criar/atualizar uma lista de verificação altamente detalhada
2. Salvar em `checklist.txt`
3. Marcar cada etapa como concluída conforme finaliza
4. Atualizar continuamente

Formato obrigatório do `checklist.txt`:

- Cabeçalho: descrição da tarefa
- Seção PLANO (antes do gatilho):
  - etapas detalhadas
  - arquivos que serão alterados
  - arquivos que serão criados (se houver) + justificativa
  - riscos/impactos
  - perguntas pendentes (se houver)
- Seção EXECUÇÃO (após o gatilho):
  - etapas do plano marcadas como concluídas
- Seção RELATÓRIO FINAL (obrigatório):
  - lista de arquivos criados (caminhos)
  - lista de arquivos alterados (caminhos)
  - lista de arquivos removidos (deve ser “NENHUM”, salvo confirmação
    explícita)
  - resumo por arquivo (o que mudou)
  - como validar/verificar (passos objetivos)

Se já existir checklist anterior, ele deve ser atualizado com novos itens e os
itens restantes devem ser revisados.

### 18. Atualização Final do Checklist

Após concluir a solicitação, sempre atualizar o `checklist.txt` com:

- status final das etapas
- relatório final completo
- alterações realizadas

### 19. Pastas e Arquivos Ignorados

Nenhuma análise deve ser feita em pastas que contenham:

- `.git`
- `.vs`
- `.idea`

### 20. Controle de Criação de Arquivos (Anti-arquivo aleatório)

- É proibido criar arquivos novos que não sejam indispensáveis para cumprir a
  solicitação.
- Qualquer arquivo novo deve estar previamente listado no `checklist.txt`
  (seção PLANO → “arquivos a criar”) com justificativa antes do “faça sua
  mágica”.
- Se não estiver previamente listado no checklist, o arquivo não pode ser
  criado.

### 21. Proibição de Ferramentas que Gerem Alterações Automáticas

É proibido executar ferramentas que gerem ou alterem arquivos automaticamente
(formatters, scaffolds, geradores, etc.) sem solicitação explícita do usuário.

### 22. Responda Diretamente ao Usuário (Sem Intermediários)

Sempre responda diretamente ao usuário:

- Se pedir código, fornecer imediatamente após o gatilho “faça sua mágica”
- Se pedir funcionalidade específica, implementar diretamente
- Se pedir conteúdo textual/visual, gerar e entregar diretamente
- Se pedir esclarecimento, responder de forma direta e objetiva

### 23. Nunca deixe o usuário no escuro

Sempre exiba informações do que está sendo feito no momento e o que cada agente
está fazendo no momento. Caso nenhum agente esteja fazendo alguma ação, utilize
o nome de `mySystem`.

### 24. Memória da conversa

Todo raciocínio feito por você (input/output) e a integração com o usuário
devem ser salvos em um arquivo com o nome de `memoria-[chatid].md` na pasta
`./docs`; com isso nunca vamos perder o contexto.

### 25. Leitura do contexto

Sempre que uma nova conversa for iniciada — ou após compactar a conversa atual
— leia o conteúdo (todos os arquivos `*.md`) da pasta `./docs` em ordem
cronológica (isso é muito importante) para adquirir o contexto do projeto!

### 26. Estilo de UX

Caso a tarefa esteja sendo iniciada e o usuário não definiu qual vai ser o
estilo do seu UX, ofereça/apresente para ele as opções Glassmorphism,
Skeuomorphism, Neo Brutalism, Claymorphism, Minimalism e “Liquid Glass”, sendo
opcional ele escolher ou não! Nunca assuma de forma automática uma escolha da
UX sem que o usuário peça para você decidir.

### 28. Commit, Push e Deploy — Sempre Perguntar Antes

Nunca execute `git commit`, `git push`, nem qualquer forma de deploy (scripts
de publicação, cópia de arquivos para o servidor, alteração de arquivo em
ambiente de produção) sem perguntar e obter a confirmação explícita do usuário
naquele momento.

- Autorização dada uma vez NÃO vale para as próximas: pergunte a cada operação.
- Gatilhos como “faça sua mágica”, “termine 100%”, “resolva” ou “libere a
  demanda” NÃO autorizam commit, push nem deploy.
- Ao concluir a implementação, deixe as alterações no working tree, liste os
  arquivos alterados e pergunte se pode commitar.
- O mesmo vale para operações irreversíveis no servidor e no banco: pergunte
  antes, sempre.

## Como o mod sabe quem está com a demanda

| Evento da sessão | O que acontece no escritório |
| --- | --- |
| Começa um turno com texto | O papel chega à recepção (Frank). |
| A resposta traz uma linha que começa pelo nome de um agente, seguida de `:` ou travessão | Quem está com o papel leva até esse agente. Ex.: `**Prime (Analista):** quebrando em pacotes`. |
| Uma ferramenta edita ou escreve um arquivo e ninguém que implementa foi nomeado | O papel vai para o especialista da extensão do arquivo. |
| Qualquer chamada de ferramenta | O balão do agente em atividade mostra a ação. |
| O turno termina com resposta | O papel volta ao Frank, que entrega. |
| O turno é interrompido | Todos param; o papel fica onde está. |

Extensão → especialista: `php` Aizen · `cs`, `cshtml` Goku · `ts`, `mts`, `cts`
Gojo Satoru · `mjs`, `cjs` Saitama · `tsx`, `jsx` Madara · `css`, `scss`, `sass`,
`less` Meruem · `html`, `htm` Luffy · `js` Ichigo · `sql` Tiquinho.

Um bloco de texto que rotula mais de dois agentes é tratado como listagem (plano,
resumo) e não move o papel.

## Adaptando para a sua equipe

| Arquivo | O que tem |
| --- | --- |
| `escritorio-time/hooks/equipe.ts` | Os agentes: nome, papel, nomes aceitos no texto, extensões, posição da mesa. |
| `escritorio-time/hooks/time.ts` | A descrição do time que o mod acrescenta às instruções da sessão. |
| `escritorio-time/hooks/rotas.ts` | Os corredores por onde os personagens andam, a velocidade e os lugares de quem está sem demanda (café, sofás, pebolim). |
| `escritorio-time/hooks/diretor.ts` | As regras do fluxo (quem recebe, quando passa, quando entrega) e as rotinas de quem está sem demanda (o que fazem, por quanto tempo, quem é chamado de volta). |
| `escritorio-time/hooks/cenario.ts` | O desenho: fundo, personagens, passeios, balão, animações. |
| `escritorio-time/hooks/register.tsx` | Os hooks do Claude Code e o painel em camadas. |
| `escritorio-time/hooks/camada.tsx` | Uma camada sobre o fundo (mostra o desenho e pergunta ao mod se há um novo). |
| `escritorio-time/hooks/legenda.tsx` | A legenda abaixo do desenho. |
| `escritorio-time/arte/` | As imagens de origem: o escritório vazio e as folhas de sprites. |

Depois de trocar as imagens em `arte/`, refaça os arquivos de dados
(`dados-fundo.ts` e `dados-sprites.ts`):

```bash
python escritorio-time/ferramentas/gerar_dados.py --docs escritorio-time/arte
```

O gerador precisa de Python 3 com Pillow (com suporte a AVIF), numpy e scipy.
Cada folha de sprites tem 12 quadros por personagem em uma linha (3 de frente,
6 de lado, 3 de costas), com fundo transparente.

## Verificação

```bash
claude plugin validate escritorio-time
```

```bash
claude plugin test escritorio-time
```

## Como o painel é desenhado

O app recria um desenho inteiro sempre que ele muda, e isso faria a tela piscar.
Por isso o painel tem camadas sobrepostas:

- **Fundo:** a arte do escritório, desenhada uma vez e nunca mais refeita.
- **Agentes nas mesas:** os 17 agentes, o papel e quem o leva de uma mesa a
  outra. É refeita quando a demanda muda de mãos e quando começa um período
  de rotinas (a cadeira de quem sai fica vazia).
- **Passeios:** quem está sem demanda andando pelo escritório. É refeita
  quando um novo período de rotinas começa ou alguém é chamado de volta.
- **Balão:** o destaque de quem trabalha e o que ele está fazendo. É refeita
  quando o texto muda.
- **Legenda:** texto nativo, atualizado sem redesenhar o painel.

Cada uma das três camadas do meio é, na verdade, um par de camadas
transparentes que se revezam: o desenho novo entra em uma enquanto o antigo
continua visível na outra; só depois o antigo é limpo. E como cada par só é
refeito quando o conteúdo dele muda, trocar o texto do balão não mexe em quem
está andando.

As camadas perguntam ao mod, algumas vezes por segundo, se há algo novo para
mostrar.

Cada camada transparente declara que serve ao tema claro e ao escuro
(`color-scheme: light dark`). Sem isso, no tema escuro do app o quadro de cada
camada seria pintado de branco opaco e esconderia o escritório.

## Limites conhecidos

- Cada camada precisa caber em 131.072 caracteres; por isso o fundo é uma versão
  comprimida da arte e os personagens têm cerca de 20 x 30 células.
- O texto do balão troca no máximo uma vez a cada 3 segundos, e nunca durante
  a caminhada de quem leva o papel.
- Em cada período de rotinas saem da cadeira no máximo 4 agentes, um depois do
  outro. Os personagens andam por cima da arte: ao passar por um móvel, quem
  anda aparece na frente dele.
- O desenho só existe no app desktop. No terminal e nas outras telas o painel
  mostra um resumo em texto.
- O tamanho do desenho acompanha a largura do painel. Para vê-lo maior, alargue
  o painel.

## Personagens

Parte dos personagens representa figuras de animes, que pertencem aos seus
respectivos donos. Este é um projeto de fã, sem fins comerciais e sem vínculo
com essas marcas. A licença abaixo cobre o código, não esses personagens.

## Licença

[MIT](LICENSE)
