# Plano Helix — Consolidação de pré-release

Última atualização: 2026-07-14

## Objetivo

Entregar a pré-release do Helix com um produto coerente, verificável e centrado em três capacidades:

1. conversar e executar ferramentas com segurança;
2. organizar contexto persistente em Espaços configuráveis;
3. acompanhar trabalhos longos com follow-ups sempre visíveis.

Espaço é o único domínio persistente de organização do usuário. Não existem domínios paralelos de Workspace, Artifact ou workspace financeiro.

## Estado atual

### Checkpoints desta consolidação

- `97ac895` — `refactor: consolidate artifacts and workspaces into configurable spaces`
- `8e76baf` — `fix: make tool calling resumable and approval-safe`
- `d16c4a4` — `feat: surface follow-up sessions across the Helix shell`
- `5e9a81d` — `refactor: simplify navigation composer and settings`

### Baseline validado

- `bun run typecheck`: verde em todos os pacotes.
- `bun run lint`: verde, sem correções pendentes do Biome.
- `bun test`: 152 testes, 0 falhas.
- UI inspecionada em `520×820` e `1180×820` para shell, chat e composer.
- `bun run desktop:build`: verde; gerou `Helix.app` e o DMG arm64.

## Arquitetura canônica

### Espaços

`Space` substitui integralmente o domínio técnico anterior de Workspace.

Um Espaço contém:

- identidade, propósito e instruções;
- pasta opcional e profile associado;
- layout preferido `chat | collections`;
- memória explícita;
- fontes fixadas;
- coleções e visualizações configuradas pelo usuário;
- snapshots imutáveis do contexto usado em cada execução.

Contratos compartilhados:

- `Space`
- `SpaceCollection`
- `SpaceField`
- `SpaceRecord`
- `SpaceView`
- `SpaceMemoryFact`
- `SpaceRunSnapshot`

Tipos de campo suportados:

- `text`
- `number`
- `currency`
- `date`
- `boolean`
- `select`

Visualizações suportadas:

- `table`
- `board`
- `summary`

Não há template financeiro, schema financeiro ou comportamento verticalizado no código. Relações, fórmulas e importadores automáticos permanecem fora desta pré-release.

### Persistência e migrations

Migrations publicadas `015` e `016` permanecem preservadas.

Sequência consolidada ainda não distribuída:

- `017_space_consolidation`
  - adota `spaces` e `space_id`;
  - cria coleções, campos, registros e visualizações genéricas;
  - cria memória, fontes e snapshots vinculados por `spaceId`;
  - remove dependência runtime de Artifact e Workspace.
- `018_settings_cleanup`
  - mantém apenas configurações com consumidor real;
  - persiste `defaultWindowMode`.
- `019_follow_up_sessions`
  - cria sessões, observações, hipóteses e eventos de follow-up;
  - restaura sessões ativas como pausadas no boot.

O caminho de upgrade partindo da versão `016` possui teste automatizado. Antes de distribuir a pré-release, o upgrade também deve ser validado contra uma cópia do banco local real.

### Memória por Espaço

Regras obrigatórias:

- o estado de Espaços vive no shell raiz e é compartilhado pelas views;
- toda leitura e mutação carrega `spaceId` explícito;
- mutations de repository validam ownership com `id` e `space_id`;
- respostas atrasadas não podem alterar o Espaço atualmente selecionado;
- create, update, archive e delete retornam a entidade canônica;
- falhas são visíveis e alterações otimistas são revertidas;
- promoção de resposta é idempotente por `(space_id, source_turn_id)`;
- o runtime persiste o snapshot exato de instruções, memória, fontes e arquivos antes da execução;
- conclusões e follow-ups nunca são gravados automaticamente na memória.

### Tool calling

`workflow/WorkflowRunner.ts` é o único runner de workflows.

`AgentLoop` funciona como uma máquina de estados streaming:

1. abre uma única completion streaming por passo;
2. acumula texto e tool calls do mesmo stream;
3. anexa a mensagem assistant e os resultados tool na ordem correta;
4. continua somente quando há tool calls;
5. encerra respostas diretas sem uma segunda completion;
6. aplica `toolAllowlist` ao schema enviado ao provider;
7. valida argumentos com Zod antes da execução;
8. devolve falhas operacionais ao modelo como resultado estruturado;
9. encerra explicitamente violações de segurança, grants inválidos e limite de passos.

