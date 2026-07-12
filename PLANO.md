# Plano Helix

> Fonte principal do produto. `BACKLOG.md` fica como histórico/status resumido.
> Última atualização: 2026-07-11.
> Foco atual: fechar pendências do redesign, consolidar Settings e contexto explícito, adicionar trabalho seguro com arquivos e ferramentas nativas e manter Workspaces contínuos e Follow-up Sessions no roadmap ativo.

---

## Meta

| Campo         | Valor                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Nome          | Helix                                                                                                     |
| Stack         | Tauri 2 + React 19 + Vite 7 + Tailwind CSS 4 + Zustand 5 + Bun + SQLite                                   |
| Runtime       | Bun sidecar via kkrpc stdio                                                                               |
| Providers     | Pinstripes primário; OpenAI-compatible e Mock suportados; Gemini bloqueado até contrato real ser validado |
| Plataforma    | macOS Apple Silicon                                                                                       |
| Idioma UI     | Português PT-BR e inglês                                                                                  |
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
| Expanded   | Workspace de profundidade | Navegação, histórico, Espaços, fontes, configurações e inspector            |

### Linguagem "Orbital Command System"

- Helix é o núcleo.
- Ações são órbitas acionáveis.
- Workspaces são ambientes contínuos; Artifacts permanece como nome interno temporário do catálogo legado.
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
- **Workflow:** sequência executável e finita, normalmente vinculada a uma ação ou Workspace.
- **Workspace:** ambiente persistente com identidade, memória editável, contexto fixado, histórico e ações próprias.
- **Artifact:** contrato interno legado usado para iniciar a migração para Workspace; não é um destino concorrente na UI.
- **Follow-up Session:** sessão contínua, pausável e explicitamente visível que acompanha um objetivo em modo `vision`, `debug`, `writing`, `research` ou `workflow`.

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
- Navegação lateral/drawer prioriza Nova conversa, Histórico, Espaços, Conectores e Config; Workflows continuam acionáveis e Profiles continuam contextuais.
- Biblioteca inicial de Artifacts (Finanças, Código, Estudos, Escrita, Produto) com cards e quick actions.
- Settings Center responsivo com seções segmentadas.

### Auditoria Visual De 2026-07-10

Resolvido nesta rodada:

- Header virou um trilho de comando compacto; workspace, recolher para o pet e encerrar usam ícones e labels distintos.
- Drawer normal deixou de ocupar a altura inteira e virou um popover flutuante com navegação agrupada.
- Sidebar expandida foi reduzida e separa Trabalho, Fontes e Configurações.
- Settings passa a ocupar somente o workspace; header e navegação principal permanecem visíveis.
- Home vazia não mostra mais seletores Simples/Workflow e Skill/Workflow antes do composer.
- A marca foi refeita como um `H` entrelaçado de duas fitas contínuas, legível no header e no pet sem losango ou satélite decorativo.
- Pet collapsed ficou menor, com área clicável preservada; movimento e glow agora respondem ao estado em vez de decorar o idle.
- Radial foi reduzido para `380x380`, ganhou preview central, transições curtas e mantém atalhos `1-6`, setas, `Enter` e `Escape`.
- O modo normal virou uma command palette operacional: composer em primeiro foco e as seis intenções derivadas de `HELIX_ACTIONS`.
- Profiles, Workflows e Skills saíram da navegação principal; Profiles permanecem estilo, Workflows permanecem sequência e Espaços viram o destino contínuo.

Pontos ainda abertos:

- Inspector expandido ainda precisa de regra de visibilidade e densidade quando não há execução ativa.
- Páginas Perfis, Connectors, Workflows e Skills ainda possuem composições internas mais densas que a home.
- Validar o radial e o pet collapsed no bundle nativo em wallpapers claros e escuros; o browser não reproduz resize/transparência Tauri.

### Auditoria Visual De 2026-07-11

Resolvido nesta rodada:

- Segunda camada do radial implementada com quick actions declarativas para Clipboard, Tela, Workflow e Espaços.
- Submenu secundário trava a intenção primária depois do clique; atravessar o radial com o mouse não troca conteúdo nem dispara resize concorrente.
- Painel secundário abre no lado da intenção selecionada e cresce verticalmente conforme a quantidade de itens, preservando o radial em `380x380`.
- Ações sensíveis do radial apenas preenchem o composer; não executam automaticamente.
- Context Bar unificada em uma única régua; capacidades mockadas aparecem como `Em breve` e não oferecem botões de permissão sem implementação.
- Home normal e expandida compartilham a mesma Action Rail derivada de `HELIX_ACTIONS`.
- Resultado compacto e Mermaid no chat possuem componentes dedicados e cobertura de testes focada.

Pontos ainda abertos:

- Substituir os mocks de Tela, App ativo, Arquivo e Connector por contextos reais com ciclo Ver, Usar/Não usar e Remover.
- Validar pet e radial sobre wallpapers claros e escuros em mais de uma escala de monitor.

### Planejado (Redesign)

