# Plano Helix

> Fonte principal do produto. `BACKLOG.md` fica como histórico/status resumido.
> Última atualização: 2026-07-10.
> Foco atual: consolidar o Helix como camada de ação do desktop, abrir a fundação de Artifacts e transformar Configurações em um centro de controle.

---

## Meta

| Campo         | Valor                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Nome          | Helix                                                                                                     |
| Stack         | Tauri 2 + React 19 + Vite 7 + Tailwind CSS 4 + Zustand 5 + Bun + SQLite                                   |
| Runtime       | Bun sidecar via kkrpc stdio                                                                               |
| Providers     | Pinstripes primário; OpenAI-compatible e Mock suportados; Gemini bloqueado até contrato real ser validado |
| Plataforma    | macOS Apple Silicon                                                                                       |
| Idioma UI     | Português PT-BR                                                                                           |
| Atalho global | `Control+Shift+Space`                                                                                     |
| Janela        | Collapsed `120x120`, Normal `520x820`, Expanded até `1180x820`                                              |
| Produto       | Copilot macOS leve, keyboard-first, com pet launcher, home minimalista, navegação lateral e permissões explícitas |

## North Star Do Produto

O Helix não é um chat com um pet decorativo. Ele é uma camada de ação do desktop cujo fluxo principal é:

```text
Pet flutuante -> radial menu -> ação contextual -> resultado compacto -> expansão opcional
```

Os três modos têm contratos diferentes e não devem repetir a mesma interface em escalas distintas:

| Modo       | Contrato                 | Deve priorizar                                                        |
| ---------- | ------------------------ | --------------------------------------------------------------------- |
| Collapsed  | Presença e launcher      | Estado do pet, radial, gesto, acesso imediato                         |
| Normal     | Painel rápido de ação    | Context Bar, composer, sugestões e resultado compacto                 |
| Expanded   | Workspace de profundidade | Navegação, histórico, Artifacts, Workflows, Skills, Connectors e inspector |

### Linguagem "Orbital Command System"

- Helix é o núcleo.
- Ações são órbitas acionáveis.
- Artifacts são satélites especializados.
- Contextos são sinais capturados e sempre visíveis para o usuário.
- Roxo identifica o Helix; ciano identifica web; âmbar identifica clipboard; amarelo identifica leitura de tela; verde identifica workflow; vermelho identifica erro ou risco.
- Glow, partículas e blur apoiam estado e profundidade, sem competir com texto, composer ou controles.

### Taxonomia Operacional

- **Mode:** como o Helix aparece (`collapsed`, `normal`, `expanded`).
- **Surface:** onde a ação é apresentada (`radial`, `composer`, `workspace`, `tray`, `notification`).
- **Context:** o que está disponível agora (`clipboard`, `screen`, `active_app`, `web`, `file`, `conversation`).
- **Action:** uma operação reutilizável, consumida por radial, composer, workflow ou Artifact.
- **Profile:** estilo e instruções de resposta.
- **Skill:** capacidade isolada.
- **Workflow:** sequência de passos e ferramentas.
- **Artifact:** assistente ou objeto especializado com identidade, ações, política de contexto e evolução própria.

## Estado Auditado Do Worktree

### Implementado

- Atalho global já usa `Control+Shift+Space` no host Tauri.
- Chat multi-turn com `Turn[]`, persistência de conversas, streaming cancellation e MarkdownRenderer.
- Pinstripes é provider principal com `ps/warp`, `ps/thinking` e `ps/pro`.
- MCPs, web search, OCR, prompt library e agent profiles básicos estão funcionais.
- `alwaysOnTop` e `lastWindowMode` persistem entre sessões.
- Migrations versionadas de storage estão em produção (`001_initial`, `002_turns`, `003_settings_v2`, `004_mcp_env`, `005_ui_preferences`, `006_prompt_library`, `007_agent_profiles_fields`, `008_workflows_and_skills`, `009_skill_metadata`).
- Superfície Helix extraída em `apps/desktop/src/surfaces/helix/`.
- Design system base em `apps/desktop/src/components/ui/` com tokens em `index.css`.
- Navegação lateral/drawer inclui Nova conversa, Histórico, Artefatos, Perfis, Conectores, Workflows, Skills e Config.
- Biblioteca inicial de Artifacts (Finanças, Código, Estudos, Escrita, Produto) com cards e quick actions.
- Settings Center responsivo com seções segmentadas.

### Auditoria Visual De 2026-07-10

Resolvido nesta rodada:

