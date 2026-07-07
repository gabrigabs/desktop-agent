# Plano Helix

> Fonte principal do produto. `BACKLOG.md` fica como histórico/status resumido.
> Última atualização: 2026-07-07.

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
| Janela        | Collapsed `104x104`, Mini `392x460`, Normal `520x820`, Expanded até `1180x820`                            |
| Produto       | Copilot macOS leve, keyboard-first, com pet discreto, composer sempre visível e permissões explícitas     |

## Estado Auditado Do Worktree

### Implementado

- Atalho global já usa `Control+Shift+Space` no host Tauri.
- A UI já tem modos `collapsed`, `mini`, `normal` e `expanded`.
- A Command Palette já oferece ações livres e ações sobre clipboard, em vez de depender só de rewrite/summarize/translate.
- Pinstripes já aparece como provider principal na UI, com modelos `ps/warp`, `ps/thinking` e `ps/pro`.
- MCPs, web tools e OCR já existem como base de runtime/tooling, mas ainda precisam de UX e contratos mais claros.

### Parcialmente Implementado

- O app ainda mistura a identidade `Desktop Agent` com a direção `Helix`.
- A janela normal estava divergente entre plano/código; a meta oficial é `520x820`.
- `alwaysOnTop` existia como estado local de UI, mas precisava ser persistido e reaplicado após resize.
- O storage tinha tabelas criadas por `CREATE TABLE IF NOT EXISTS`, mas sem versionamento explícito de migrations.
- A superfície principal já foi extraída para `surfaces/helix/`; o alias `CommandPalette` foi removido.

### Planejado

- Chat multi-turn com `Turn[]` e `MessageBlock[]`, mantendo conversa atual vazia ao abrir o app e salvando turns finalizadas localmente.
- Component split da superfície Helix antes de novas features pesadas.
- Error boundary, loading states e cleanup de sidecar.
- Pet como launcher/status; header deve usar dot+glow legível, não SVG microscópico.
- Permissions UX para tela, arquivos, rede, Accessibility e qualquer ação que escreva/controla o sistema.

### Hipóteses A Validar

- Helical timeline, motion orbital avançada e scroll não-linear ficam fora da primeira fatia; precisam de protótipo de usabilidade.
- Gemini não deve aparecer como opção funcional até o formato de API/stream ser testado.
- Prompt library complexa, file attachments, workflow LLM-only e agent profiles entram após o chat core estar estável.

## Decisões De Produto

- Helix é um copilot de desktop, não uma landing page nem um terminal de debug.
- A primeira tela deve funcionar sem clipboard: o usuário pode perguntar livremente, escolher uma ação ou trabalhar sobre contexto detectado.
- Clipboard é contexto opcional. Quando usado, a UI deve deixar claro que a ação depende dele.
- Pinstripes é o caminho feliz. OpenAI-compatible fica como opção avançada.
- `Option+Space` não deve ser padrão, porque Raycast e ChatGPT Desktop ocupam esse espaço mental do macOS.
- Qualquer integração com app ativo ou controle do Mac deve explicar permissões antes de pedir acesso.

## Decisões Técnicas

### Settings E Janela

- `UiMode` oficial: `collapsed | mini | normal | expanded`.
- Tamanhos oficiais:
  - `collapsed`: `104x104`
  - `mini`: `392x460`
  - `normal`: `520x820`
  - `expanded`: até `1180x820`, centralizado e limitado pela work area.
- `AppSettings` deve incluir `alwaysOnTop` e `lastWindowMode`.
- `setWindowMode()` deve reaplicar `alwaysOnTop` depois de redimensionar.
- Ao abrir, o app restaura `lastWindowMode`; se `hidePet` estiver ativo e o modo salvo for `collapsed`, abre em `normal`.

### Storage

- `001_initial.ts` fica preservado como migration inicial.
- O runner oficial de migrations usa `_migrations(version, applied_at)`.
- Novas migrations:
  - `002_turns`: cria `conversations` e `turns`.
  - `003_settings_v2`: cria defaults `alwaysOnTop=false` e `lastWindowMode=normal`.
  - `004_mcp_env`: garante `env_json` em `mcp_servers`, com guarda para bancos onde a coluna já existe.

### Chat Core

- O estado final deve substituir `result: string | null` por `messages: Turn[]`.
- Streaming modifica a última turn em andamento; turns completas são imutáveis.
- Context window usa sliding window dos últimos N turns, default 10.
- O app abre com conversa vazia, mas turns finalizadas ficam no SQLite para histórico/export.
- P1 (Identidade E Superfície) e P2 (Chat Multi-turn) foram unificados em CP3, entregando pet dot, turn model, ChatView, Composer, MarkdownRenderer, persistência, ações e cancellation numa única fase.
- MarkdownRenderer usa `react-markdown` + `remark-gfm` para renderizar respostas do assistant com code blocks, links, tabelas, listas e blockquotes.
- `result` ainda existe como compat sincronizado, mas será removido após ChatView estar estável em CP4.