A conversão Zod para JSON Schema cobre:

- campos opcionais;
- enums;
- arrays;
- objetos aninhados.

#### Aprovação explícita

Para tools `explicit_approval`:

- o run persiste checkpoint, tool, input e índice da chamada;
- o status passa para `waiting_approval`;
- o chat mostra um card inline com permissão, escopo e preview;
- aprovar cria um `ExecutionGrant` one-shot ligado ao input exato;
- negar encerra a chamada sem executá-la;
- `resumeRun` restaura o checkpoint e continua o mesmo loop;
- reiniciar o runtime não perde o pedido pendente.

O planner permanece apenas para workflows declarativos. A escolha de tools em conversa normal pertence ao tool calling nativo do provider.

### Follow-up

#### FUP01 — ciclo de vida: concluído

- contratos compartilhados de sessão, evento, observação e hipótese;
- repository e migrations;
- start, pause, resume, stop e complete;
- bootstrap transforma sessões `active` em `paused` por segurança;
- estado corrente considera `active`, `paused` e `waiting_approval`.

#### FUP02 — visibilidade global: concluído

- ação “Iniciar acompanhamento” com modo `writing | debug`;
- objetivo e Espaço opcionais;
- barra global sob o header em Chat, Espaços, Fontes e Configurações;
- painel lateral sob demanda com timeline, permissões e controles;
- expandir no modo normal abre o expanded com o painel ativo;
- anel orbital do pet é apenas um indicador secundário;
- reduced motion é respeitado.

#### FUP03 — writing e debug: concluído

- briefing e observações manuais;
- histórico de versões;
- hipóteses com evidências;
- conclusão com resumo explícito;
- nenhuma escrita automática em memória.

#### FUP04 — fora desta pré-release

Follow-up contínuo baseado em Vision, diffs automáticos e observação autônoma de tela só entra após política de permissão, consumo e privacidade dedicada.

## Shell e experiência

### Navegação

No modo expandido, o rail possui 52 px e somente:

- Nova conversa;
- Chat;
- Espaços;
- Fontes;
- Configurações no rodapé.

Histórico pertence a Chat. Parser e Connectors pertencem a Fontes. Não há inspector permanente nem cards laterais duplicados de status.

### Composer

O composer é único nos modos normal e expandido.

- permanece ancorado dentro do viewport durante a conversa;
- possui superfície e borda próprias para não se confundir com o conteúdo;
- concentra arquivos, pastas, tela, clipboard e conectores em um único menu;
- a mesma registry alimenta a busca por `/`;
- não possui botões repetidos de arquivo/pasta ou quick actions duplicadas;
- o seletor de modelo aparece somente no contexto expandido, onde a troca de provider/modelo é funcional.

### Scroll

Cada tela possui uma única região principal de scroll:

- shell e painéis externos usam `overflow-hidden`;
- conteúdo variável usa `min-h-0` e `overflow-y-auto`;
- tabela de coleções usa scroll horizontal próprio;
- composer e headers permanecem fora da região rolável.

Espaços com layout `collections` abrem diretamente na aba Coleções. A tabela é a visualização padrão criada com cada coleção.

### Direção visual

Estrutura do expanded:

```text
┌──────┬──────────────────────────────────────┬───────────────┐
│ rail │ header + barra global de atividade   │ painel aberto │
│ 52px ├──────────────────────────────────────┤ sob demanda   │
│      │ conteúdo principal                   │               │
│      │                                      │               │
│      ├──────────────────────────────────────┤               │
│      │ composer unificado                   │               │
└──────┴──────────────────────────────────────┴───────────────┘
```

Paleta:

- Ink `#0B0B12`
- Surface `#15141E`
- Signal `#C499F4`
- Active `#22D3EE`
- Attention `#F59E0B`
- Danger `#F87171`

Tipografia:

- SF Pro Display para títulos;
- SF Pro Text para interface;
- SF Mono somente para dados técnicos.

A assinatura visual é um único fio orbital de atividade compartilhado pela barra global e pelo pet. Glows, badges e status dots concorrentes devem ser evitados.

## Settings e janela

`defaultWindowMode` é a única preferência persistida de abertura.

