# Plano Helix — Mudanças finais da versão inicial

Última atualização: 2026-07-14

> **Este documento consolida todas as mudanças finais para a versão inicial do Helix.** O conteúdo abaixo representa o estado canônico da arquitetura já implementada e o plano de mudanças finais derivado do smoke test — cobrindo melhorias de UX/UX em 5 áreas funcionais e limpeza estrutural do projeto.

## Objetivo

Entregar a versão inicial do Helix com um produto coerente, verificável e centrado em três capacidades:

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

## Critérios de aceite da versão inicial

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

- iniciar pela UI em writing, debug e inspect;
- permanecer visível em todos os destinos e modos;
- reiniciar e restaurar sessão ativa como pausada;
- retomar, concluir e encerrar;
- nunca gravar memória automaticamente.

### Janela e UI

- cold start nos três modos configuráveis;
- fallback normal quando pet oculto e padrão collapsed;
- collapsed mostra quick actions idle e widget de tarefa ativa;
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

---

## Mudanças finais — Smoke Test Feedback

As seções abaixo consolidam os ajustes finais derivados do smoke test, divididos em melhorias funcionais (5 áreas) e limpeza estrutural do projeto.

> Estado em 2026-07-14: implementação concluída e validada por typecheck, lint, 160 testes, build do sidecar e bundle macOS `.app`. O smoke visual interativo no host e a geração do DMG permanecem como validações manuais de distribuição; detalhes no checkpoint ao fim desta seção.

### MF1: Modos de Janela — Dinâmica entre Collapsed / Normal / Expanded

#### Problema
Os 3 modos não têm identidade útil distinta. Collapsed é só o pet decorativo. Normal e Expanded diferem só em tamanho.

#### Solução

**Collapsed = Quick Actions + Widget de tarefa ativa**
- Quando idle: mostra quick actions (resumir clipboard, traduzir, OCR) com 1 clique. Mantém o pet como ponto de entrada mas o launcher radial mostra as quick actions primeiro.
- Quando uma tarefa está rodando: o collapsed vira um widget compacto mostrando:
  - Status da tarefa (thinking / using tool / result ready)
  - Última linha do agent log
  - Botão para expandir para normal e ver a resposta completa
  - Indicador do follow-up ativo (se houver)
- Tamanho do widget: 120×120 → expande para ~200×120 quando há tarefa rodando
- Ao tocar/clicar no widget com resultado pronto, expande para normal mostrando a resposta

**Normal = Chat focado (520×820)**
- Chat + composer sem rail lateral
- Header compacto com botão de expandir
- Drawer para navegação (já existe)
- Space switcher rápido no header (ver MF2)

**Expanded = Workspace completo (1180×820)**
- Rail lateral com Chat, Espaços, Fontes, Configurações
- Painel lateral de Follow-up
- Composer com seletor de modelo
- Tudo que já existe, mantido

#### Arquivos afetados
- `apps/desktop/src/app.tsx` — lógica de renderização do collapsed com widget
- `apps/desktop/src/components/ui/helix/helix-launcher.tsx` — adicionar quick actions no launcher
- `apps/desktop/src/lib/window.ts` — novo tamanho para widget mode
- `apps/desktop/src/stores/agent.ts` — estado de tarefa ativa para o widget
- `apps/desktop/src/components/ui/helix/pet.tsx` — indicador de status no pet
- Novo: `apps/desktop/src/components/ui/helix/task-widget.tsx` — widget compacto de tarefa

#### Critérios de aceite
- [x] Collapsed idle mostra quick actions acessíveis com 1 clique
- [x] Collapsed com tarefa rodando mostra status + última ação + botão expandir
- [x] Collapsed com resultado pronto indica visualmente e expande ao clicar
- [x] Normal permanece chat focado sem rail
- [x] Expanded permanece workspace completo
- [x] Transição escolhe o tamanho final antes de renderizar a superfície do estado

---

### MF2: Spaces — Wizard com IA, UX de Formulários e Switcher