### Providers

- Pinstripes:
  - `ps/warp`: rápido e melhor custo.
  - `ps/thinking`: raciocínio mais profundo.
  - `ps/pro`: respostas mais deliberadas.
- Mock continua para testes locais.
- OpenAI-compatible continua como escape hatch.
- Gemini fica bloqueado até validação real de `/models`, streaming, erros e formato de reasoning.

## Backlog Refinado

Cada task abaixo deve ser tratada como uma unidade de entrega commitável. O campo "Status" é do worktree auditado em 2026-07-06.

### P0 - Fundação De Release

#### B01 - Persistir `alwaysOnTop` e `lastWindowMode`

- Status: implementado no worktree atual, pendente de teste manual no app empacotado.
- Objetivo: o pin visual e o último modo de janela devem sobreviver a resize, troca de modo e restart.
- Arquivos: `packages/shared/src/types/rpc.ts`, `packages/agent-runtime/src/api.ts`, `apps/desktop/src/stores/agent.ts`, `apps/desktop/src/app.tsx`, `apps/desktop/src/lib/window.ts`.
- Implementação:
  1. Estender `AppSettings` com `alwaysOnTop: boolean` e `lastWindowMode: WindowMode`.
  2. Carregar defaults no runtime quando settings ainda não existirem.
  3. Salvar os dois campos em `saveSettings()`.
  4. No frontend, remover estado local de pin e usar `settings.alwaysOnTop` como fonte de verdade.
  5. Em toda chamada a `setWindowMode()`, reaplicar `setAlwaysOnTop()`.
  6. No mount, restaurar `lastWindowMode`; se `hidePet=true` e o modo salvo for `collapsed`, abrir em `normal`.
- Edge cases:
  - Se o sidecar ainda não carregou settings, não restaurar modo prematuramente.
  - Se persistência falhar, atualizar UI localmente e logar erro sem travar.
  - Tray click deve forçar `normal` e atualizar o store.
- Aceite:
  - Ativar pin, alternar `normal -> mini -> expanded -> collapsed -> normal` e o app continua no topo.
  - Fechar e abrir app preserva pin e último modo não colapsado.
  - `hidePet=true` não reabre em janela invisível.
- Verificação:
  - `bun run typecheck`
  - teste manual em Tauri dev/build.

#### B02 - Sincronizar tamanho normal `520x820`

- Status: implementado no worktree atual.
- Objetivo: eliminar divergência entre Rust, JS e config Tauri.
- Arquivos: `apps/desktop/src/lib/window.ts`, `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/tauri.conf.json`.
- Implementação:
  1. Ajustar `WINDOW_SIZES.normal` para `520x820`.
  2. Ajustar `NORMAL_WIDTH` e `NORMAL_HEIGHT` no Rust.
  3. Ajustar `app.windows[0].width/height` no Tauri config.
  4. Garantir que o tray click usa as mesmas constantes Rust.
- Aceite:
  - App inicia em `520x820`.
  - Tray mostra/foca em `520x820`.
  - Expanded continua limitado pela work area.
- Verificação:
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - teste manual de shortcut e tray.

#### B03 - Versionar migrations de storage

- Status: implementado no worktree atual.
- Objetivo: permitir evolução incremental de SQLite sem depender só de `CREATE TABLE IF NOT EXISTS`.
- Arquivos: `packages/storage/src/migrations/index.ts`, `002_turns.ts`, `003_settings_v2.ts`, `004_mcp_env.ts`, `packages/storage/src/index.ts`, `packages/storage/src/__tests__/storage.test.ts`.
- Implementação:
  1. Criar tabela `_migrations(version, applied_at)`.
  2. Encapsular `applyMigration(db, version, fn)`.
  3. Rodar `001_initial` como versão 1 sem alterar seu corpo.
  4. Adicionar `002_turns` com `conversations` e `turns`.
  5. Adicionar `003_settings_v2` com defaults de janela.
  6. Adicionar `004_mcp_env` com `PRAGMA table_info` antes de `ALTER TABLE`, porque `env_json` já pode existir.
  7. Atualizar exports para usar o runner versionado.
- Edge cases:
  - Banco novo deve aplicar `1,2,3,4`.
  - Banco antigo com `mcp_servers.env_json` não pode falhar.
  - Reexecutar migrations não pode duplicar versões nem colunas.