- Header virou um trilho de comando compacto; workspace, recolher para o pet e encerrar usam ícones e labels distintos.
- Drawer normal deixou de ocupar a altura inteira e virou um popover flutuante com navegação agrupada.
- Sidebar expandida foi reduzida e separa Trabalho, Construir, Fontes e Configurações.
- Settings passa a ocupar somente o workspace; header e navegação principal permanecem visíveis.
- Home vazia não mostra mais seletores Simples/Workflow e Skill/Workflow antes do composer.
- Pet deixou de usar núcleo circular brilhante e círculos concêntricos; toda superfície usa o glifo "semente helicoidal".
- Radial usa satélites quadrados, atalhos `1-6`, labels neutros e seleção funcional sem glow gamer excessivo.

Pontos ainda abertos:

- Segunda camada do radial para quick actions de Clipboard, Tela, Workflow e Artifacts.
- Inspector expandido ainda precisa de regra de visibilidade e densidade quando não há execução ativa.
- Páginas Perfis, Connectors, Workflows e Skills ainda possuem composições internas mais densas que a home.
- Validar o radial e o pet collapsed no bundle nativo em wallpapers claros e escuros; o browser não reproduz resize/transparência Tauri.

### Planejado (Redesign)

- Home page minimalista: título/pet, composer, chips de sugestão contextual, clipboard preview colapsável.
- Header/top bar unificada: pet mini + título + pin + expandir/minimizar/fechar.
- Navegação lateral fixa no expandido, drawer overlay no normal: Nova conversa, Histórico, Perfis, Conectores, Config.
- Pet collapsed vira launcher (substitui modo mini): 1 clique menu rápido, 2 cliques modo normal.
- Profiles evoluem de Prompts: system prompt evoluído + metadados (nome, descrição, ícone).
- Design system mínimo: `Button`, `IconButton`, `Input`, `Card`, `Badge`, `Separator`, `HelixShell`.
- Aplicar tokens/componentes em Config, Prompts/Profiles e Connectors.
- Action Registry única para alimentar radial, ações rápidas, Workflows e Artifacts.
- Biblioteca inicial de Artifacts: Finanças, Código, Estudos, Escrita e Produto.
- Settings Center com navegação interna e separação entre opções essenciais, avançadas e futuras.
- Resultado compacto com ações Copiar, Refinar e Expandir como padrão do modo normal.

### Hipóteses A Validar

- Composer centralizado no expandido e flutuante no normal não confunde o usuário.
- Pet collapsed como launcher é suficiente para acessos rápidos sem o modo mini.
- Status apenas pela cor/animação do pet é compreensível.
- Helical timeline, motion orbital avançada e scroll não-linear continuam fora do produto principal.

## Decisões De Produto

- Helix é um copilot de desktop, não uma landing page nem um terminal de debug.
- A primeira tela deve ser minimalista, focada no composer, como ChatGPT/Claude/Grok.
- Ações rápidas e contexto detectado aparecem como chips discretos, não como grid de cards.
- Clipboard é contexto opcional. Quando usado, entra no fluxo normal de chat via composer com preview colapsável.
- Pinstripes é o caminho feliz. OpenAI-compatible fica como opção avançada.
- `Option+Space` não deve ser padrão, porque Raycast e ChatGPT Desktop ocupam esse espaço mental do macOS.
- Pet collapsed é o launcher principal; o modo mini da janela principal é substituído pelo menu do pet.
- Status é comunicado pela cor/animação do pet; o header não repete texto de status nem usa bolinhas desalinhadas.
- Navegação para páginas secundárias (Histórico, Perfis, Conectores, Config) fica em sidebar/drawer, não em tabs do header.
- Profiles evoluem de Prompts: system prompt evoluído + metadados (nome, descrição, ícone). Memória e skills ficam fora desta fase.
- Profiles permanecem estilos de resposta; não são renomeados silenciosamente para Artifacts.
- Artifacts podem consumir Profiles, Skills, Workflows e Connectors, mas mantêm identidade e contrato próprios.
- A UI pode expor capacidades futuras desabilitadas ou marcadas como experimentais, desde que não simule persistência ou execução inexistente.
- Qualquer integração com app ativo ou controle do Mac deve explicar permissões antes de pedir acesso.

## Decisões Técnicas

### Settings E Janela

- `UiMode` oficial: `collapsed | normal | expanded`. O modo `mini` da janela principal é removido; o pet collapsed assume o papel de launcher rápido.
- Tamanhos oficiais:
  - `collapsed`: `104x104`
  - `normal`: `520x820`
  - `expanded`: até `1180x820`, centralizado e limitado pela work area.
- `AppSettings` deve incluir `alwaysOnTop` e `lastWindowMode`.
- `lastWindowMode` nunca salva `mini`; se o modo atual for `mini`, salva `normal`.
- `setWindowMode()` deve reaplicar `alwaysOnTop` depois de redimensionar.
- Ao abrir, o app restaura `lastWindowMode`; se `hidePet` estiver ativo e o modo salvo for `collapsed`, abre em `normal`.
- Tray click e atalho global abrem/restauram o modo `normal` (ou `expanded` se esse for o último modo não colapsado).