#### Problema
1. Campos (fields) de coleções não têm propósito claro para o usuário
2. Formulário de criação é tedioso com campos chatos
3. Trocar de Space no composer é difícil
4. Memória e instruções são conceitos abstratos sem guidance

#### Solução MF2A: Space Wizard com IA (Formulário Inteligente)
- No formulário de criação, adicionar botão **"Sugerir com IA"** após o usuário digitar nome + propósito
- O botão chama o runtime com uma completion pedindo para sugerir:
  - `instructions` — instruções de sistema para o Space
  - `preferredLayout` — chat ou collections
  - `profileId` — profile recomendado (se houver)
  - `memoryEnabled` — true se o Space se beneficia de memória persistente
  - Sugestão de coleções iniciais com campos (ex: "Tarefas" com campos Título, Status, Prazo)
- A IA recebe: nome, propósito, e lista de profiles disponíveis
- O resultado preenche o formulário automaticamente, usuário pode editar antes de salvar
- Implementação: nova RPC `suggestSpaceConfig({ name, purpose, profiles })` no runtime

#### Solução MF2B: Switcher de Space no Composer
- Adicionar um seletor de Space compacto no composer (normal e expanded)
- Mostra o Space ativo com ícone + nome + cor
- Dropdown lista todos os Spaces + opção "Nenhum"
- Trocar de Space não recarrega a conversa, apenas atualiza o contexto ativo
- Posicionado ao lado do seletor de modelo (expanded) ou no header (normal)

#### Solução MF2C: Formulários Melhores
- Form de criação: reduzir campos obrigatórios para apenas nome. Resto é opcional com defaults inteligentes.
- Form de coleção: substituir inputs raw por um builder visual:
  - Drag-and-drop de campos (ou pelo menos botões de mover cima/baixo)
  - Preview da tabela enquanto cria
  - Templates de coleção: "Tarefas", "Notas", "Contatos", "Custom"
- Ao criar um campo, mostrar uma dica curta do tipo:
  - text: "Texto livre — títulos, nomes, descrições"
  - number: "Valores numéricos — quantidades, medidas"
  - currency: "Valores monetários — preço, custo, orçamento"
  - date: "Datas — prazos, eventos, marcos"
  - boolean: "Sim/Não — status, flags, confirmações"
  - select: "Lista de opções — status, categoria, prioridade"

#### Solução MF2D: Guidance de Memória e Instruções
- No formulário, adicionar hints contextuais:
  - Instruções: "Diga ao assistant como se comportar neste Space. Ex: 'Sempre responda em português formal. Priorize fontes acadêmicas.'"
  - Memória: "Fatos que o assistant lembra entre conversas. Ex: 'O usuário prefere resumos em bullets.' Adicione fatos manualmente ou promova respostas do chat."
- No overview do Space, mostrar exemplos de uso ao invés de só listar instruções em texto plano

#### Arquivos afetados
- `apps/desktop/src/surfaces/helix/space/SpaceShell.tsx` — formulário, wizard, coleções
- `apps/desktop/src/surfaces/helix/hooks/useSpaces.ts` — nova função `suggestSpaceConfig`
- `apps/desktop/src/surfaces/helix/composer/Composer.tsx` — space switcher
- `apps/desktop/src/surfaces/helix/views/NormalCommandView.tsx` — space switcher no header
- `packages/agent-runtime/src/api.ts` — nova RPC
- `packages/shared/src/types/rpc.ts` — tipos para `SuggestSpaceConfigInput/Output`
- `apps/desktop/src/i18n/locales/*/helix.json` — novas chaves de tradução

#### Critérios de aceite
- [x] Botão "Sugerir com IA" aparece após digitar nome + propósito
- [x] Sugestão preenche instruções, layout, memory e sugere coleções
- [x] Usuário pode editar sugestões antes de salvar
- [x] Space switcher visível no composer em ambos os modos
- [x] Trocar de Space não perde a conversa atual
- [x] Form de coleção tem templates e dicas por tipo de campo
- [x] Hints de memória e instruções são visíveis e explicativas