- cold start abre em `collapsed`, `normal` ou `expanded` conforme configurado;
- trocar o modo durante a sessão não altera a preferência;
- ocultar e reabrir no mesmo processo preserva apenas o estado em memória;
- `collapsed` não pode ser salvo como padrão quando o pet está oculto;
- nesse caso, `normal` é persistido como fallback explícito.

Foram removidos da API e da UI:

- `lastWindowMode` persistido;
- `petClickBehavior`;
- `contextRetention`;
- `confirmContextSend`;
- `hideSensitiveContent`;
- `inspectorInExpanded`;
- `experimentalArtifacts`;
- cards de autostart e restore sem implementação;
- estratégias futuras de modelo;
- atalhos planejados ou indefinidos;
- cards simulados de dados, conectores e sidecar.

Settings mantém somente controles funcionais de:

- idioma;
- provider e modelo;
- aparência e pet;
- always-on-top;
- modo inicial;
- notificações;
- permissões;
- profiles, automações e skills;
- timeout e endpoint compatível.

Connectors são gerenciados em Fontes, evitando duas interfaces concorrentes.

## Remoções definitivas

Não devem reaparecer em código de produto:

- `HelixArtifact`;
- `HELIX_ARTIFACTS`;
- `ArtifactsPanel`;
- modo ou feature flag `artifacts`;
- tipos e repository financeiros;
- `FinancialPanel`;
- tabelas e RPCs específicos de finanças;
- domínio técnico Workspace;
- hooks independentes que mantenham cópias concorrentes do estado de Espaços.

As migrations antigas publicadas podem mencionar nomes históricos apenas quando necessário para upgrade. Testes de upgrade também podem usar esses nomes como fixture histórica.

## Critérios de aceite da pré-release

### Espaços

- criar Espaço em layout chat e collections;
- criar coleção, campos, views e registros;
- validar tipos e campos obrigatórios;
- abrir coleção em tabela por padrão;
- trocar rapidamente de Espaço sem vazamento de estado;
- exibir e reverter falhas de CRUD de memória;
- confirmar que o snapshot do runtime corresponde ao exibido na execução.

### Tool calling

- resposta direta sem segunda completion;
- uma ou múltiplas tools padrão;
- allowlist e schemas opcionais;
- argumentos inválidos e tool desconhecida;
- aprovação, negação e cancelamento;
- restart e retomada do mesmo checkpoint;
- grant vinculado ao input e consumido uma vez;
- erro explícito no limite de passos.

### Follow-up

- iniciar pela UI em writing e debug;
- permanecer visível em todos os destinos e modos;
- reiniciar e restaurar sessão ativa como pausada;
- retomar, concluir e encerrar;
- nunca gravar memória automaticamente.

### Janela e UI

- cold start nos três modos configuráveis;
- fallback normal quando pet oculto e padrão collapsed;
- rail, painel lateral, Espaços e composer em `520×820` e `1180×820`;
- composer sempre dentro do viewport;
- scroll vertical funcional em telas longas;
- scroll horizontal isolado nas tabelas;
- teclado e foco visível;
- reduced motion e contraste;
- smoke test no bundle macOS sobre wallpapers claros e escuros.

### Qualidade

Antes de distribuir:

```bash
bun run typecheck
bun run lint
bun test
bun run desktop:build
```

Também validar:

- banco novo;
- upgrade real a partir da migration `016`;
- bundle macOS contendo `desktop-agent`, `agent-runtime` e recursos do LiteParse;
- fluxo de tool approval após reiniciar o sidecar;
- ausência de chaves financeiras, Artifact e Workspace no bundle de UI.

## Riscos restantes

1. A validação visual em navegador não substitui o smoke test dentro do host Tauri; RPC e comportamento nativo precisam ser conferidos no `.app`.
2. O upgrade automatizado cobre uma fixture `016`; ainda falta testar uma cópia do banco de desenvolvimento real.
3. Board e summary possuem contrato persistido, mas a profundidade visual principal desta pré-release está na tabela.
4. Follow-up Vision permanece deliberadamente fora de escopo para evitar observação contínua sem política madura.
5. O build ainda emite warnings não bloqueantes sobre o bundle identifier terminado em `.app` e o tamanho do chunk principal; ambos devem entrar no hardening pós-checkpoint.

## Próxima ação

Executar o build desktop, abrir o bundle macOS e realizar o smoke test final de janela, Espaços, tool approval e follow-up. Qualquer falha encontrada nessa etapa bloqueia a tag de pré-release.