- Aceite:
  - Teste de storage confirma `_migrations`, `conversations`, `turns`, settings defaults e presets MCP.
- Verificação:
  - `bun test packages/storage/src/__tests__/storage.test.ts`

#### B04 - Limpeza Tauri e segurança mínima

- Status: parcialmente implementado.
- Objetivo: remover configs inseguras ou inválidas antes de release local.
- Arquivos: `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/capabilities/default.json`, `apps/desktop/src-tauri/src/sidecar/mod.rs`, `apps/desktop/src/lib/rpc.ts`.
- Implementação:
  1. Trocar `$schema` para `https://schema.tauri.app/config/2`.
  2. Trocar `csp: null` por CSP explícita com `self`, inline style, image/font data.
  3. Confirmar permissões de janela necessárias para `hide`, `show`, `setSize`, `setPosition`, `setFocus`, `setAlwaysOnTop`, `startDragging` e `unmaximize`.
  4. Auditar `shell:allow-execute/spawn` com `args: true`; se o sidecar não precisa argumentos dinâmicos, restringir para `false` ou lista vazia.
  5. Remover `src-tauri/src/sidecar/mod.rs` se confirmado que não é chamado fora de `mod sidecar;`.
- Aceite:
  - `cargo check` passa.
  - App continua conseguindo mover, redimensionar, focar e ocultar janela.
  - Nenhum shell scope amplo fica sem justificativa no plano.
- Verificação:
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - revisão de `capabilities/default.json`.

#### B05 - Encerrar sidecar no unload

- Status: implementado no worktree atual.
- Objetivo: evitar processo Bun órfão quando a janela fecha.
- Arquivos: `apps/desktop/src/lib/rpc.ts`.
- Implementação:
  1. Registrar um único `beforeunload` após spawn do sidecar.
  2. Chamar `destroyRpc()` nesse handler.
  3. Remover listener dentro de `destroyRpc()`.
  4. Matar `child` com `child.kill().catch(...)`.
- Edge cases:
  - `restartRpc()` não deve acumular listeners.
  - `destroyRpc()` deve ser idempotente.
- Aceite:
  - Fechar app não deixa `agent-runtime` em `ps`.
  - Restart runtime continua funcionando.
- Verificação:
  - `bun run build:sidecar`
  - teste manual com `ps aux | grep agent-runtime`.

#### B06 - Error Boundary da UI

- Status: implementado no worktree atual.
- Objetivo: impedir tela branca total quando a superfície React quebra.
- Arquivos: `apps/desktop/src/components/ui/error-boundary.tsx`, `apps/desktop/src/app.tsx`.
- Implementação:
  1. Criar class component `ErrorBoundary`.
  2. Logar erro via `componentDidCatch`.
  3. Renderizar fallback PT-BR com botão "Reiniciar interface".
  4. Envolver `Helix` no boundary.
- Aceite:
  - Exceção em componente filho mostra fallback, não tela branca.
  - Botão recarrega a interface.
- Verificação:
  - `bun run typecheck`
  - teste manual injetando throw temporário local, sem commitar.

#### B07 - Corrigir script `build:packages`

- Status: implementado no worktree atual.
- Objetivo: fazer o comando documentado no README funcionar com Bun workspaces.
- Arquivos: `package.json`, `README.md`.
- Implementação:
  1. Trocar filtro que não casa workspaces (`./packages/*`) por filtro de package scope (`@desktop-agent/*`).
  2. Usar `typecheck`, porque os packages não definem scripts `build`.
  3. Atualizar README para dizer "Typecheck all workspaces".
- Aceite:
  - `bun run build:packages` sai com código 0.
- Verificação:
  - `bun run build:packages`

#### B08 - Remover sombras, bordas e matte fantasma da janela transparente

- Status: bug aberto, evidenciado por screenshots do app.
- Objetivo: a janela flutuante deve parecer nativa e recortada ao conteúdo, sem quadrado claro no pet colapsado e sem borda/sombra preta artificial no modo mini.
- Evidência visual:
  - Modo collapsed: o pet circular aparece sobre um matte quadrado claro, como se a webview/janela não estivesse realmente transparente ao redor do orb.
  - Modo mini: aparece uma borda/sombra escura grossa na lateral direita e no rodapé, destacando o retângulo da janela além do raio do shell.