---

### MF3: Transparência do Agente — Cards Inline no Chat

#### Problema
O usuário não sabe que memória o agente usou, que arquivos leu, nem que tools chamou. O `agentLogs` existe no store mas é só texto flat. O `ExecutionContextSnapshot` é salvo no DB mas nunca exibido na UI.

#### Solução

**Cards expansíveis inline na resposta do assistant**

Cada turn do assistant recebe uma seção de "Contexto de execução" com cards:

1. **Card de Memória** — "Memória usada (N fatos)"
   - Expandir mostra cada fato com conteúdo e origem (manual/assistant)
   - Só aparece se o Space tem memória ativa e fatos foram usados

2. **Card de Arquivos** — "Arquivos lidos (N)" / "Arquivos escritos (N)"
   - Expandir mostra nome do arquivo, tipo, preview (300 chars)
   - Distingue lidos (anexados pelo usuário ou do Space) de escritos (tool output)

3. **Card de Ferramentas** — "Ferramentas usadas (N)"
   - Expandir mostra cada tool: nome, input (truncado), output (truncado), duração
   - Status: sucesso/falha

4. **Card de Instruções** — "Instruções do Space"
   - Expandir mostra o system prompt aplicado (instruções do Space + profile)
   - Só aparece se há instruções customizadas

#### Implementação
- O `ExecutionContextSnapshot` já é salvo no DB por `WorkflowRunner.executeRun()`
- A RPC `getExecutionContextSnapshot({ runId })` já existe na API
- Adicionar um bloco `executionContext` ao `Turn` do assistant:
  ```ts
  type ExecutionContextSummary = {
    facts: { id: string; content: string; origin: string }[];
    filesRead: { displayName: string; preview: string; mimeType: string }[];
    toolsUsed: { toolName: string; inputPreview: string; outputPreview: string; durationMs: number; success: boolean }[];
    instructions: string;
    spaceName?: string;
  };
  ```
- Após o run completar, buscar o snapshot e anexar ao turn
- Renderizar cards expansíveis no `ChatView` abaixo da resposta

#### Arquivos afetados
- `packages/shared/src/types/rpc.ts` — tipo `ExecutionContextSummary`
- `apps/desktop/src/stores/agent.ts` — adicionar `executionContext` ao Turn
- `apps/desktop/src/surfaces/helix/hooks/useExecute.ts` — buscar snapshot após run
- `apps/desktop/src/surfaces/helix/views/ChatView.tsx` — renderizar cards expansíveis
- Novo: `apps/desktop/src/surfaces/helix/response/ExecutionContextCards.tsx` — componente dos cards

#### Critérios de aceite
- [x] Card de memória aparece quando o Space tem fatos ativos usados no run
- [x] Card de arquivos aparece quando há fileContext ou fontes do Space
- [x] Card de ferramentas aparece quando tools foram chamadas (via AgentLoop)
- [x] Card de instruções aparece quando o Space tem instruções customizadas
- [x] Cada card expande/contrai com click
- [x] Cards aparecem durante o streaming (pelo menos tools) e completam ao final
- [x] Dados vêm do ExecutionContextSnapshot persistido + workflow steps

---

### MF4: Follow-up — Rethink de Casos de Uso

#### Problema
Follow-up existe como feature mas o usuário não encontrou uso concreto. Os modos writing/debug são manuais (adicionar observação a dedo) e não se conectam ao chat.

#### Solução MF4A: Follow-up conectado ao chat
- Quando uma sessão de follow-up está ativa, cada mensagem do chat é automaticamente registrada como observação ou evento
- Writing mode: cada versão do assistant é registrada como `assistant` observation
- Debug mode: cada tool call é registrada como observação com source `assistant`
- O follow-up injeta o objetivo + observações recentes no contexto do chat (como memória de sessão)
- Usuário pode pedir "continue de onde paramos" e o assistant tem o histórico do follow-up