- Command palette minimalista: marca, composer, contexto explícito e índice compacto das seis intenções.
- Header/top bar unificada: marca Helix + título + pin + expandir/minimizar/fechar.
- Navegação lateral fixa no expandido, drawer overlay no normal: Nova conversa, Histórico, Espaços, Conectores e Config.
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
- As seis intenções primárias podem aparecer como índice compacto da command palette; subações e contexto detectado continuam como chips discretos.
- Clipboard é contexto opcional. Quando usado, entra no fluxo normal de chat via composer com preview colapsável.
- Pinstripes é o caminho feliz. OpenAI-compatible fica como opção avançada.
- `Option+Space` não deve ser padrão, porque Raycast e ChatGPT Desktop ocupam esse espaço mental do macOS.
- Pet collapsed é o launcher principal; o modo mini da janela principal é substituído pelo menu do pet.
- Status é comunicado pela cor/animação do pet; o header não repete texto de status nem usa bolinhas desalinhadas.
- Navegação principal fica em Nova conversa, Histórico, Espaços, Conectores e Config. Profiles são estilos contextuais; Workflows são acessados por ação ou dentro de um Workspace.
- Profiles evoluem de Prompts: system prompt evoluído + metadados (nome, descrição, ícone). Memória e skills ficam fora desta fase.
- Profiles permanecem estilos de resposta; não são renomeados silenciosamente para Artifacts.
- Artifacts podem consumir Profiles, Skills, Workflows e Connectors, mas mantêm identidade e contrato próprios.
- A UI pode expor capacidades futuras desabilitadas ou marcadas como experimentais, desde que não simule persistência ou execução inexistente.
- Qualquer integração com app ativo ou controle do Mac deve explicar permissões antes de pedir acesso.

## Decisões Técnicas

### Settings E Janela

- `UiMode` oficial: `collapsed | normal | expanded`. O modo `mini` da janela principal é removido; o pet collapsed assume o papel de launcher rápido.
- Tamanhos oficiais:
  - `collapsed`: `120x120`, com glifo visual entre `48-58px`
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
  2. Remover da home vazia: seletor Simples/Workflow, seletores de Skill/Workflow, seção MCPs, cards de input mode (Clipboard/Conteúdo avulso) e grids concorrentes de ações livres/clipboard.
  3. Manter na home vazia: marca Helix, composer, clipboard preview colapsável e índice compacto das seis intenções derivadas de `HELIX_ACTIONS`.
- Aceite:
  - Home vazia não mostra tabs, seletor Simples/Workflow, seletores de Skill/Workflow, seção MCPs nem catálogos de ações concorrentes.
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
- Objetivo: usar chips para subações e sugestões contextuais, sem duplicar as seis intenções da command palette.
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
  1. Criar `HelixHeader` com: marca Helix alinhada + título "Helix" + `IconButton` de pin/always-on-top + expandir + minimizar + fechar.
  2. Remover botão "Configurar" textual, botão settings duplicado, tabs e barra de progresso do header.
  3. Status do pet permanece nas superfícies de presença; a execução ativa usa estado explícito no conteúdo.
- Aceite:
  - Header contém apenas marca, título, pin, expandir, minimizar e fechar.
  - Sem texto de status na top bar.

#### P02 — Redesign do pet

- Status: concluído nesta rodada — identidade anterior substituída pelo monograma Helix entrelaçado em header, boot, pet e radial.
- Objetivo: corrigir alinhamento e fazer o pet comunicar estado de forma limpa.
- Arquivos: `apps/desktop/src/components/ui/pet.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. Ajustar `PetDot` para alinhamento perfeito ao texto (vertical-align center).
  2. Definir tamanhos: header `20px`, collapsed visual `48-58px` dentro da janela clicável de `120x120`.
  3. Manter estados por cor e animações suaves para `connecting`, `thinking`, `using_tool`, `waiting_approval`, `success`, `error` e `idle`.
  4. Remover indicadores de status separados desalinhados.
- Aceite:
  - Marca não aparece desalinhada no header; pet preserva proporção em collapsed, boot e avatares.
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

- Status: concluído e simplificado nesta rodada — sidebar agrupada no expanded e popover flutuante no normal, sem tratar entidades técnicas como destinos equivalentes.
- Objetivo: mover navegação secundária para fora do header.
- Arquivos: `apps/desktop/src/components/ui/helix-sidebar.tsx`, `apps/desktop/src/components/ui/helix-drawer.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`, `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`.
- Implementação:
  1. Criar `HelixSidebar` fixa no modo expandido (largura `200px`).
  2. Criar `HelixDrawer` overlay no modo normal.
  3. Itens principais: Nova conversa, Histórico, Espaços, Conectores e Config.
  4. Profiles permanecem seletores de estilo no contexto da conversa; Workflows permanecem ações/rotinas; Skills aparecem somente onde uma capacidade é configurada.
  5. Cada item aciona `setMode` ou abre settings.
- Aceite:
  - Sidebar fixa funciona no expandido; drawer funciona no normal.
  - Navegação não usa mais tabs no header.
  - Profiles, Workflows e Skills continuam acessíveis no contexto correto sem competir na navegação principal.

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

- Status: concluído — primeira órbita compacta, seis intenções, preview central, segunda camada responsiva, atalhos `1-6` e navegação por teclado validados no bundle nativo.
- Objetivo: fazer o radial representar o modelo mental principal do produto.
- Arquivos: `apps/desktop/src/components/ui/helix-launcher.tsx`, `apps/desktop/src/app.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. Primeira órbita: Perguntar, Clipboard, Ler tela, Web, Workflow e Espaços.
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