- Hipóteses prováveis:
  1. Sombra nativa do `NSWindow` não foi invalidada depois de resize/show.
  2. `set_shadow(false)` do Tauri não basta em janela `transparent + decorations=false`.
  3. CSS do shell/pet ainda cria sombra ou backdrop quadrado (`box-shadow`, `backdrop-filter`, `bg-*` semiopaco) fora do raio esperado.
  4. O modo collapsed precisa de tratamento próprio, porque renderiza fora de `.agent-shell`.
- Arquivos: `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src/lib/window.ts`, `apps/desktop/src/app.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. Reproduzir em `collapsed`, `mini`, `normal` e `expanded` com fundo claro e fundo escuro atrás da janela.
  2. No JS, chamar `appWindow.setShadow(false)` após `setSize`, `setPosition`, `show` e resize de modo.
  3. No Rust/macOS, avaliar adicionar `objc2-app-kit` para chamar `invalidateShadow()` no `setup()` e em `WindowEvent::Resized`; se a API for instável, documentar fallback.
  4. Remover ou reduzir `box-shadow` de `.agent-shell` e do wrapper collapsed quando a sombra estiver vazando como retângulo.
  5. Garantir `html`, `body`, `#root`, wrapper collapsed e `.agent-shell` com `background: transparent` fora das superfícies visíveis.
  6. Separar sombra visual desejada do conteúdo interno: se houver sombra, ela deve respeitar o raio do shell/pet e não revelar o retângulo da webview.
- Edge cases:
  - O fix não pode remover o contraste interno do shell em fundo escuro.
  - Collapsed precisa continuar clicável/arrastável em toda área útil do pet.
  - Expanded não pode perder foco, resize ou always-on-top.
  - Screenshots em Retina podem mostrar diferenças de 1px; tolerância máxima é uma hairline sutil, não uma borda grossa.
- Aceite:
  - Em fundo branco, o pet collapsed não mostra quadrado claro ao redor.
  - Em modo mini, não há faixa preta na direita nem sombra retangular no rodapé.
  - Raios do shell aparecem limpos em todos os modos.
  - `alwaysOnTop`, tray click, drag e troca de modo continuam funcionando.
- Verificação:
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `bun run typecheck`
  - captura manual antes/depois em fundo claro e escuro para `collapsed` e `mini`.

### P1 - Identidade E Superfície Helix

#### R01 - Identidade visível Helix

- Status: parcialmente implementado.
- Objetivo: usuário vê Helix como produto, sem quebrar package IDs nem bundle ID.
- Arquivos: `apps/desktop/src/app.tsx`, `apps/desktop/src/surfaces/command-palette/index.tsx`, `apps/desktop/src-tauri/tauri.conf.json`, `packages/agent-runtime/src/orchestrator.ts`, `packages/agent-runtime/src/workflow-runner.ts`, `README.md`.
- Implementação:
  1. Trocar título visível, aria labels, titlebar e prompts internos para Helix.
  2. Manter `com.desktop-agent.app` até decisão de release/bundle migration.
  3. Manter package names `@desktop-agent/*` para evitar churn de workspace.
  4. Atualizar README e `BACKLOG.md` para apontarem `PLANO.md`.
- Aceite:
  - UI, prompts e produto Tauri mostram Helix.
  - Nenhum import/workspace quebra por rename.
- Verificação:
  - `rg "Desktop Agent" apps packages README.md`
  - `bun run typecheck`

#### R02 - Component split da Command Palette

- Status: implementado no worktree atual.
- Objetivo: reduzir risco antes de chat multi-turn e features de contexto.
- Arquivos: `apps/desktop/src/surfaces/helix/*` criados; `command-palette/` removido; `HistoryList` movido para `helix/`.
- O que foi feito:
  - Constantes, hooks, views (`MiniView`, `NormalCommandView`, `ExpandedView`), `SettingsPanel` e `ConnectorsPanel` já estão em `surfaces/helix/`.
  - `command-palette/index.tsx` (alias temporário) e `result-preview.tsx` foram removidos.
  - `app.tsx` já importa `Helix` diretamente.
- Aceite:
  - UI visualmente igual antes/depois.
  - `rg "command-palette|CommandPalette" apps/desktop/src` retorna vazio.
  - `bun run typecheck` passa.
- Verificação:
  - `bun run typecheck`
  - `rg "command-palette|CommandPalette" apps/desktop/src`

#### R03 - Tokens mínimos e limpeza visual

- Status: planejado.
- Objetivo: criar base visual consistente sem refactor cosmético gigante.
- Arquivos: `apps/desktop/src/index.css`, componentes extraídos na surface Helix.
- Implementação:
  1. Adicionar tokens para canvas, surface, elevated, overlay, text, border, accent e radius.
  2. Migrar primeiro componentes novos para tokens.
  3. Remover `bg-zinc-*` gradualmente apenas quando o componente for tocado por feature real.
  4. Manter acento violeta restrito a foco, estado ativo e Pinstripes/modelo.