#### Solução MF4B: Novo modo "Inspect" (anotação de componentes)
- Novo `FollowUpMode = "inspect"` para acompanhar desenvolvimento de uma aplicação web
- O usuário aponta uma URL ou arquivo HTML local
- O assistant pode:
  - Ler o arquivo/URL (via web.extract ou file context)
  - Anotar componentes que precisam mudança (observations com source `file` ou `screen`)
  - Sugerir mudanças específicas (hipóteses = propostas de mudança)
  - Acompanhar quais mudanças foram feitas (evidências = diffs ou screenshots)
- UI do modo inspect:
  - Lista de componentes anotados (observations agrupadas por componente/seletor)
  - Status de cada anotação: pendente / em progresso / resolvido
  - Botão "Ler arquivo novamente" para refresh
  - Botão "Comparar com versão anterior" para ver diff

#### Solução MF4C: Follow-up como monitor de tarefa longa
- Ao iniciar um run com mode `workflow` e múltiplos steps, oferecer "Acompanhar esta tarefa"
- Cria uma sessão de follow-up automaticamente com objetivo = prompt do run
- Cada step completado vira um evento no follow-up
- O usuário pode pausar o follow-up (não o run) e voltar depois
- O widget no collapsed mode (MF1) mostra progresso do follow-up

#### Arquivos afetados
- `packages/shared/src/follow-up.ts` — adicionar modo "inspect"
- `packages/agent-runtime/src/workflow/WorkflowRunner.ts` — emitir eventos de follow-up durante run
- `apps/desktop/src/surfaces/helix/hooks/useFollowUp.ts` — conectar ao chat
- `apps/desktop/src/surfaces/helix/hooks/useExecute.ts` — auto-registrar observações
- `apps/desktop/src/surfaces/helix/followup/FollowUpDock.tsx` — UI do modo inspect
- Novo: `apps/desktop/src/surfaces/helix/followup/FollowUpInspectPanel.tsx` — painel inspect
- `apps/desktop/src/surfaces/helix/followup/FollowUpWritingPanel.tsx` — conectar com chat
- `apps/desktop/src/surfaces/helix/followup/FollowUpDebugPanel.tsx` — conectar com chat
- `packages/storage/src/migrations/020_follow_up_observation_status.ts` — status, alvo e metadata das observações
- `apps/desktop/src/i18n/locales/*/helix.json` — novas chaves

#### Critérios de aceite
- [x] Sessão de writing ativa registra versões do assistant automaticamente
- [x] Sessão de debug ativa registra tool calls como observações
- [x] Objetivo do follow-up é injetado no contexto do chat
- [x] Modo inspect permite apontar URL/arquivo, anotar componentes, reler e comparar
- [x] Anotações têm status (pendente/em progresso/resolvido)
- [x] "Acompanhar esta tarefa" cria follow-up a partir de um run
- [x] Pausar/retomar follow-up não perde observações
- [x] Widget no collapsed mostra status do follow-up ativo

---

### MF5: Tool Approval — Visibilidade

#### Problema
O usuário não viu o tool approval aparecer. Provavelmente porque nenhuma tool com `executionPolicy: "explicit_approval"` foi chamada.

#### Solução
1. **Investigar quais tools têm `explicit_approval`** no tool registry
2. **Tornar o approval card mais visível** — hoje é um `approval` object no workflowRun mas pode não estar renderizando em todos os modos
3. **Adicionar um indicador no composer** quando o run está `waiting_approval` — badge pulsante + botão "Aprovar/Negar" inline
4. **No collapsed widget** (MF1), mostrar "Aprovação pendente" com botão rápido
5. **Considerar adicionar approval a mais tools** — ex: tools que escrevem arquivos, tools que fazem web requests externas

#### Arquivos afetados
- `packages/agent-runtime/src/workflow/ToolExecutor.ts` — revisar policies
- `packages/tool-registry/src/registry.ts` — revisar quais tools têm explicit_approval
- `apps/desktop/src/surfaces/helix/views/ChatView.tsx` — renderizar approval card
- `apps/desktop/src/surfaces/helix/views/NormalCommandView.tsx` — badge de approval
- `apps/desktop/src/surfaces/helix/composer/Composer.tsx` — indicador de approval pendente