### Fase 6 — Artifact Foundation (compatibilidade)

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
- Objetivo: oferecer uma entrada real para uso do catálogo durante a migração visual para Espaços.
- Arquivos: `apps/desktop/src/surfaces/helix/ArtifactsPanel.tsx`, `ExpandedView.tsx`, `NormalCommandView.tsx`, `types.ts`, `helix-sidebar.tsx`, `helix-drawer.tsx`.
- Implementação:
  1. Expor o catálogo como Espaços na navegação expandida e no drawer normal, mantendo os tipos internos por compatibilidade.
  2. Criar cards com nome, ícone, descrição, quick actions, modo preferido e capacidades.
  3. `Usar` abre o modo normal com uma ação inicial; `Fixar no radial`, `Editar` e `Duplicar` aparecem somente quando tiverem estado real ou indicação experimental honesta.
  4. Finanças deve ser o primeiro Artifact destacado, sem prometer importação de PDF/CSV ainda inexistente.
- Aceite:
  - Biblioteca funciona nos modos normal e expanded.
  - Uma quick action preenche o composer e retorna para `command`.
  - O usuário distingue Profile, Workflow e Espaço pela linguagem da UI.

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

- Status: concluído — `CompactResultCard.tsx` fornece preview truncado, Copiar, Refinar e Expandir no modo normal.
- Objetivo: permitir ação rápida sem transformar toda interação em conversa longa.
- Arquivos: novo `CompactResultCard.tsx`, `NormalCommandView.tsx`, `ChatView.tsx`.
- Implementação: preview do resultado, Copiar, Refinar e Expandir; Inserir e Salvar como Artifact ficam condicionados a integração real.
- Aceite:
  - Resultado curto cabe no modo normal e pode expandir sem perder a conversa.

#### C01 — Context Bar orientada a permissões

- Status: parcialmente concluído — Clipboard está funcional; Tela, App ativo, Arquivo e Connector estão consolidados visualmente como mocks honestos, ainda sem captura ou permissão real.
- Objetivo: mostrar claramente o que o Helix está vendo e o que será enviado.
- Arquivos: `ContextBar.tsx`, `ContextChipBar.tsx`, `useContextChips.ts`, `Composer.tsx`, inspector do expanded.
- Implementação: consolidar Clipboard, Tela, App ativo, arquivo e connectors; cada origem oferece Ver, Usar/Não usar e Remover quando aplicável.
- Aceite:
  - Nenhum contexto sensível é enviado sem indicação visual e política aplicável.

### Fase 9 — Workspaces Contínuos

#### W01 — Criar contrato persistente de Workspace

- Status: pendente.
- Objetivo: substituir o catálogo read-only por uma entidade persistente, customizável e explicitamente separada de Profile e Workflow.
- Arquivos: `packages/shared/src/workspace.ts`, `packages/shared/src/index.ts`, nova migration em `packages/storage/src/migrations/`, `packages/storage/src/repositories/workspaces.ts`, `packages/agent-runtime/src/api.ts`.
- Contrato mínimo:
  - identidade: `id`, `name`, `icon`, `color`, `purpose`;
  - composição: `profileId`, `quickActions`, `workflowIds`, `connectedSources`;
  - memória: fatos editáveis, notas fixadas e política de retenção;
  - contexto: arquivos, conversas relacionadas, objetivos e fontes vinculadas;
  - UI: `preferredMode` e layout `chat | dashboard | document | kanban | debug`.
- Implementação:
  1. Criar tipos compartilhados sem dependência de React e mapear `HelixArtifact` para um template inicial de Workspace.
  2. Adicionar migration nova e idempotente; não alterar migrations `001-009`.
  3. Criar repository com `create`, `get`, `list`, `update`, `archive` e ordenação por `updatedAt`.
  4. Expor RPCs tipadas e testes de round-trip no banco.
- Edge cases:
  - Renomear ou arquivar um Workspace não pode apagar conversas, memória ou execuções vinculadas.
  - Um Profile removido deve cair para o perfil padrão sem invalidar o Workspace.
  - Templates do catálogo não podem reaparecer duplicados a cada boot.
- Aceite:
  - Um Workspace criado sobrevive ao restart do sidecar.
  - O catálogo legado migra uma única vez e continua utilizável.
  - Testes cobrem criação, atualização, arquivamento e compatibilidade sem alterar migrations antigas.

#### W02 — Criar shell e navegação própria de Workspace