### Storage

- `001_initial.ts` fica preservado como migration inicial.
- O runner oficial de migrations usa `_migrations(version, applied_at)`.
- Migrations em produção: `001_initial`, `002_turns`, `003_settings_v2`, `004_mcp_env`, `005_ui_preferences`, `006_prompt_library`, `007_agent_profiles_fields`, `008_workflows_and_skills`, `009_skill_metadata`.
- Novas migrations devem ser idempotentes, adicionadas ao final sem alterar migrations anteriores.

### Chat Core

- `messages: Turn[]` é a fonte de verdade; `result` permanece apenas como projeção transitória para views legadas.
- Streaming modifica a última turn em andamento; turns completas são imutáveis.
- Context window usa sliding window dos últimos N turns, default 10.
- Perfil ativo injeta `systemPrompt` no início da conversa (como turn `system` ou prepend na primeira mensagem `user`).
- Clipboard é anexado ao turn `user` quando usado via chips/preview, não como modo de input separado.
- MarkdownRenderer usa `react-markdown` + `remark-gfm` para renderizar respostas.

### Design System

- Criar biblioteca mínima em `apps/desktop/src/components/ui/`:
  - `Button`, `IconButton`, `Input`, `Card`, `Badge`, `Separator`, `HelixShell`.
- Tokens em `index.css` são a base: `ink`, `glass`, `line`, `line-strong`, `fg`, `mute`, `faint`, `signal`, `warn`, `good`, `bad`.
- Adicionar tokens de radius (`--radius-sm/md/lg/xl`) e elevação para componentes.
- Novos componentes não usam `text-[*px]` arbitrários nem `bg-zinc-*` sem justificativa.
- Páginas Config, Prompts/Profiles e Connectors migrarão gradualmente para os novos componentes/tokens.

### Providers

- Pinstripes continua como provider principal com `ps/warp`, `ps/thinking` e `ps/pro`.
- OpenAI-compatible e Mock continuam suportados.
- Gemini continua bloqueado até validação real de streaming e formato.

### Action Registry E Artifacts

- Tipos e catálogos neutros ficam em `packages/shared`; componentes React resolvem ícones por identificadores, sem levar React para o pacote compartilhado.
- `HelixAction` descreve intenção, categoria, contexto necessário, prompt e modo de execução. O handler real continua na superfície/runtime apropriado.
- `HelixArtifact` descreve identidade, quick actions, capacidades, ferramentas, conectores, política de contexto, memória declarada e preferência de UI.
- O catálogo mockado inicial é estático e versionado. Persistência, edição completa, memória própria e sincronização com runtime entram em entregas posteriores.
- O radial e a biblioteca não mantêm arrays concorrentes de ações; ambos derivam do catálogo compartilhado.

## Backlog Refinado

Cada task abaixo deve ser tratada como uma unidade de entrega commitável.

> Auditoria de 2026-07-10: os status abaixo refletem o código e a validação nativa, não apenas a intenção do redesign.

### Fase 1 — Home Page Minimalista

#### H01 — Limpar a home vazia