- Aceite:
  - Novos componentes não usam `text-[*px]` nem `bg-zinc-*` sem justificativa.
  - UI não vira paleta monohue roxa.
- Verificação:
  - `rg "bg-zinc-|text-\\[" apps/desktop/src/surfaces/helix apps/desktop/src/components`

#### R04 - Identidade visual do pet e status

- Status: implementado no worktree atual (CP3) e refinado em 2026-07-07.
- Objetivo: transformar o pet na assinatura visual do Helix, remover elementos genéricos (rosto feliz, sombra retangular) e comunicar estados de forma limpa.
- Arquivos: `apps/desktop/src/components/ui/pet.tsx`, `apps/desktop/src/app.tsx`, `apps/desktop/src/surfaces/helix/ResponseBubble.tsx`, `apps/desktop/src/index.css`.
- Implementação:
  1. `PetFull` redesenhado: esfera central com gradiente de alto contraste, anéis concêntricos espirais fluindo continuamente e anel interno sutil.
  2. `PetDot` simplificado: círculo flat com cor do estado, sem rosto nem glow externo.
  3. Header usa mini-orb alinhado (`<Pet size={10} variant="dot" />`) e sem órbitas ilegíveis.
  4. Chat usa mini-orb como avatar do Helix.
  5. Indicador de "pensando" no chat usa texto + três pontos animados, sem bolinha torta.
  6. Container do modo collapsed limpo (sem gradiente quadrado, ring e sombra artificial).
  7. Animações disruptivas de hover/focus: shockwave expansivo, esfera pulsando e anéis acelerando.
  8. Estados por cor mantidos: idle roxo, thinking amarelo, success verde, error vermelho, connecting laranja.
- Aceite:
  - Pet não tem mais rosto feliz, sombra bugada nem borda quadrada no collapsed.
  - Header mostra indicador pequeno, alinhado e legível.
  - "Pensando" no chat é uma linha sutil, sem parecer "!" torto.
  - Hover no pet dispara animações visíveis e criativas.

### P2 - Chat Multi-turn

#### F01 - Modelo `Turn[]` completo

- Status: implementado no worktree atual (CP3).
- Objetivo: transformar a experiência em chat multi-turn sem perder compatibilidade com streaming atual.
- Arquivos: `packages/shared/src/types/rpc.ts`, `apps/desktop/src/stores/agent.ts`, `apps/desktop/src/lib/rpc.ts`, `packages/shared/src/api.ts`, `packages/agent-runtime/src/api.ts`.
- Implementação:
  1. Tipo `Conversation` adicionado a `shared/types/rpc.ts`.
  2. `currentConversationId` adicionado ao store.
  3. Eventos de streaming atualizam o último assistant turn via `appendAssistantChunk`.
  4. Helpers `startUserTurn`, `appendAssistantChunk`, `finalizeAssistantTurn` implementados.
  5. `result` mantido sincronizado como compat durante transição.
  6. `agent.completed` e `agent.cancelled` chamam `finalizeAssistantTurn`.
- Aceite:
  - Fazer duas perguntas seguidas mantém ambas visíveis.
  - Streaming de uma resposta não reescreve turns anteriores.

#### F02 - `ChatView` com bubbles

- Status: implementado no worktree atual (CP3).
- Objetivo: renderizar conversa como produto de chat, não painel de resultado único.
- Arquivos: `apps/desktop/src/surfaces/helix/ChatView.tsx`, `QueryBubble.tsx`, `ResponseBubble.tsx`, `components/ui/markdown-renderer.tsx`.
- Implementação:
  1. `ChatView` renderiza user bubble à direita e assistant bubble à esquerda com avatar Pet dot.
  2. Suporte a blocos `text` (via MarkdownRenderer), `thinking` (collapsible), `tool_call` (badge) e `error`.
  3. Auto-scroll apenas se usuário estiver a menos de 100px do fim.
  4. Botão "Ir para o final" quando scroll está travado.
  5. Cursor de streaming no bloco ativo.
  6. MarkdownRenderer usa `react-markdown` + `remark-gfm` para renderizar respostas com code blocks, links, tabelas, listas.
- Aceite:
  - Turns continuam legíveis em normal mode.
  - Expanded usa largura extra sem linhas muito longas.
  - Scroll do usuário não é sequestrado.

#### F03 - Composer persistente