- Status: pendente.
- Objetivo: fazer Espaços abrirem uma superfície contínua, não apenas preencherem o composer global.
- Arquivos: novo diretório `apps/desktop/src/surfaces/workspace/`, `ArtifactsPanel.tsx`, `ExpandedView.tsx`, `NormalCommandView.tsx`, `stores/agent.ts`.
- Implementação:
  1. Transformar a biblioteca atual em lista de Workspaces recentes + templates para criar um novo.
  2. Criar `WorkspaceShell` com resumo, atividade recente, ações rápidas, memória e contexto visíveis.
  3. Preservar `workspaceId` ao alternar normal/expanded e ao abrir uma conversa relacionada.
  4. Suportar layouts declarados sem criar renderers falsos: somente `chat` e `dashboard` entram primeiro; outros mostram fallback honesto.
- Aceite:
  - Abrir um Espaço restaura seu último contexto e sua última atividade.
  - Alternar normal/expanded não perde o Workspace ativo.
  - A UI não chama templates read-only de memória persistente.

#### W03 — Memória e contexto editáveis

- Status: pendente.
- Objetivo: tornar visível e controlável tudo o que o Workspace sabe.
- Arquivos: `packages/shared/src/workspace.ts`, repository de memória, `WorkspaceMemoryPanel.tsx`, `WorkspaceContextPanel.tsx`, inspector do expanded.
- Implementação:
  1. Modelar `MemoryFact` com origem, data, confiança opcional, status `active | archived` e edição manual.
  2. Permitir adicionar, editar, arquivar, remover e promover uma resposta para memória.
  3. Mostrar contexto fixado separado do contexto efêmero da sessão.
  4. Registrar qual memória/contexto entrou em cada execução para auditoria.
- Edge cases:
  - Memória sensível deve poder ser removida definitivamente e não reaparecer por resumo automático.
  - Duplicatas devem ser sugeridas para merge, nunca mescladas silenciosamente.
  - Memória de um Workspace não vaza para outro sem vínculo explícito.
- Aceite:
  - O usuário consegue responder “o que este Espaço sabe?” pela própria UI.
  - Cada execução mostra as fontes de contexto usadas.
  - Limpar memória atualiza storage, runtime e UI sem restart.

#### W04 — Financeiro como Workspace de referência

- Status: pendente.
- Objetivo: provar a arquitetura com um caso contínuo e altamente customizável.
- Superfície: resumo mensal, dívidas, orçamento, compras em análise, objetivos, simulações salvas e decisões recentes.
- Implementação:
  1. Criar schema leve para `Debt`, `BudgetItem`, `PurchaseDecision`, `Goal` e `Scenario`, sem transformar o produto em app bancário.
  2. Permitir entrada manual e por clipboard; importação de arquivo fica condicionada ao pipeline real de anexos.
  3. Reutilizar workflows de fechamento mensal, plano de quitação e análise de compra como rotinas vinculadas.
  4. Tornar premissas, riscos e datas sempre visíveis no renderer.
- Aceite:
  - Dívidas do mês persistem e podem ser atualizadas sem reconstruir o contexto no chat.
  - Simulações registram premissas e não são apresentadas como garantia.
  - O Workspace continua útil sem connector bancário.

### Fase 10 — Follow-up Sessions

> Esta fase permanece integralmente no roadmap. A rodada de ferramentas e correções abaixo não substitui nem descontinua `FUP01-FUP04`.

#### FUP01 — Criar contrato, storage e ciclo de vida

- Status: pendente.
- Objetivo: criar o background real do Helix como sessão explícita, pausável e retomável.
- Arquivos: `packages/shared/src/follow-up.ts`, nova migration, `packages/storage/src/repositories/follow-up-sessions.ts`, `packages/agent-runtime/src/follow-up-runner.ts`, RPC e store desktop.
- Contrato mínimo:
  - `mode`: `vision | debug | writing | research | workflow`;
  - `status`: `active | paused | waiting_approval | completed | failed`;
  - `objective`, `workspaceId`, `memoryScope`, `contextPolicy`;
  - `observations`, `hypotheses`, `nextActions`, timestamps e motivo de encerramento.
- Implementação:
  1. Persistir sessão e eventos como append-only onde a ordem importa.
  2. Implementar `start`, `pause`, `resume`, `stop`, `addObservation` e `complete` com transições validadas.
  3. Garantir uma sessão ativa por escopo de captura; múltiplas sessões de escrita/research podem coexistir se não observarem recursos exclusivos.
  4. Recuperar sessões `active` após crash como `paused`, nunca reativá-las silenciosamente.
- Aceite:
  - Pause/stop interrompem trabalho futuro e sobrevivem ao restart.
  - Estado inválido retorna erro tipado.
  - Nenhuma captura começa somente porque uma sessão foi restaurada.

#### FUP02 — Indicadores e controles sempre visíveis

- Status: pendente.
- Objetivo: impedir que follow-up pareça vigilância invisível.
- Arquivos: `pet.tsx`, `HelixHeader.tsx`, `NormalCommandView.tsx`, `ExpandedView.tsx`, novo `FollowUpBanner.tsx`.
- Implementação:
  1. Pet usa sinal orbital discreto quando há sessão ativa; cor diferencia ativo, pausado e aprovação.
  2. Normal mostra faixa com nome, modo, duração, `Pausar`, `Encerrar` e `Expandir`.
  3. Expanded mostra timeline, contexto observado, hipóteses, ações sugeridas e auditoria de permissões.
  4. Tray/menu bar oferece pausa e encerramento sem abrir o workspace.
