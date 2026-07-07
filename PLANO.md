# Plano Helix

> Fonte principal do produto. `BACKLOG.md` fica como histórico/status resumido.
> Última atualização: 2026-07-07.
> Foco atual: UI/UX redesign, system design e evolução de Profiles.

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
| Janela        | Collapsed `104x104`, Normal `520x820`, Expanded até `1180x820`                                              |
| Produto       | Copilot macOS leve, keyboard-first, com pet launcher, home minimalista, navegação lateral e permissões explícitas |

## Estado Auditado Do Worktree

### Implementado

- Atalho global já usa `Control+Shift+Space` no host Tauri.
- Chat multi-turn com `Turn[]`, persistência de conversas, streaming cancellation e MarkdownRenderer.
- Pinstripes é provider principal com `ps/warp`, `ps/thinking` e `ps/pro`.
- MCPs, web search, OCR, prompt library e agent profiles básicos estão funcionais.
- `alwaysOnTop` e `lastWindowMode` persistem entre sessões.
- Migrations versionadas de storage estão em produção.
- Superfície Helix extraída em `apps/desktop/src/surfaces/helix/`.

### Problemas Visuais Identificados

- Header com muitos botões repetidos: "Configurar" textual, ícone de settings, tabs (Perguntar/Histórico/Prompts/Conectores), minimizar/fechar, expandir e barra de progresso.
- Pet dot no header desalinhado; bolinha de status sem função clara.
- Home page lotada: cards de modo (Simples/Workflow), seção MCPs, input mode (Clipboard/Conteúdo avulso), preview de clipboard, grid de ações livres e de clipboard.
- Páginas Config, Prompts e Connectores ainda não usam componentes/tokens consistentes.
- Modo mini da janela principal (`392x460`) compete com o pet collapsed como launcher rápido.

### Planejado (Redesign)

- Home page minimalista: título/pet, composer, chips de sugestão contextual, clipboard preview colapsável.
- Header/top bar unificada: pet mini + título + pin + expandir/minimizar/fechar.
- Navegação lateral fixa no expandido, drawer overlay no normal: Nova conversa, Histórico, Perfis, Conectores, Config.
- Pet collapsed vira launcher (substitui modo mini): 1 clique menu rápido, 2 cliques modo normal.
- Profiles evoluem de Prompts: system prompt evoluído + metadados (nome, descrição, ícone).
- Design system mínimo: `Button`, `IconButton`, `Input`, `Card`, `Badge`, `Separator`, `HelixShell`.
- Aplicar tokens/componentes em Config, Prompts/Profiles e Connectors.

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
- Migrations existentes (`002_turns`, `003_settings_v2`, `004_mcp_env`, `006_prompt_library`) permanecem.
- Se campos novos forem necessários para Profiles evoluídos, adicionar migration `007_profiles_enhanced` sem alterar migrations anteriores.

### Chat Core

- `messages: Turn[]` é a fonte de verdade; `result` deve ser removido nesta fase de redesign se ainda existir.
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

## Backlog Refinado

Cada task abaixo deve ser tratada como uma unidade de entrega commitável.

### Fase 1 — Home Page Minimalista

#### H01 — Limpar a home vazia