- Status: implementado no worktree atual (CP3).
- Objetivo: composer sempre visível e previsível.
- Arquivos: `apps/desktop/src/surfaces/helix/Composer.tsx`.
- Implementação:
  1. Componente `Composer` isolado com textarea auto-expand (1-4 linhas) e botão enviar.
  2. Enter envia; Shift+Enter quebra linha.
  3. Durante streaming, bloqueia envio e mostra "Aguardando resposta...".
  4. Substitui textarea inline em `NormalCommandView` e `ExpandedView`.
  5. Visível abaixo do `ChatView` durante conversa ativa para follow-up.
- Aceite:
  - Composer permanece visível em idle, streaming, complete e error.
  - Sem clipboard, placeholder encoraja pergunta livre.

#### F04 - Persistência de turns

- Status: implementado no worktree atual (CP3).
- Objetivo: salvar conversa sem carregar automaticamente contexto antigo.
- Arquivos: `packages/storage/src/repositories/conversations.ts`, `packages/storage/src/index.ts`, `packages/agent-runtime/src/api.ts`, `packages/shared/src/api.ts`.
- Implementação:
  1. Repositório `conversations.ts` com `createConversation`, `createTurn`, `listConversations`, `listTurns`, `updateConversationTitle`.
  2. RPC APIs `listConversations`, `listTurns`, `saveConversation` expostas no `AgentApi`.
  3. `saveConversation` chamado no `finally` de `handleExecute` para salvar turns finalizadas.
  4. Title da conversa deriva do primeiro user prompt (até 80 chars).
  5. UI "Nova conversa" limpa store e `currentConversationId`, não apaga SQLite.
- Aceite:
  - Turns aparecem no histórico depois de finalizar.
  - Reabrir app não injeta histórico automaticamente no prompt.

#### F05 - Ações pós-resposta

- Status: implementado no worktree atual (CP3).
- Objetivo: ações por turn.
- Arquivos: `ResponseBubble.tsx`, `QueryBubble.tsx`, `Composer.tsx`, `index.tsx`.
- Implementação:
  1. Copiar texto do assistant bubble (concatena blocos text).
  2. Copiar prompt do user bubble.
  3. Regenerar: remove último assistant turn e re-executa último user prompt.
  4. Editar último prompt carregando texto no composer.
  5. Nova conversa reseta turns e `currentConversationId`.
- Aceite:
  - Feedback "Copiado" dura 2s.
  - Regenerate não duplica user turn.
  - Edit prompt não altera histórico imutável já finalizado; cria novo envio.

#### F06 - Streaming cancellation

- Status: implementado no worktree atual (CP3).
- Objetivo: nova query não pode misturar chunks da anterior.
- Arquivos: `apps/desktop/src/lib/rpc.ts`, `apps/desktop/src/surfaces/helix/hooks/useExecute.ts`.
- Implementação:
  1. `activeRequestId` guardado no frontend RPC (module-level).
  2. Eventos com `requestId` diferente do ativo são ignorados.
  3. `handleExecute` finaliza turn anterior como `cancelled` se streaming.
  4. `setRpcActiveRequestId` chamado ao iniciar nova execução.
  5. `agent.completed` e `agent.cancelled` limpam `activeRequestId`.
  6. Runtime já mantinha `AbortController` por request (nativa).
- Aceite:
  - Enviar pergunta B durante streaming de A interrompe A.
  - UI mostra A como cancelada.
  - Nenhum chunk de A aparece em B.

### P3 - Copilot Context E Permissões

#### C01 - Context chips

- Status: implementado no worktree atual.
- Objetivo: detectar contexto útil sem executar ação surpresa.
- Arquivos: `packages/shared/src/context-detector.ts`, `packages/shared/src/__tests__/context-detector.test.ts`, `apps/desktop/src/surfaces/helix/ContextChipBar.tsx`, `apps/desktop/src/surfaces/helix/hooks/useContextChips.ts`, `apps/desktop/src/surfaces/helix/Composer.tsx`, `apps/desktop/src/surfaces/helix/constants.tsx`.
- Implementação:
  1. Detector genérico em `packages/shared` classifica clipboard como `url`, `code`, `error`, `long_text`, `message`, `plain_text`.
  2. Hook `useContextChips` gera chips com ícone, label, prompt e source mode.
  3. `ContextChipBar` renderiza header com ícone de clipboard e contador, seguido de botões de chip sempre visíveis.
  4. Clique em chip ativa `inputMode='clipboard'` e preenche o composer com o prompt sugerido.
  5. Nunca executar automaticamente no clique.
  6. Chips mostram apenas ícone + label, sem preview do conteúdo.
- Aceite:
  - Clipboard vazio não mostra chips.
  - URL sugere leitura/resumo.
  - Stack trace sugere debug/explain.
  - Chips aparecem em `normal` e `expanded`, não em `mini`.