- Aceite:
  - Não existe follow-up ativo sem pelo menos um indicador persistente.
  - Pausar/encerrar exige no máximo um clique na janela aberta.
  - Reduced motion preserva estado sem depender de animação.

#### FUP03 — MVP de escrita e debug manual

- Status: pendente.
- Objetivo: validar continuidade antes de automatizar captura de tela.
- Implementação:
  1. Writing mantém objetivo, destinatário, tom, restrições e versões anteriores.
  2. Debug mantém erro inicial, hipóteses, tentativas, evidências e conclusão.
  3. Observações entram manualmente por composer, clipboard ou arquivo explicitamente anexado.
  4. O usuário escolhe se uma conclusão vira memória do Workspace ou permanece na sessão.
- Aceite:
  - Uma sessão pode ser retomada sem repetir o briefing.
  - Hipóteses e evidências são entidades separadas na UI.
  - Encerrar produz resumo e próximos passos sem gravar memória automaticamente.

#### FUP04 — Vision follow-up com permissão e diff

- Status: futuro, condicionado às dependências de permissão e captura nativa.
- Objetivo: observar mudanças visuais dentro de um escopo explícito e revogável.
- Dependências: disclosure de Screen Recording/Accessibility, captura nativa validada, política de retenção, diff visual/OCR e controles FUP02 prontos.
- Implementação:
  1. Mostrar preview exato do escopo antes da primeira captura.
  2. Capturar por ação do usuário ou intervalo configurado; default seguro é manual/pausado.
  3. Persistir metadados e observações derivadas; imagem bruta segue retenção explícita e pode ser descartada imediatamente.
  4. Comparar observações e só notificar mudança relevante segundo o objetivo da sessão.
- Aceite:
  - O usuário vê quando, o que e por que a tela foi capturada.
  - Revogar permissão pausa a sessão e remove acesso imediatamente.
  - Nenhuma captura ocorre após pause, stop, crash ou restore.

## Nova Rodada — Consolidação E Capacidades Nativas

> Esta rodada é cumulativa. Nenhuma fase, decisão, hipótese ou critério anterior é removido. Workspaces (`W01-W04`) e Follow-up Sessions (`FUP01-FUP04`) continuam ativos no roadmap, mesmo quando não forem a próxima entrega.

### Definições Novas

- **File Context:** arquivo ou pasta escolhido explicitamente pelo usuário, visível antes do envio e persistido como bloco de contexto do turn.
- **Document Parser:** parser determinístico local para PDF, CSV, Excel ou Markdown; extrai estrutura antes de qualquer interpretação por LLM.
- **Native Vision:** capacidades on-device do Vision Framework da Apple para reconhecimento de texto, classificação, códigos e saliência; não significa provider multimodal em nuvem.
- **Developer Tool:** ferramenta local auditável para Git, shell ou patch, sempre limitada a um diretório autorizado e sujeita à política de permissão.
- **Desktop Context:** sinal nativo explícito do macOS, como app/janela ativa, informações seguras do sistema ou notificação.
- **Mermaid Artifact:** bloco Mermaid validado e renderizável, com fallback de código quando a renderização falhar.
- **Workspace Memory:** fatos e notas persistentes vinculados a um Workspace; memória global transversal permanece futura.

### Prioridade Vigente

1. Fechar pendências parciais do redesign: bug de Settings, `PR03`, `PR04`, `A02`, `R01`, `C01` e `D03`.
2. Aplicar o design system às páginas internas antes de movê-las para Settings.
3. Mover Profiles, Workflows e Skills para Settings sem apagar seus contratos, dados ou fluxos de execução.
4. Adicionar contexto seguro de arquivos/pastas e parsers locais de documentos.
5. Adicionar Mermaid validado e renderizado no chat.
6. Migrar a implementação de OCR para Vision Framework nativo, preservando a capacidade de OCR e ampliando-a com classificação, barcode e saliência.
7. Implementar memória por Workspace em alinhamento com `W03`.
8. Adicionar ferramentas de desenvolvimento e contexto nativo do desktop.
9. Continuar `W01-W04` e `FUP01-FUP04` conforme dependências e capacidade de entrega.

### Fase 11 — Fechamento Das Pendências Parciais

#### CL01 — Corrigir interação de Settings no expanded

- Status: concluído — Settings expandido ocupa somente o workspace e a troca de destino pela sidebar fecha o painel.
- Objetivo: manter a navegação principal clicável quando Settings estiver aberto no modo expanded.
- Implementação:
  1. Isolar o overlay de `SettingsPanel` ao workspace de conteúdo, sem cobrir `HelixSidebar`.
  2. Revisar `z-index`, stacking contexts e `pointer-events`.
  3. Garantir que trocar de destino pela sidebar feche Settings e abra a superfície escolhida.
- Aceite:
  - Nova conversa, Histórico, Espaços e Conectores respondem a um clique com Settings aberto.
  - A navegação interna de Settings continua clicável e rolável.

#### CL02 — Concluir Profile snapshot (`PR03`)