- Status: concluído — home vazia reduzida a pet, contexto, composer e sugestões acionáveis.
- Objetivo: remover informação repetida e deixar a tela inicial focada no composer, como produtos de referência (ChatGPT, Claude, Grok).
- Arquivos: `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`, `apps/desktop/src/surfaces/helix/index.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. Remover do header interno: "Modelo ativo" com barra de progresso, tabs (Perguntar/Histórico/Prompts/Conectores), botão "Configurar" textual e botão settings duplicado.
  2. Remover da home vazia: seletor Simples/Workflow, seletores de Skill/Workflow, seção MCPs, cards de input mode (Clipboard/Conteúdo avulso) e grid de ações livres/clipboard.
  3. Manter na home vazia: pet mini + título "Helix", composer, linha horizontal de 4-6 chips de sugestão contextual, clipboard preview colapsável.
- Aceite:
  - Home vazia não mostra tabs, seletor Simples/Workflow, seletores de Skill/Workflow, seção MCPs, input mode cards nem grid de ações.
  - `bun run typecheck` e `bun run lint` passam.

#### H02 — Reposicionar o composer

- Status: concluído.
- Objetivo: destacar o campo de input sem poluir a tela.
- Arquivos: `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`, `apps/desktop/src/surfaces/helix/Composer.tsx`.
- Implementação:
  1. Modo expandido: composer centralizado verticalmente na área útil.
  2. Modo normal: composer flutuante no centro-inferior, abaixo do título/pet, com padding generoso.
  3. Manter auto-expand, Enter envia, Shift+Enter quebra linha.
- Aceite:
  - Composer centralizado no expandido e flutuante centro-inferior no normal sem cortar conteúdo.
  - Cursor foca automaticamente no composer ao abrir a janela.

#### H03 — Chips de sugestão contextual

- Status: concluído.
- Objetivo: substituir o grid de ações por uma linha discreta de chips.
- Arquivos: `apps/desktop/src/surfaces/helix/ContextChipBar.tsx`, `apps/desktop/src/surfaces/helix/hooks/useContextChips.ts`, `apps/desktop/src/surfaces/helix/constants.tsx`.
- Implementação:
  1. Renderizar 4-6 chips em linha horizontal abaixo do composer.
  2. Quando há clipboard: chips como "Resumir texto", "Extrair tópicos", "Explicar", "Traduzir".
  3. Quando vazio: chips como "Pergunta livre", "Pesquisar web", "Montar plano", "Explorar ideias".
  4. Clicar em chip injeta o prompt no composer e, se aplicável, anexa o conteúdo do clipboard.
- Aceite:
  - Chips aparecem em ambos os modos e respondem ao clique.
  - Chips não executam automaticamente; só preenchem o composer.

#### H04 — Clipboard preview colapsável

- Status: concluído.
- Objetivo: unificar o clipboard ao chat normal, mantendo preview compacto e interativo.
- Arquivos: `apps/desktop/src/surfaces/helix/Composer.tsx`, `apps/desktop/src/surfaces/helix/ContextChipBar.tsx`, `apps/desktop/src/surfaces/helix/index.tsx`.
- Implementação:
  1. Substituir a seção de clipboard atual por um card colapsável posicionado junto ao composer.
  2. Mostrar ícone de clipboard, contador de caracteres e primeiros 120 caracteres.
  3. Botões para expandir/recolher e limpar.
  4. Quando não há clipboard, mostrar dica discreta.
- Aceite:
  - Preview reflete o clipboard atual e é colapsável.
  - Clicar em chip de contexto usa o conteúdo do clipboard no composer.

### Fase 2 — Header/Top Bar Unificada e Pet Redesign

#### P01 — Criar componente HelixHeader

- Status: concluído e revisado visualmente — trilho compacto com controles semanticamente distintos.
- Objetivo: unificar controles de janela, título e status em uma única top bar limpa.
- Arquivos: `apps/desktop/src/components/ui/helix-header.tsx`, `apps/desktop/src/surfaces/helix/index.tsx`, `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`.
- Implementação:
  1. Criar `HelixHeader` com: pet mini alinhado + título "Helix" + `IconButton` de pin/always-on-top + expandir + minimizar + fechar.
  2. Remover botão "Configurar" textual, botão settings duplicado, tabs e barra de progresso do header.
  3. Status transmitido apenas pela cor/animação do pet.
- Aceite:
  - Header contém apenas pet mini, título, pin, expandir, minimizar, fechar.
  - Sem texto de status na top bar.

#### P02 — Redesign do pet

- Status: concluído e substituído pela identidade "semente helicoidal" em header, home, boot, chat e radial.
- Objetivo: corrigir alinhamento e fazer o pet comunicar estado de forma limpa.
- Arquivos: `apps/desktop/src/components/ui/pet.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. Ajustar `PetDot` para alinhamento perfeito ao texto (vertical-align center).
  2. Definir tamanhos: header `16-18px`, collapsed `64px`.
  3. Manter estados por cor e animações suaves.
  4. Remover indicadores de status separados desalinhados.
- Aceite:
  - Pet não aparece desalinhado no header.
  - Estados por cor funcionam em idle, thinking, success, error, connecting.

#### P03 — Pet collapsed como launcher

- Status: concluído.
- Objetivo: substituir o modo mini da janela principal pelo menu do pet collapsed.
- Arquivos: `apps/desktop/src/app.tsx`, `apps/desktop/src/components/ui/pet.tsx`, `apps/desktop/src/lib/window.ts`, `apps/desktop/src/surfaces/helix/MiniView.tsx`.
- Implementação:
  1. Clique único no pet collapsed abre popover/radial menu: Nova conversa, Pergunta livre, Pesquisar web, Ler tela, Abrir normal.
  2. Duplo clique abre modo normal (com debounce para não conflitar com clique único).
  3. Remover `MiniView` e referências ao modo `mini` da janela principal.
  4. Atualizar `lastWindowMode` para nunca salvar `mini`; tray/atalho abrem `normal`.
- Aceite:
  - Pet collapsed responde a clique único (menu) e duplo clique (normal).
  - Não há mais janela `mini` de `392x460`.

#### P04 — Navegação lateral e drawer