- Verificação:
  - `bun test packages/shared/src/__tests__/context-detector.test.ts`
  - `bun run typecheck`
  - teste manual no app com diferentes tipos de clipboard.

#### C02 - Web search com fontes

- Status: implementado.
- Objetivo: pesquisar assunto atual com fontes visíveis e histórico.
- Arquivos: `packages/tools-web/src/index.ts`, `ResponseBubble.tsx`.
- Implementação:
  1. Resposta padrão com resumo curto e lista de fontes. ✅
  2. URLs/fontes registradas no output do tool_call. ✅
  3. UI mostra fontes como links copiáveis com título, URL e snippet. ✅
  4. Se web falhar, UI mostra erro explícito sem inventar fonte. ✅
- Aceite:
  - Toda resposta web tem pelo menos uma fonte ou erro explícito.
  - Histórico preserva fontes (tool_call output persistido em Turn).
  - Fontes são clicáveis e têm botão de copiar URL.
- Verificação:
  - testes de tools-web existentes + teste manual.
  - `bun run typecheck` passa.

#### C03 - OCR/screenshot com disclosure

- Status: implementado.
- Objetivo: ler tela sem pedir permissão de forma opaca.
- Arquivos: `packages/tools-ocr/src/index.ts`, `NormalCommandView.tsx`, `ResponseBubble.tsx`.
- Implementação:
  1. Antes de qualquer captura, mostrar disclosure sobre Screen Recording. ✅
  2. Se permissão faltar, explicar como habilitar no macOS. ✅
  3. Capturar imagem/área somente após confirmação explícita. ✅
  4. Resultado entra como context block (tool_call output), não como clipboard. ✅
  5. Texto extraído mostrado em preview no card da ferramenta. ✅
  6. Resultado vazio e erro de OCR têm feedback visual dedicado. ✅
- Aceite:
  - Usuário vê disclosure antes do pedido de permissão.
  - Falha de permissão vira estado recuperável (botão Recusar).
  - Texto extraído aparece inline, não substitui clipboard.
- Verificação:
  - teste manual em macOS com permissão negada e concedida.
  - `bun run typecheck` passa.

#### C04 - MCP env vars e status honesto

- Status: implementado.
- Objetivo: configurar conectores sem vazar secrets nem fingir health check.
- Arquivos: `packages/storage/src/repositories/mcp-servers.ts`, `ConnectorsPanel.tsx`, `hooks/useCapabilities.ts`, `packages/agent-runtime/src/api.ts`, `packages/shared/src/types/rpc.ts`.
- Implementação:
  1. Presets desabilitados por padrão. ✅
  2. Card expansível para configurar env vars, args e permissões. ✅
  3. Secrets mascarados em listagem (••••••••). ✅
  4. Valores só revelados no runtime para testar/conectar. ✅
  5. Header mostra "Ativo/Off" + "Testado há X", não "online". ✅
  6. Teste real com spawn + initialize handshake + tools/list + timeout 10s. ✅
  7. CRUD completo: adicionar, editar, deletar conectores custom. ✅
  8. Tools detectadas exibidas no card após teste. ✅
- Aceite:
  - Secrets nunca aparecem em texto claro na UI normal.
  - Conector com env obrigatório vazio não habilita silenciosamente.
  - Teste de MCP faz spawn real, handshake e lista tools.
  - Erros de teste (ENOENT, timeout, crash) são mostrados na própria tela.
  - Conectores custom podem ser adicionados, editados e removidos.
- Verificação:
  - testes de storage existentes.
  - teste manual no painel de conectores.
  - `bun run typecheck` passa.

### P4 - Validação Futura

#### V01 - Gemini provider

- Status: validado (OpenAI-compatible endpoint).
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/openai`
- Validação: Gemini usa endpoint OpenAI-compatible do Google. `/models`, `/chat/completions` e streaming SSE funcionam com o provider `openai-compatible`.
- Modelos fallback: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`.
- UI mostra Gemini como opção com campo de URL Base editável.
- Não fazer: assumir que todos os modelos Gemini suportam todas as features OpenAI (function calling, vision).

#### V02 - Helical timeline e motion orbital

- Status: pesquisa/protótipo.
- Critério para desbloquear: protótipo visual comparado contra chat linear em legibilidade, navegação e performance.
- Não fazer: substituir scroll linear no produto principal sem validação.

#### V03 - Prompt library, agent profiles e file attachments