#### Critérios de aceite
- [x] Approval card aparece inline no chat quando uma tool precisa de aprovação
- [x] Badge pulsante no composer/header indica approval pendente
- [x] Botões Aprovar/Negar são acessíveis com 1 clique
- [x] No collapsed widget, approval pendente é visível
- [x] Após aprovar/negar, o run continua corretamente

---

## Mudanças finais — Limpeza Estrutural do Projeto

### LE1: `.gitignore` — Entradas Faltantes

Adicionar ao `.gitignore`:
```
# Tauri generated
apps/desktop/src-tauri/gen/

# Accidental home dir
apps/desktop/src-tauri/$HOME/

# Database files (any location)
*.db
*.db-shm
*.db-wal

# Playwright output (already partially covered)
output/playwright/
```

### LE2: Arquivos e Diretórios para Deletar

- `apps/desktop/src-tauri/$HOME/` — diretório acidental criado por bug do sidecar com `data.db` dentro
- `.playwright-cli/` — 75+ logs antigos acumulados desde Jul 5
- `output/playwright/` — screenshots de teste antigos
- `BACKLOG.md` — arquivo legacy, verificar se ainda é relevante
- `apps/desktop/src/lib/mermaid.ts` vs `mermaid-utils.ts` — consolidar em um só se redundantes

### LE3: Padronização de Testes

- Manter `tests/` na raiz para testes de integração cross-package
- Manter `packages/*/src/__tests__/` para testes unitários
- Mover `packages/tools-desktop/src/dev-tools.test.ts`, `file.test.ts`, `native.test.ts` para `packages/tools-desktop/src/__tests__/`

### LE4: Reorganização de Pastas — `surfaces/helix/`

Estrutura proposta:
```
surfaces/helix/
  index.tsx, constants.tsx, types.ts

  views/         NormalCommandView, ExpandedView, ChatView
  composer/      Composer, ContextChipBar, QueryBubble, ProviderModelSelect
  response/      ResponseBubble
  followup/      FollowUpDock, FollowUpDebugPanel, FollowUpTimeline, FollowUpWritingPanel
  space/         SpaceShell, SpaceMemoryPanel, space-visuals
  panels/        SettingsPanel, ConnectorsPanel, SourcesPanel, PromptsPanel, SkillsPanel, WorkflowsPanel
  selectors/     SkillSelector, WorkflowSelector
  history/       history-list
  hooks/         (mantém)
  parser-mode/   (mantém)
```

### LE5: Reorganização de Pastas — `components/ui/`

Estrutura proposta:
```
components/ui/
  primitives/    badge, button, card, input, label, select, separator, textarea, toast, icon-button, tag-input
  helix/         helix-action-icon, helix-action-rail, helix-drawer, helix-header, helix-launcher, helix-mark, helix-navigation, helix-quick-actions, helix-shell, helix-sidebar
  content/       code-block, markdown-renderer, mermaid-block, compact-result-card
  media/         capture-preview, clipboard-modal, clipboard-preview, screen-region-modal
  layout/        boot-screen, hero-home, starfield
  identity/      agent-identity, profile-switch, recent-conversations, model-selector
  feedback/      error-boundary, context-bar, context-menu-popup
```

### LE6: Organização de `packages/`

- Mover `packages/shared/src/api.ts` para `packages/shared/src/types/api.ts` para centralizar tipos
- Verificar imports de `z` re-exportado do `@desktop-agent/shared` — corrigir para importar diretamente do `zod`
- Avaliar mover `packages/agent-runtime/src/i18n/` para `packages/shared/src/i18n/` ou manter como está

### LE7: Limpeza de Código

- Rodar `bun run lint` para remover imports não usados
- Consolidar `mermaid.ts` + `mermaid-utils.ts` em um único arquivo
- Verificar `BACKLOG.md` — arquivar se não for mais relevante