- Status: concluído — `profileId` é persistido por conversa/turn e restaurado do histórico antes de novas execuções.
- Objetivo: impedir que a troca de profile altere uma conversa já iniciada.
- Implementação: persistir `profileId` na Conversation ou no primeiro turn e fazer o runtime usar esse snapshot durante todo o histórico relacionado.
- Aceite:
  - Nova conversa usa o profile ativo no início.
  - Trocar o profile só afeta novas conversas.

#### CL03 — Concluir clipboard estruturado (`PR04`)

- Status: concluído — clipboard e paste manual viram blocos `context`, permanecem visíveis, persistem no histórico e são restaurados na regeneração.
- Objetivo: persistir clipboard como contexto explícito do turn `user`.
- Implementação: remover o `inputMode` legado do fluxo principal e persistir blocos `text` + `context` com origem, preview e política de uso.
- Aceite:
  - Regeneração e histórico preservam o contexto de clipboard original.
  - Clipboard nunca é enviado sem indicação visual.

#### CL04 — Concluir radial, resultado e Context Bar (`A02`, `R01`, `C01`)

- Status: parcialmente concluído — `A02` e `R01` concluídos; `C01` depende da integração real de Tela, App ativo, Arquivo e Connector.
- Objetivo: concluir a segunda órbita, o resultado compacto e o contexto orientado a permissões como uma experiência coerente.
- Implementação:
  1. Segunda órbita para Clipboard, Tela, Workflow e Espaços.
  2. `CompactResultCard` no modo normal com Copiar, Refinar e Expandir.
  3. Context Bar para Clipboard, Tela, App ativo, Arquivo e Connectors com Ver, Usar/Não usar e Remover.
- Aceite:
  - Nenhuma ação sensível executa automaticamente ao ser selecionada no radial.
  - Resultado curto não força a abertura do modo expanded.
  - Toda fonte enviada permanece visível e removível.

#### CL05 — Design system e reorganização de Settings (`D03`)

- Status: concluído em 2026-07-12 (`515cada`), complementa `D03`.
- Objetivo: padronizar páginas internas antes de consolidá-las em Settings.
- Implementação:
  1. Aplicar componentes e tokens em Profiles/Prompts, Workflows, Skills e Connectors.
  2. Mover Profiles, Workflows e Skills para seções funcionais de Settings.
  3. Preservar seleção contextual de Profile e acionamento de Workflow/Skill no composer, Workspace e runtime.
  4. Manter a navegação principal em Nova conversa, Histórico, Espaços, Conectores e Config.
- Aceite:
  - Nenhuma entidade ou dado legado é apagado durante a mudança de localização.
  - CRUD e ativação continuam funcionando ponta a ponta.
- Evidência:
  - Profiles/Prompts, Workflows e Skills usam seus painéis funcionais dentro de Settings, sem duplicar estado ou CRUD.
  - A ação contextual de Workflow abre diretamente a seção `workflows`; a navegação principal não expõe mais modos internos legados.
  - Footer global não conflita com seções que possuem persistência própria.

### Fase 12 — Arquivos, Pastas E Parsers

#### FILE01 — Contexto seguro de arquivos e pastas

- Status: concluído em 2026-07-12 (`515cada`, `cf460e6`).
- Objetivo: permitir leitura e escrita de arquivos dentro de escopo escolhido pelo usuário.
- Implementação:
  1. Selecionar arquivo/pasta via diálogo nativo e aceitar drag-and-drop.
  2. Listar pasta e ler arquivo com limites de tamanho, encoding e exclusões explícitas.
  3. Persistir anexos como blocos de contexto e mostrar preview antes do envio.
  4. Escrever ou criar arquivo somente após aprovação `local.write`.
- Edge cases:
  - Symlinks, arquivos binários, pacotes macOS, paths fora do escopo e arquivos grandes devem ser tratados sem leitura implícita.
  - Segredos detectáveis recebem aviso e podem ser removidos antes do envio.
- Aceite:
  - Arquivo/pasta anexado permanece visível, removível e auditável.
  - Nenhuma escrita acontece fora do diretório autorizado.
- Entregue:
  - Diálogo nativo para arquivo e pasta, drag-and-drop, chips removíveis, preview, deduplicação por path canônico e persistência em blocos de contexto.
  - Travessia de pasta limitada a 5 níveis/25 arquivos, limite agregado de 10 MB, exclusão de symlinks, pacotes `.app`, `.git`, `node_modules`, `dist` e `target`.
  - Paths sensíveis conhecidos são bloqueados; conteúdo com indícios de segredo produz aviso removível antes do envio.
  - Contexto textual e parseado atravessa `startRun`, planejamento, execução e histórico; falhas de leitura/parser chegam ao toast.
  - A tool `desktop.file.write` só escreve em raízes explicitamente escolhidas, revalida o parent canônico e sempre passa pela aprovação `local.write`.
  - Testes automatizados comprovam escrita dentro da raiz e rejeição de paths fora do escopo autorizado.

#### FILE02 — Parsers locais de documentos