- Status: implementado.
- Objetivo: biblioteca de prompts reutilizáveis, perfis de agente com system prompt, e leitura de arquivos.
- Arquivos: `packages/storage/src/migrations/006_prompt_library.ts`, `packages/storage/src/repositories/prompt-library.ts`, `packages/shared/src/types/rpc.ts`, `packages/shared/src/api.ts`, `packages/agent-runtime/src/api.ts`, `apps/desktop/src/surfaces/helix/PromptsPanel.tsx`, `apps/desktop/src/surfaces/helix/hooks/usePrompts.ts`.
- Implementação:
  1. Migration 006 cria tabelas `prompt_library` e `agent_profiles` com defaults. ✅
  2. Repository com CRUD completo para prompts e profiles. ✅
  3. Tipos `PromptTemplate`, `AgentProfile`, `SavePromptInput`, `SaveProfileInput` em shared. ✅
  4. API methods: `listPromptTemplates`, `savePromptTemplate`, `deletePromptTemplate`, `listAgentProfiles`, `saveAgentProfile`, `deleteAgentProfile`, `setActiveProfile`, `getActiveProfile`, `readFile`. ✅
  5. Hook `usePrompts` com estado e callbacks CRUD. ✅
  6. `PromptsPanel` component com UI completa: lista por categoria, criar/editar/excluir, perfis com ativação. ✅
  7. Tab "Prompts" em NormalCommandView e ExpandedView. ✅
  8. `readFile` API para anexar conteúdo de arquivos ao prompt. ✅
- Aceite:
  - Usuário pode criar, editar e excluir prompts customizados.
  - Prompts são categorizados e podem ser usados com um clique.
  - Perfis de agente com system prompt podem ser ativados/desativados.
  - Defaults são criados automaticamente na primeira execução.
- Verificação:
  - `bun run typecheck` passa.
  - `bun test` passa (incluindo teste de migration com novas tabelas).
  - teste manual no app.

#### V04 - Workflow LLM-only

- Status: implementado.
- Objetivo: workflow com tool selection guiado por LLM quando keywords não match.
- Arquivos: `packages/agent-runtime/src/workflow-runner.ts`.
- Implementação:
  1. `selectTool` agora é async e tenta keyword matching primeiro. ✅
  2. Se keywords não match, chama `selectToolWithLlm` que usa o provider ativo. ✅
  3. LLM recebe catálogo de ferramentas e decide qual usar com JSON output. ✅
  4. Se LLM retorna `toolName: null`, workflow responde diretamente (LLM-only). ✅
  5. Se LLM retorna tool inválida, fallback para resposta direta. ✅
  6. Mock provider pula LLM selection e vai direto para resposta. ✅
  7. Cancelamento e approval continuam funcionando (signal check antes de LLM call). ✅
- Aceite:
  - Workflow pode decidir usar ferramenta sem keyword match.
  - Workflow pode responder diretamente sem ferramenta quando LLM decide.
  - Erros de LLM na seleção não quebram o workflow.
- Verificação:
  - `bun run typecheck` passa.
  - `bun test` passa.
  - teste manual com provider real e mock.

## Ordem Recomendada De Commits

1. `docs: refine helix product plan`
2. `feat: persist helix window settings`
3. `feat: add versioned storage migrations`
4. `chore: harden tauri shell foundation`
5. `feat: add helix error boundary`
6. `refactor: split helix command surface`
7. `feat: add helix chat core with multi-turn, markdown and persistence`
8. `feat: add context chips and copilot permissions` (próximo)

## Critérios De Aceite Do Release Slice

- O app não usa `Option+Space` como atalho padrão.
- Normal mode abre em `520x820`.
- `alwaysOnTop` e último modo persistem entre troca de modo e restart.
- A primeira tela funciona sem clipboard.
- Pinstripes aparece como provider principal e modelo selecionável.
- Logs técnicos não dominam tarefas simples.
- Surface `Helix` está extraída antes de features grandes.
- Storage roda migrations versionadas de forma idempotente.
- Permissões sensíveis têm disclosure antes de pedir acesso.

## Verificação

```bash
bun run lint
bun run typecheck
bun test
bun run build:sidecar
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Referências

- Raycast shortcuts: https://manual.raycast.com/keyboard-shortcuts
- Raycast AI: https://www.raycast.com/core-features/ai
- Tauri global shortcut: https://v2.tauri.app/plugin/global-shortcut/
- Tauri system tray: https://v2.tauri.app/learn/system-tray/
- ChatGPT Work with Apps: https://help.openai.com/en/articles/10119604-work-with-apps-on-macos
- Apple Accessibility permissions: https://support.apple.com/guide/mac-help/allow-accessibility-apps-to-access-your-mac-mh43185/mac