- Status: concluído e revisado — sidebar agrupada no expanded e popover flutuante no normal.
- Objetivo: mover navegação secundária para fora do header.
- Arquivos: `apps/desktop/src/components/ui/helix-sidebar.tsx`, `apps/desktop/src/components/ui/helix-drawer.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`, `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`.
- Implementação:
  1. Criar `HelixSidebar` fixa no modo expandido (largura `200px`).
  2. Criar `HelixDrawer` overlay no modo normal.
  3. Itens: Nova conversa, Histórico, Artefatos, Perfis, Conectores, Workflows, Skills, Config.
  4. Cada item aciona `setMode` ou abre settings.
- Aceite:
  - Sidebar fixa funciona no expandido; drawer funciona no normal.
  - Navegação não usa mais tabs no header.
  - Itens Workflows e Skills aparecem como entradas reais (não como placeholders).

### Fase 3 — Design System e Componentes Reutilizáveis

#### D01 — Tokens de design

- Status: concluído.
- Objetivo: consolidar a base visual para a nova superfície e páginas internas.
- Arquivos: `apps/desktop/src/index.css`.
- Implementação:
  1. Confirmar/adicionar tokens de cor: `ink`, `glass`, `line`, `line-strong`, `fg`, `mute`, `faint`, `signal`, `signal-dim`, `warn`, `good`, `bad`.
  2. Adicionar tokens de radius: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 16px`, `--radius-xl: 20px`.
  3. Adicionar tokens de elevação/superfície para cards e overlays.
- Aceite:
  - Tokens disponíveis e usados pelos novos componentes.
  - Nenhum novo componente usa `bg-zinc-*` sem justificativa.

#### D02 — Biblioteca de componentes

- Status: concluído.
- Objetivo: criar componentes reutilizáveis consistentes.
- Arquivos: `apps/desktop/src/components/ui/button.tsx`, `icon-button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `separator.tsx`, `helix-shell.tsx`.
- Implementação:
  1. `Button`: variantes `primary`, `secondary`, `ghost`, `danger`; tamanhos `sm`, `md`, `lg`.
  2. `IconButton`: botão quadrado para ícones com tooltip nativo (`title`).
  3. `Input`: input estilizado com foco sutil e estado inválido.
  4. `Card`: container com fundo `white/[0.02]`, borda `line`, radius `lg`.
  5. `Badge`: variantes `default`, `success`, `warning`, `error`, `signal`.
  6. `Separator`: linha sutil usando `helix-rule`.
  7. `HelixShell`: wrapper comum para todas as views, aplicando `agent-shell`, padding e scroll.
- Aceite:
  - Componentes existem, são tipados e têm uso em pelo menos uma nova tela e uma página existente.
  - Novos componentes não usam `text-[*px]` arbitrários.

#### D03 — Aplicar design system às páginas internas

- Status: parcialmente concluído — tokens e componentes já são usados, mas ainda há composição específica demais nas páginas internas.
- Objetivo: deixar Config, Prompts/Profiles e Connectors visualmente aderentes ao system design sem reestruturar conteúdo.
- Arquivos: `apps/desktop/src/surfaces/helix/SettingsPanel.tsx`, `PromptsPanel.tsx`, `ConnectorsPanel.tsx`.
- Implementação:
  1. Migrar inputs, botões, cards e badges para os novos componentes.
  2. Substituir cores utilitárias por tokens.
  3. Ajustar espaçamentos e raios para consistência.
- Aceite:
  - Páginas internas usam `Button`, `Input`, `Card`, `Badge`.
  - Visual fica consistente com a nova home e header.
  - `bun run typecheck` e `bun run lint` passam.

### Fase 4 — Profiles e Unificação do Clipboard com Chat

#### PR01 — Renomear Prompts para Perfis na navegação

- Status: concluído.
- Objetivo: reposicionar a aba como central de Profiles, mantendo templates de prompt acessíveis.
- Arquivos: `apps/desktop/src/surfaces/helix/PromptsPanel.tsx`, `apps/desktop/src/components/ui/helix-sidebar.tsx`, `apps/desktop/src/components/ui/helix-drawer.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`, `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`.
- Implementação:
  1. Trocar label "Prompts" para "Perfis" na sidebar/drawer.
  2. No painel, manter seção de templates de prompt como subtítulo/aba, mas destacar Profiles.
  3. Ajustar título da página no modo expandido.
- Aceite:
  - Navegação mostra "Perfis".
  - Templates continuam acessíveis dentro do mesmo painel.

#### PR02 — Evoluir modelo de Profile

- Status: concluído.
- Objetivo: permitir system prompt evoluído e metadados por profile.
- Arquivos: `packages/storage/src/repositories/prompt-library.ts`, `packages/storage/src/migrations/006_prompt_library.ts`, `packages/shared/src/types/rpc.ts`, `packages/shared/src/api.ts`.
- Implementação:
  1. Adicionar campos a `AgentProfile`: `systemPrompt`, `tone`, `responseStyle`, `constraints`.
  2. Se schema não suportar, criar migration `007_profiles_enhanced`.
  3. Atualizar `SaveProfileInput` e tipos RPC.
  4. Salvar `activeProfileId` em `AppSettings`.