- Status: concluído em 2026-07-12 — parsing local, normalização XLSX, storage do Parser e indexação Markdown entregues.
- Objetivo: interpretar PDF, CSV, Excel e Markdown de forma determinística antes do LLM.
- Implementação:
  1. PDF com texto por página, metadados e indicação de páginas sem camada textual.
  2. CSV/Excel como tabelas estruturadas com headers, tipos inferidos e limites de linhas/colunas.
  3. Markdown com frontmatter, títulos, links e blocos de código preservados.
  4. Indexação opt-in de uma pasta Markdown como fonte de Workspace.
- Aceite:
  - Preview informa formato, tamanho, páginas/abas e truncamento.
  - Parser falho retorna erro claro e nunca inventa conteúdo.
- Entregue:
  - Pacote `@desktop-agent/lite-parse` para PDF, CSV, XLSX, DOCX, PPTX, imagens e Markdown, com limites determinísticos de preview/conteúdo.
  - CSV suporta campos quoted, vírgulas escapadas e conteúdo multilinha; Markdown extrai frontmatter, títulos, links e blocos de código.
  - PDF registra páginas, páginas sem camada textual, necessidade de OCR e truncamento; falhas retornam erro estruturado com fallback seguro.
  - O módulo nativo LiteParse é carregado de forma lazy e empacotado em `Contents/Resources`, sem bloquear o bootstrap do sidecar compilado.
  - O addon nativo roda em worker isolado do próprio sidecar, com ambiente mínimo e timeout de 20 segundos; falha ou deadlock do LiteParse não bloqueia o RPC principal.
  - PDFs com camada textual não acionam OCR desnecessário; páginas sem texto permanecem sinalizadas para um fluxo explícito de OCR.
  - Anexos já parseados atravessam o chat como contexto estruturado sem uma segunda extração nem cópia integral no composer.
  - Tela dedicada de Parser disponível nos modos normal e expanded, com drag-and-drop/seletor nativo, fila de arquivos, estados de erro, preview Markdown/texto bruto, metadados, cópia, download e envio estruturado ao chat.
  - Storage persistente de documentos parseados com identidade estável, deduplicação por path, restauração após reload, rename de nome de exibição e deleção confirmada pelo runtime.
  - Ação "Organizar com IA" envia o documento já estruturado ao chat com instrução explícita para melhorar formatação sem alterar fatos.
  - Seletor nativo aceita PDF, CSV, XLS/XLSX, Markdown, DOCX, PPTX e imagens suportadas; o fallback do navegador permanece seguro para formatos textuais.
  - XLSX é normalizado por aba em tabelas Markdown, com headers estáveis, tipos inferidos por coluna e limites de 1.000 linhas/50 colunas por aba.
  - Pastas Markdown podem ser indexadas de forma opt-in, persistem como fontes, reindexam até 100 arquivos em profundidade 5 e removem entradas que deixaram de existir.
  - "Organizar com IA" edita diretamente após confirmação: Markdown/CSV usam escrita atômica no original; formatos binários preservam a origem e geram um arquivo irmão `.organized.md`.
  - Cobertura automatizada dos edge cases de CSV e da estrutura Markdown.

### Fase 13 — Mermaid Confiável

#### MER01 — Renderizador Mermaid no chat

- Status: pendente.
- Objetivo: renderizar blocos `mermaid` no Markdown sem comprometer segurança ou legibilidade.
- Implementação: renderização isolada, tema Helix, zoom/cópia e fallback para código com erro de parse.
- Aceite:
  - Markdown comum continua funcionando.
  - Diagrama inválido não quebra a resposta inteira.

#### MER02 — Tool de geração e validação

- Status: pendente.
- Objetivo: gerar Mermaid sintaticamente válido a partir de uma descrição.
- Implementação: tool `mermaid.generate` com tipo de diagrama, validação antes do retorno, retries limitados e erro estruturado.
- Aceite:
  - A tool retorna Mermaid validado ou erro explícito; nunca marca conteúdo inválido como sucesso.

### Fase 14 — Vision Framework Nativo

#### VIS01 — Ponte nativa do Vision Framework

- Status: pendente.
- Objetivo: migrar OCR para APIs nativas da Apple e ampliar análise visual on-device.
- Implementação:
  1. `vision.text` com `VNRecognizeTextRequest`.
  2. `vision.classify` com `VNClassifyImageRequest`.
  3. `vision.barcode` com `VNDetectBarcodesRequest`.
  4. `vision.saliency` com `VNGenerateAttentionBasedSaliencyImageRequest`.
  5. Entrada por imagem local, screenshot ou região selecionada.
- Decisões:
  - Vision Framework substitui tesseract/OCR.space como implementação de OCR, mas a capacidade funcional de OCR permanece.
  - Provider multimodal em nuvem fica futuro; esta fase é on-device.
- Aceite:
  - Captura exige disclosure e permissão antes da execução.
  - Resultados incluem confiança, bounding boxes quando disponíveis e erros tipados.
  - Nenhuma imagem é enviada à rede por esta feature.

### Fase 15 — Ferramentas De Desenvolvimento

#### DEV01 — Git, shell e patch auditáveis