### Critérios de aceite da limpeza estrutural
- [x] `.gitignore` cobre todos os arquivos temporários identificados
- [x] `$HOME/` acidental deletado
- [x] Logs antigos do Playwright deletados
- [x] Testes do `tools-desktop` padronizados em `__tests__/`
- [x] `surfaces/helix/` organizado em subpastas com imports atualizados
- [x] `components/ui/` organizado em subpastas com imports atualizados
- [x] `bun run typecheck` passa
- [x] `bun run lint` passa
- [x] `bun test` passa (160 testes)
- [x] `bun run build:sidecar` passa

### Checkpoint de validação — 2026-07-14

- `bun run typecheck`: passou em todos os workspaces.
- `bun run lint`: passou em 215 arquivos.
- `bun test`: 160 testes passaram, 0 falhas.
- `bun run build:sidecar`: gerou `agent-runtime-aarch64-apple-darwin`.
- `bun run --cwd apps/desktop tauri build --bundles app`: gerou `Helix.app` com `desktop-agent`, `agent-runtime`, `liteparse.darwin-arm64.node` e `libpdfium.dylib`.
- `bun run desktop:build`: compilou e gerou o `.app`, mas a etapa posterior de DMG falhou em `bundle_dmg.sh`; precisa ser repetida fora do sandbox antes da distribuição.
- Smoke visual automatizado: pendente porque o sandbox bloqueou a porta local e a autorização externa da sessão foi recusada por limite de uso.

---

## Ordem de execução — Mudanças finais

| Fase | Área | Esforço | Impacto |
|------|------|---------|---------|
| 1 | LE1+LE2+LE3 — gitignore + deletar lixo + padronizar testes | Baixo | Imediato |
| 2 | MF3 — Cards inline de transparência | Médio | Alto — resolve a maior quebra de confiança |
| 3 | MF2A+MF2B — Space Wizard com IA + switcher | Médio | Alto — reduz fricção de criação |
| 4 | MF5 — Tool approval | Baixo | Médio — investigar + melhorar visibilidade |
| 5 | MF2C+MF2D — Formulários melhores + guidance | Médio | Médio — polish |
| 6 | LE4+LE5+LE6+LE7 — Reorganização de pastas + limpeza de código | Médio | Médio — saúde do projeto |
| 7 | MF1 — Modos de janela | Alto | Médio — melhora UX mas precisa refactor |
| 8 | MF4 — Follow-up rethink | Alto | Variável — depende de adoção |

## Riscos restantes

1. A validação visual em navegador não substitui o smoke test dentro do host Tauri; RPC e comportamento nativo precisam ser conferidos no `.app`.
2. O upgrade automatizado cobre uma fixture `016`; ainda falta testar uma cópia do banco de desenvolvimento real.
3. Board e summary possuem contrato persistido, mas a profundidade visual principal desta versão está na tabela.
4. Follow-up Vision permanece deliberadamente fora de escopo para evitar observação contínua sem política madura.
5. O build ainda emite warnings não bloqueantes sobre o bundle identifier terminado em `.app` e o tamanho do chunk principal; ambos devem entrar no hardening pós-checkpoint.
6. A criação do DMG ainda precisa ser repetida fora do sandbox; o bundle `.app` já foi gerado e inspecionado.
7. O modo inspect do follow-up (MF4B) depende das permissões normais de leitura de URL/arquivo no Tauri para reler o alvo.

## Notas técnicas finais

- Todas as mudanças devem passar: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build:sidecar`
- Novas RPCs precisam de tipo em `packages/shared/src/types/rpc.ts` + implementação em `packages/agent-runtime/src/api.ts`
- Novas migrations precisam de teste de upgrade
- i18n: manter pt-BR e en sincronizados
- Não reintroduzir domínios removidos (Artifact, Workspace, financeiro)
- Reorganização de pastas deve ser feita em commits separados por subpasta, com typecheck após cada move