- Aceite:
  - Criar/editar profile com campos novos funciona.
  - `activeProfileId` persiste entre sessões.

#### PR03 — Aplicar profile ativo ao chat

- Status: parcialmente concluído — o profile ativo chega ao runtime, mas `startRun` carrega o profile ativo a cada run, então trocar de profile no meio de uma conversa muda a resposta atual.
- Objetivo: o system prompt do profile influenciar as respostas sem afetar conversas já abertas.
- Arquivos: `packages/agent-runtime/src/orchestrator.ts`, `packages/agent-runtime/src/workflow-runner.ts`, `apps/desktop/src/stores/agent.ts`.
- Implementação:
  1. Snapshot do profile ativo no primeiro turn da conversa (ex.: persistir `profileId` no turn inicial ou na `Conversation`).
  2. `startRun` deve usar o profile do turn/conversa, não o `activeProfileId` dos settings.
  3. Injetar `systemPrompt` como turn `system` ou prepend na primeira mensagem `user`.
  4. Respeitar `tone`, `responseStyle` e `constraints` no prompt de sistema.
- Aceite:
  - Iniciar conversa com profile ativo aplica o system prompt.
  - Troca de profile reflete em novas conversas, não em conversas passadas.

#### PR04 — Unificar clipboard ao chat normal

- Status: parcialmente concluído — o clipboard já entra pelo composer e pelo runtime via `sourceMode: "clipboard"`, mas ainda não é persistido como bloco explícito do turn `user`.
- Objetivo: eliminar o modo de input "clipboard" como estado separado e tornar o fluxo mais natural.
- Arquivos: `apps/desktop/src/surfaces/helix/index.tsx`, `apps/desktop/src/surfaces/helix/hooks/useExecute.ts`, `apps/desktop/src/surfaces/helix/ContextChipBar.tsx`, `apps/desktop/src/surfaces/helix/Composer.tsx`, `apps/desktop/src/stores/agent.ts`.
- Implementação:
  1. Remover `inputMode` do fluxo principal; substituir por "usar clipboard" via chips/preview.
  2. Clicar em chip de contexto insere o conteúdo do clipboard no composer como bloco de contexto editável.
  3. Enviar a mensagem cria um turn `user` com blocos `text` + `context` (ou similar) explícitos para o clipboard.
  4. Atualizar `ChatView` e regeneração para ler o bloco de clipboard.
  5. Manter preview colapsável do clipboard junto ao composer.
- Aceite:
  - Não há mais estado "Conteúdo avulso" vs "Clipboard".
  - Chip de contexto insere clipboard no composer e envia como turn normal.
  - Turn `user` persiste o clipboard como bloco próprio.
  - Preview colapsável reflete o clipboard atual.

### Fase 5 — Action Registry E Radial V2

#### A01 — Criar contrato compartilhado de ações

- Status: concluído — catálogo declarativo compartilhado por desktop e runtime.
- Objetivo: eliminar listas paralelas de ações e fornecer uma fonte tipada para radial, composer, Workflows e Artifacts.
- Arquivos: `packages/shared/src/types/rpc.ts`, `packages/shared/src/helix.ts`, `packages/shared/src/index.ts`, `apps/desktop/src/surfaces/helix/constants.tsx`.
- Implementação:
  1. Criar `HelixAction` com `id`, `title`, `description`, `icon`, `category`, `color`, `prompt`, `requiredContext` e `executionMode` opcional.
  2. Criar categorias `ask`, `clipboard`, `screen`, `web`, `workflow` e `artifact`.
  3. Migrar ações livres e de clipboard existentes para o catálogo compartilhado sem mudar o comportamento atual do composer.
  4. Manter handlers fora do pacote compartilhado; a UI resolve uma ação declarativa para callbacks locais.
- Aceite:
  - Radial e ações contextuais podem selecionar ações pelo mesmo `id`.
  - Pacote `shared` continua sem dependência de React.
  - `bun run build:packages` passa.

#### A02 — Evoluir radial para seis intenções