- Status: pendente.
- Objetivo: permitir que o agente trabalhe em projetos locais dentro de um escopo autorizado.
- Implementação:
  1. Tools `git.status`, `git.diff` e `git.log` com permissão `local.read`.
  2. `shell.exec` com cwd explícito, timeout, limite de saída e aprovação.
  3. `file.patch` com preview do diff, escrita atômica e rollback quando aplicável.
  4. Auditoria de comando, argumentos, diretório, duração e resultado.
- Edge cases:
  - Bloquear mudança implícita de diretório, escaping do workspace autorizado e comandos interativos sem suporte.
  - Operações destrutivas nunca são autoaprovadas.
- Aceite:
  - Cada mutação mostra o que será alterado antes da aprovação.
  - Falha parcial não deixa arquivo truncado.

### Fase 16 — Contexto Nativo Do Desktop

#### DESK01 — App ativo, notificações e sistema

- Status: pendente.
- Objetivo: fornecer contexto útil do macOS sem vigilância invisível.
- Implementação:
  1. `desktop.app` para app e janela ativos, com disclosure de Accessibility.
  2. `desktop.notify` para conclusão, erro ou aprovação pendente de tarefas longas.
  3. `desktop.system` para versão do macOS, locale, displays, horário e dados não sensíveis.
  4. Integrar app ativo à Context Bar como contexto opt-in e removível.
- Aceite:
  - App ativo não é coletado nem persistido sem consentimento.
  - Notificações são configuráveis e não expõem conteúdo sensível por padrão.
  - Revogar permissão remove acesso imediatamente.

## Fora Da Rodada Visual Atual

> Esta lista continua válida para a rodada visual original. Itens promovidos para a nova rodada permanecem fora do redesign visual, mas agora possuem fases técnicas próprias; isso não representa remoção nem descontinuação.

- Skills customizadas.
- Profiles avançados (voz, idioma e modelos preferenciais).
- Anexos de arquivo — promovidos para `FILE01-FILE02` na rodada técnica.
- Voz/áudio.
- Novas ferramentas de runtime/backend — promovidas parcialmente para `MER02`, `VIS01`, `DEV01` e `DESK01`.
- Captura contínua de tela antes de FUP01-FUP03, disclosure e validação nativa.
- Automação silenciosa ou reativação automática de qualquer Follow-up Session.

## Ordem Recomendada De Commits (atualizada)

1. `feat: refine Helix identity, pet and command palette` — concluído.
2. `docs: define continuous workspaces and follow-up backlog` — concluído.
3. `fix: keep expanded navigation interactive with settings open (CL01)`.
4. `feat: snapshot conversation profiles and persist clipboard context (CL02-CL03 / PR03-PR04)`.
5. `feat: compact result, permission context and radial second orbit (CL04 / R01-C01-A02)`.
6. `refactor: apply design system and consolidate settings sections (CL05 / D03)`.
7. `feat: add scoped file context and deterministic document parsers (FILE01-FILE02)`.
8. `feat: render and validate Mermaid diagrams (MER01-MER02)`.
9. `feat: add on-device Apple Vision Framework tools (VIS01)`.
10. `feat: add audited git shell and patch tools (DEV01)`.
11. `feat: expose consent-driven native desktop context (DESK01)`.
12. `feat: persist workspace domain and migrate artifact templates (W01)`.
13. `feat: add continuous workspace shell (W02)`.
14. `feat: expose editable workspace memory and context (W03)`.
15. `feat: ship finance reference workspace (W04)`.
16. `feat: persist follow-up session lifecycle (FUP01)`.
17. `feat: add visible follow-up controls and timeline (FUP02)`.
18. `feat: add writing and debug follow-up modes (FUP03)`.
19. `feat: add consent-driven vision follow-up (FUP04)`.

## Critérios Gerais de Aceite do Redesign

- Não há mais botões repetidos no header.
- A marca Helix é legível em `20px` e no pet collapsed, sem depender de glow.
- Pet está alinhado e comunica status por cor/animação, com fallback estático em reduced motion.
- Command palette prioriza composer, contexto e as seis intenções do Action Registry.
- Navegação lateral/drawer prioriza Nova conversa, Histórico, Espaços, Conectores e Config.
- Profiles, Workflows e Skills aparecem no contexto certo sem competir como produtos equivalentes.
- Pet collapsed substituiu o modo mini e oferece menu rápido.
- Páginas Config, Prompts/Profiles e Connectors usam tokens e componentes reutilizáveis.
- Profile ativo aplica system prompt sem afetar conversas já abertas.
- Clipboard é enviado como bloco explícito do turn `user`.
- Resultado curto é exibido como card compacto no modo normal (Copiar/Refinar/Expandir).
- `bun run typecheck` e `bun run lint` passam em todas as fases.
- Screenshots comparativas antes/depois documentam cada modo (normal, expandido, pet collapsed).
- Workspaces e Follow-up só podem ser marcados como concluídos depois de validação de storage, restart, permissões e controles ponta a ponta.

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
5. Navegar para Histórico, Espaços, Conectores e Config via sidebar/drawer.
6. Abrir Workflow pela command palette e trocar Profile dentro de uma conversa.
7. Validar a marca em `20px`, `48px` e `58px`, com reduced motion e estados de execução.

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