- Status: planejado.
- Objetivo: remover informação repetida e deixar a tela inicial focada no composer, como produtos de referência (ChatGPT, Claude, Grok).
- Arquivos: `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`, `apps/desktop/src/surfaces/helix/index.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. Remover do header interno: "Modelo ativo" com barra de progresso, tabs (Perguntar/Histórico/Prompts/Conectores), botão "Configurar" textual e botão settings duplicado.
  2. Remover da home: cards de modo (Simples/Workflow), seção MCPs, cards de input mode (Clipboard/Conteúdo avulso) e grid de ações livres/clipboard.
  3. Manter na home vazia: pet mini + título "Helix", composer, linha horizontal de 4-6 chips de sugestão contextual, clipboard preview colapsável.
- Aceite:
  - Home vazia não mostra tabs, cards de modo, seção MCPs, input mode cards nem grid de ações.
  - `bun run typecheck` e `bun run lint` passam.

#### H02 — Reposicionar o composer

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
- Objetivo: mover navegação secundária para fora do header.
- Arquivos: `apps/desktop/src/components/ui/helix-sidebar.tsx`, `apps/desktop/src/components/ui/helix-drawer.tsx`, `apps/desktop/src/surfaces/helix/ExpandedView.tsx`, `apps/desktop/src/surfaces/helix/NormalCommandView.tsx`.
- Implementação:
  1. Criar `HelixSidebar` fixa no modo expandido (largura `200px`).
  2. Criar `HelixDrawer` overlay no modo normal.
  3. Itens: Nova conversa, Histórico, Perfis, Conectores, Config.
  4. Cada item aciona `setMode` ou abre settings.
- Aceite:
  - Sidebar fixa funciona no expandido; drawer funciona no normal.
  - Navegação não usa mais tabs no header.

### Fase 3 — Design System e Componentes Reutilizáveis

#### D01 — Tokens de design

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
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

- Status: planejado.
- Objetivo: o system prompt do profile influenciar as respostas.
- Arquivos: `packages/agent-runtime/src/orchestrator.ts`, `packages/agent-runtime/src/workflow-runner.ts`, `apps/desktop/src/stores/agent.ts`.
- Implementação:
  1. Carregar profile ativo no início da conversa.
  2. Injetar `systemPrompt` como turn `system` ou prepend na primeira mensagem `user`.
  3. Respeitar `tone`, `responseStyle` e `constraints` no prompt de sistema.
- Aceite:
  - Iniciar conversa com profile ativo aplica o system prompt.
  - Troca de profile reflete em novas conversas, não em conversas passadas.

#### PR04 — Unificar clipboard ao chat normal

- Status: planejado.
- Objetivo: eliminar o modo de input "clipboard" como estado separado e tornar o fluxo mais natural.
- Arquivos: `apps/desktop/src/surfaces/helix/index.tsx`, `apps/desktop/src/surfaces/helix/hooks/useExecute.ts`, `apps/desktop/src/surfaces/helix/ContextChipBar.tsx`, `apps/desktop/src/surfaces/helix/Composer.tsx`.
- Implementação:
  1. Remover `inputMode` do fluxo principal; substituir por "usar clipboard" via chips/preview.
  2. Clicar em chip de contexto insere o conteúdo do clipboard no composer como bloco de contexto editável.
  3. Enviar a mensagem cria um turn `user` normal com o clipboard anexado.
  4. Manter preview colapsável do clipboard junto ao composer.
- Aceite:
  - Não há mais estado "Conteúdo avulso" vs "Clipboard".
  - Chip de contexto insere clipboard no composer e envia como turn normal.
  - Preview colapsável reflete o clipboard atual.

## Fora do Escopo

- Memória persistente entre conversas.
- Skills customizadas.
- Profiles avançados (ferramentas por profile, voz, idioma, modelos preferenciais).
- Anexos de arquivo.
- Voz/áudio.
- Novas ferramentas de runtime/backend.
- Redesign estrutural das páginas Config, Prompts/Profiles e Connectors (apenas tokens/componentes reutilizáveis).

## Ordem Recomendada De Commits

1. `docs: update plan with ui/ux redesign backlog`
2. `feat: helix home page minimalista`
3. `feat: helix unified header and pet redesign`
4. `feat: helix sidebar/drawer navigation`
5. `feat: replace mini window with pet collapsed launcher`
6. `feat: helix design system components`
7. `feat: apply design system to config, prompts and connectors`
8. `feat: evolve profiles and unify clipboard with chat`

## Critérios Gerais de Aceite do Redesign

- Não há mais botões repetidos no header.
- Pet está alinhado e comunica status por cor/animação.
- Home page é minimalista: título/pet, composer, chips, clipboard colapsável.
- Navegação lateral/drawer acessa Histórico, Perfis, Conectores, Config.
- Pet collapsed substituiu o modo mini e oferece menu rápido.
- Páginas Config, Prompts/Profiles e Connectors usam tokens e componentes reutilizáveis.
- `bun run typecheck` e `bun run lint` passam em todas as fases.
- Screenshots comparativas antes/depois documentam cada modo (normal, expandido, pet collapsed).

## Verificação

```bash
bun run lint
bun run typecheck
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