- Status: parcialmente concluído — primeira órbita redesenhada, com seis intenções, atalhos `1-6` e navegação por teclado; segunda camada continua pendente.
- Objetivo: fazer o radial representar o modelo mental principal do produto.
- Arquivos: `apps/desktop/src/components/ui/helix-launcher.tsx`, `apps/desktop/src/app.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. Primeira órbita: Perguntar, Clipboard, Ler tela, Web, Workflow e Artifacts.
  2. Resolver label, cor e ícone pelo Action Registry.
  3. Preservar clique simples, duplo clique, drag do pet e navegação por teclado.
  4. Segunda camada: mostrar quick actions/contextuais ao selecionar uma intenção; não implementar automações reais sem permissão.
- Edge cases:
  - Clique simples não pode disparar junto com duplo clique.
  - A janela transparente precisa crescer antes de renderizar itens fora da área colapsada.
  - Ações sem contexto obrigatório abrem o modo normal com o composer preenchido; ações sensíveis não executam automaticamente.
- Aceite:
  - As seis intenções ficam legíveis em wallpaper claro e escuro.
  - Teclado, mouse, drag e duplo clique continuam funcionando.

### Fase 6 — Artifact Foundation

#### AR01 — Criar contrato e catálogo inicial

- Status: concluído — contratos e cinco mocks versionados em `packages/shared`.
- Objetivo: abrir espaço arquitetural para assistentes especializados sem transformar Profiles em um conceito genérico demais.
- Arquivos: `packages/shared/src/types/rpc.ts`, `packages/shared/src/helix-catalog.ts`, `packages/shared/src/index.ts`.
- Implementação:
  1. Criar `HelixArtifact`, `ArtifactAction`, `ArtifactContextPolicy`, `ArtifactMemoryPolicy` e `ArtifactUiConfig`.
  2. Criar mocks versionados para Finanças, Código, Estudos, Escrita e Produto.
  3. Cada Artifact deve declarar quick actions, contextos permitidos, ferramentas/conectores previstos e modo preferido.
  4. Não declarar memória persistente real onde ainda não existe; usar a política como contrato de produto.
- Aceite:
  - Catálogo é importável por desktop e sidecar.
  - Os cinco Artifacts têm identidade e ações distintas.
  - Não há dependência de React nos tipos ou mocks.

#### AR02 — Criar biblioteca de Artifacts

- Status: concluído na fundação — biblioteca read-only e quick actions funcionais; edição e fixação continuam futuras.
- Objetivo: educar o usuário sobre o conceito e oferecer uma entrada real para uso dos mocks.
- Arquivos: `apps/desktop/src/surfaces/helix/ArtifactsPanel.tsx`, `ExpandedView.tsx`, `NormalCommandView.tsx`, `types.ts`, `helix-sidebar.tsx`, `helix-drawer.tsx`.
- Implementação:
  1. Adicionar Artefatos na navegação expandida e no drawer normal.
  2. Criar cards com nome, ícone, descrição, quick actions, modo preferido e capacidades.
  3. `Usar` abre o modo normal com uma ação inicial; `Fixar no radial`, `Editar` e `Duplicar` aparecem somente quando tiverem estado real ou indicação experimental honesta.
  4. Finanças deve ser o primeiro Artifact destacado, sem prometer importação de PDF/CSV ainda inexistente.
- Aceite:
  - Biblioteca funciona nos modos normal e expanded.
  - Uma quick action preenche o composer e retorna para `command`.
  - O usuário distingue Profile de Artifact pela linguagem da UI.

### Fase 7 — Settings Center

#### S01 — Criar navegação interna segmentada

- Status: concluído — Settings Center responsivo renderizado dentro do workspace, sem cobrir header e navegação principal.
- Objetivo: substituir o formulário longo por um centro de controle compreensível.
- Arquivos: `apps/desktop/src/surfaces/helix/SettingsPanel.tsx`, `hooks/useSettingsForm.ts`.
- Seções: Geral, Modelo e API, Pet e janela, Atalhos, Contexto e privacidade, Conectores, Artifacts, Workflows, Dados e histórico, Avançado.
- Implementação:
  1. Sidebar interna selecionável e conteúdo rolável independente.
  2. Footer persistente com Cancelar e Salvar.
  3. Modelo/API e Pet/janela usam os campos reais existentes.
  4. Campos ainda não persistidos aparecem como roadmap/experimental desabilitado, nunca como toggle funcional falso.
  5. API key fica mascarada; Base URL e timeout passam para bloco avançado.
- Aceite:
  - Configurações não exibem todas as opções com o mesmo peso.
  - Fluxo real de provider, model, API key, opacity, pet size e hide pet continua salvando.
  - A seção atual fica clara por estado ativo, título e descrição.

#### S02 — Evoluir settings persistidos

- Status: futuro.
- Objetivo: persistir preferências que hoje são apenas direção de produto.
- Arquivos: `packages/shared/src/types/rpc.ts`, nova migration de storage, repository de settings, store e `useSettingsForm`.
- Campos candidatos: modo padrão, comportamento de clique, retenção, confirmações de contexto, esconder conteúdo sensível, inspector no expanded e flags experimentais de Artifacts.
- Aceite:
  - Migration idempotente e compatível com bancos existentes.
  - Defaults seguros para clipboard, tela e retenção.
  - Configuração só aparece como editável depois de existir ponta a ponta.

### Fase 8 — Resultado Compacto E Contexto Explícito

#### R01 — Card de resultado rápido

- Status: pendente — `CompactResultCard.tsx` não existe; o modo normal ainda usa a área grande de resultado (`TaskActive`/`ChatActive`).
- Objetivo: permitir ação rápida sem transformar toda interação em conversa longa.
- Arquivos: novo `CompactResultCard.tsx`, `NormalCommandView.tsx`, `ChatView.tsx`.
- Implementação: preview do resultado, Copiar, Refinar e Expandir; Inserir e Salvar como Artifact ficam condicionados a integração real.
- Aceite:
  - Resultado curto cabe no modo normal e pode expandir sem perder a conversa.

#### C01 — Context Bar orientada a permissões

- Status: parcialmente concluído — `ContextBar` mostra apenas clipboard; tela, app ativo, arquivo e connectors ainda não estão consolidados.
- Objetivo: mostrar claramente o que o Helix está vendo e o que será enviado.
- Arquivos: `ContextBar.tsx`, `ContextChipBar.tsx`, `useContextChips.ts`, `Composer.tsx`, inspector do expanded.
- Implementação: consolidar Clipboard, Tela, App ativo, arquivo e connectors; cada origem oferece Ver, Usar/Não usar e Remover quando aplicável.
- Aceite:
  - Nenhum contexto sensível é enviado sem indicação visual e política aplicável.

## Fora do Escopo

- Memória persistente entre conversas.
- Skills customizadas.
- Profiles avançados (voz, idioma e modelos preferenciais).
- Persistência/edição completa de Artifacts, memória própria e UI customizada por Artifact.
- Leitura contínua de tela ou clipboard sem contrato de permissão e implementação ponta a ponta.
- Anexos de arquivo.
- Voz/áudio.
- Novas ferramentas de runtime/backend.
- Redesign estrutural das páginas Config, Prompts/Profiles e Connectors (apenas tokens/componentes reutilizáveis).

## Ordem Recomendada De Commits (atualizada)

1. `docs: sync PLANO.md with current worktree state`
2. `feat: finalize minimal home page (H01)`
3. `feat: apply design system to internal panels (D03)`
4. `fix: active profile must not affect existing conversations (PR03)`
5. `feat: persist clipboard as explicit message block (PR04)`
6. `feat: compact result card for normal mode (R01)`
7. `feat: permission-oriented context bar (C01)`
8. `feat: radial V2 second orbit (A02)`
9. `feat: evolve persisted settings (S02)`

## Critérios Gerais de Aceite do Redesign

- Não há mais botões repetidos no header.
- Pet está alinhado e comunica status por cor/animação.
- Home page é minimalista: título/pet, composer, chips, clipboard colapsável.
- Navegação lateral/drawer acessa Nova conversa, Histórico, Artefatos, Perfis, Conectores, Workflows, Skills, Config.
- Pet collapsed substituiu o modo mini e oferece menu rápido.
- Páginas Config, Prompts/Profiles e Connectors usam tokens e componentes reutilizáveis.
- Profile ativo aplica system prompt sem afetar conversas já abertas.
- Clipboard é enviado como bloco explícito do turn `user`.
- Resultado curto é exibido como card compacto no modo normal (Copiar/Refinar/Expandir).
- `bun run typecheck` e `bun run lint` passam em todas as fases.
- Screenshots comparativas antes/depois documentam cada modo (normal, expandido, pet collapsed).

## Verificação

```bash
bun run lint
bun run typecheck
bun test
bun run desktop:build
```

Testes manuais obrigatórios:

1. Abrir modo normal e verificar home limpa.
2. Clicar no pet collapsed e usar menu rápido.
3. Duplo clique no pet para abrir modo normal.
4. Usar chip de contexto com clipboard detectado.
5. Navegar para Histórico, Perfis, Conectores, Config via sidebar/drawer.
6. Criar e ativar um profile; iniciar conversa e confirmar system prompt aplicado.

## Referências

- ChatGPT / Claude / Grok: composer centralizado na home vazia, navegação lateral, header minimalista.
- Raycast: launcher discreto, ações rápidas acessíveis com poucos cliques.
- Imagens 1-4 do usuário: problemas de repetição de botões, tabs e informação excessiva na home.
- Raycast shortcuts: https://manual.raycast.com/keyboard-shortcuts
- Raycast AI: https://www.raycast.com/core-features/ai
- Tauri global shortcut: https://v2.tauri.app/plugin/global-shortcut/
- Tauri system tray: https://v2.tauri.app/learn/system-tray/
- ChatGPT Work with Apps: https://help.openai.com/en/articles/10119604-work-with-apps-on-macos
- Apple Accessibility permissions: https://support.apple.com/guide/mac-help/allow-accessibility-apps-to-access-your-mac-mh43185/mac
