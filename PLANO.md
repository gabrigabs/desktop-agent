# Plano Helix

> Fonte principal do produto. `BACKLOG.md` fica como histórico/status resumido.
> Última atualização: 2026-07-06.

---

## Meta

| Campo | Valor |
| --- | --- |
| Nome | Helix |
| Stack | Tauri 2 + React 19 + Vite 7 + Tailwind CSS 4 + Zustand 5 + Bun + SQLite |
| Runtime | Bun sidecar via kkrpc stdio |
| Providers | Pinstripes primário; OpenAI-compatible e Mock suportados; Gemini bloqueado até contrato real ser validado |
| Plataforma | macOS Apple Silicon |
| Idioma UI | Português PT-BR |
| Atalho global | `Control+Shift+Space` |
| Janela | Collapsed `104x104`, Mini `392x460`, Normal `520x820`, Expanded até `1180x820` |
| Produto | Copilot macOS leve, keyboard-first, com pet discreto, composer sempre visível e permissões explícitas |

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
- A superfície principal ainda fica concentrada em `CommandPalette`, que deve ser quebrada antes de features grandes.

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
- A migração de UI deve ser feita após o component split para evitar refatorar 2250 linhas de uma vez.

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
  4. Envolver `CommandPalette` no boundary.
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

- Status: planejado, próximo grande refactor.
- Objetivo: reduzir risco antes de chat multi-turn e features de contexto.
- Arquivos alvo: criar `apps/desktop/src/surfaces/helix/*`; manter `command-palette/index.tsx` como shell temporário ou adapter.
- Ordem de implementação:
  1. Extrair constantes puras: shortcut label, modelos Pinstripes, quick actions, free actions.
  2. Extrair hooks sem mudar UI: `useClipboard`, `useCapabilities`, `useSettingsForm`, `useExecute`.
  3. Extrair `MiniView`, `NormalCommandView`, `ExpandedView`.
  4. Extrair `SettingsPanel` e `ConnectorsPanel`.
  5. Só depois renomear a surface para `helix`.
- Contratos:
  - Props devem ser explícitas; evitar passar o store inteiro para componentes filhos.
  - Hooks podem acessar Zustand quando reduzirem prop drilling de estado global.
  - Cada arquivo novo deve ficar abaixo de 300 linhas; exceções precisam comentário no plano.
- Aceite:
  - UI visualmente igual antes/depois.
  - Nenhuma feature nova entra no mesmo commit.
  - `index.tsx` cai para menos de 350 linhas.
- Verificação:
  - `bun run typecheck`
  - screenshot/manual em `mini`, `normal`, `expanded`, settings e connectors.

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

#### R04 - Pet status no header

- Status: planejado.
- Objetivo: preservar o pet como assinatura sem perder legibilidade em tamanho pequeno.
- Arquivos: `apps/desktop/src/components/ui/pet.tsx`, `apps/desktop/src/app.tsx`.
- Implementação:
  1. Criar variante `PetStatusDot` ou prop `variant="dot"`.
  2. Header usa dot 20px + glow por estado.
  3. Collapsed mantém SVG completo 62px.
  4. Estado visual deve derivar de `connected`, `streaming`, `error`, `result`.
- Aceite:
  - Header não mostra órbitas ilegíveis.
  - Collapsed continua reconhecível e arrastável.
- Verificação:
  - teste manual dos estados idle, connecting, thinking, success, error.

### P2 - Chat Multi-turn

#### F01 - Modelo `Turn[]` completo

- Status: parcialmente preparado; tipos e store base existem, UI ainda usa `result`.
- Objetivo: transformar a experiência em chat multi-turn sem perder compatibilidade com streaming atual.
- Arquivos: `packages/shared/src/types/rpc.ts`, `apps/desktop/src/stores/agent.ts`, `apps/desktop/src/lib/rpc.ts`, `packages/shared/src/api.ts`, `packages/agent-runtime/src/api.ts`.
- Implementação:
  1. Confirmar shape final de `Turn` e `MessageBlock`.
  2. Adicionar `currentConversationId` no store.
  3. Alterar eventos de streaming para atualizarem o último assistant turn.
  4. Criar helpers `startUserTurn`, `startAssistantTurn`, `appendAssistantChunk`, `finalizeAssistantTurn`.
  5. Manter `result` sincronizado só durante uma versão de compat.
  6. Remover `result` quando `ChatView` estiver completo.
- Edge cases:
  - Erro durante streaming finaliza turn como `error`.
  - Cancelamento finaliza turn como `cancelled`.
  - Workflow approval não deve criar turn duplicada.
- Aceite:
  - Fazer duas perguntas seguidas mantém ambas visíveis.
  - Streaming de uma resposta não reescreve turns anteriores.
  - `reset()` cria nova conversa vazia.
- Verificação:
  - testes unitários de store ou hook.
  - teste manual com provider mock e Pinstripes.

#### F02 - `ChatView` com bubbles

- Status: planejado.
- Objetivo: renderizar conversa como produto de chat, não painel de resultado único.
- Arquivos: `apps/desktop/src/surfaces/helix/chat-view.tsx`, `query-bubble.tsx`, `response-bubble.tsx`.
- Implementação:
  1. Renderizar user bubble à direita e assistant bubble à esquerda.
  2. Dar suporte a blocos `text`, `thinking`, `tool_call` e `error`.
  3. Auto-scroll apenas se usuário estiver a menos de 100px do fim.
  4. Mostrar botão "Ir para o final" quando scroll estiver travado.
  5. Exibir cursor de streaming no bloco ativo.
- Aceite:
  - 10 turns continuam legíveis em normal mode.
  - Expanded usa largura extra sem linhas muito longas.
  - Scroll do usuário não é sequestrado.
- Verificação:
  - teste manual em `normal` e `expanded`.

#### F03 - Composer persistente

- Status: parcialmente existente na Command Palette, precisa virar componente isolado.
- Objetivo: composer sempre visível e previsível.
- Arquivos: `apps/desktop/src/surfaces/helix/composer.tsx`.
- Implementação:
  1. Extrair textarea, modo de entrada e botão enviar.
  2. Enter envia; Shift+Enter quebra linha.
  3. Auto-expand de 1 a 4 linhas.
  4. Durante streaming, bloquear envio por enquanto e mostrar "Aguardando resposta...".
  5. Preparar contrato para follow-up streaming em fase posterior.
- Aceite:
  - Composer permanece visível em idle, streaming, complete e error.
  - Sem clipboard, placeholder encoraja pergunta livre.
- Verificação:
  - teste manual de teclado e foco.

#### F04 - Persistência de turns

- Status: schema criado; repositórios ainda pendentes.
- Objetivo: salvar conversa sem carregar automaticamente contexto antigo.
- Arquivos: `packages/storage/src/repositories/conversations.ts`, `packages/storage/src/index.ts`, `packages/agent-runtime/src/api.ts`.
- Implementação:
  1. Criar repositório para `createConversation`, `createTurn`, `listConversations`, `listTurns`.
  2. Salvar assistant turn ao finalizar com status `complete`, `error` ou `cancelled`.
  3. Não salvar turns parciais a cada chunk na primeira versão.
  4. Expor APIs RPC para histórico separado.
  5. UI "Nova conversa" limpa store, não apaga SQLite.
- Aceite:
  - Turns aparecem no histórico depois de finalizar.
  - Reabrir app não injeta histórico automaticamente no prompt.
- Verificação:
  - testes storage/repository.

#### F05 - Ações pós-resposta

- Status: parcialmente existente como copiar resultado único.
- Objetivo: ações por turn.
- Arquivos: `response-bubble.tsx`, `query-bubble.tsx`, `composer.tsx`.
- Implementação:
  1. Copiar texto do assistant bubble.
  2. Copiar prompt do user bubble.
  3. Regenerar última resposta.
  4. Editar último prompt carregando texto no composer.
  5. Nova conversa reseta turns e workflow state.
- Aceite:
  - Feedback "Copiado" dura 2s.
  - Regenerate não duplica user turn.
  - Edit prompt não altera histórico imutável já finalizado; cria novo envio.
- Verificação:
  - teste manual com provider mock.

#### F06 - Streaming cancellation

- Status: planejado.
- Objetivo: nova query não pode misturar chunks da anterior.
- Arquivos: `apps/desktop/src/lib/rpc.ts`, `packages/agent-runtime/src/api.ts`, `packages/provider-gateway/src/providers/openai-compatible.ts`.
- Implementação:
  1. Guardar `activeRequestId` no frontend RPC.
  2. Ao iniciar nova execução, chamar `cancelAgent`/`cancelRun` da anterior.
  3. No sidecar, manter `AbortController` por request/run.
  4. Provider precisa receber `signal`.
  5. Ignorar chunks cujo `requestId` não seja o ativo.
- Aceite:
  - Enviar pergunta B durante streaming de A interrompe A.
  - UI mostra A como cancelada ou substituída explicitamente.
  - Nenhum chunk de A aparece em B.
- Verificação:
  - teste manual com stream mock lento.

### P3 - Copilot Context E Permissões

#### C01 - Context chips

- Status: planejado.
- Objetivo: detectar contexto útil sem executar ação surpresa.
- Arquivos: `apps/desktop/src/lib/context-detector.ts`, `context-chips.tsx`, `composer.tsx`.
- Implementação:
  1. Classificar clipboard como `empty`, `url`, `code`, `error`, `long_text`, `message`, `plain_text`.
  2. Gerar chips com label, prompt e source mode.
  3. Clique em chip preenche composer e mostra chip de contexto usado.
  4. Nunca executar automaticamente no clique.
  5. Limitar preview para não despejar dados sensíveis na tela.
- Aceite:
  - Clipboard vazio não é erro.
  - URL sugere leitura/resumo.
  - Stack trace sugere debug/explain.
- Verificação:
  - testes unitários do detector.

#### C02 - Web search com fontes

- Status: base técnica existe, UX pendente.
- Objetivo: pesquisar assunto atual com fontes visíveis e histórico.
- Arquivos: `packages/tools-web/src/index.ts`, `workflow-runner.ts`, UI de resposta.
- Implementação:
  1. Definir resposta padrão com resumo curto e lista de fontes.
  2. Registrar URLs/fontes em metadata do run.
  3. UI mostra fontes como links copiáveis.
  4. Se web falhar, resposta deve explicar limitação e não inventar fonte.
- Aceite:
  - Toda resposta web tem pelo menos uma fonte ou erro explícito.
  - Histórico preserva fontes.
- Verificação:
  - testes de tools-web existentes + teste manual.

#### C03 - OCR/screenshot com disclosure

- Status: base técnica existe, UX pendente.
- Objetivo: ler tela sem pedir permissão de forma opaca.
- Arquivos: `packages/tools-ocr/src/index.ts`, surface Helix, possível bridge Tauri.
- Implementação:
  1. Antes de qualquer captura, mostrar texto curto sobre Screen Recording.
  2. Se permissão faltar, explicar como habilitar no macOS.
  3. Capturar imagem/área somente após confirmação explícita.
  4. Resultado entra como context block, não como clipboard.
- Aceite:
  - Usuário vê disclosure antes do pedido de permissão.
  - Falha de permissão vira estado recuperável.
- Verificação:
  - teste manual em macOS com permissão negada e concedida.

#### C04 - MCP env vars e status honesto

- Status: schema e masking existem; UX ainda pendente.
- Objetivo: configurar conectores sem vazar secrets nem fingir health check.
- Arquivos: `packages/storage/src/repositories/mcp-servers.ts`, `connectors-panel.tsx`, `app.tsx`.
- Implementação:
  1. Mostrar presets desabilitados por padrão.
  2. Expandir card para configurar env vars.
  3. Mascarar secrets em listagem.
  4. Só revelar valores no runtime quando necessário para testar/conectar.
  5. Header mostra "configurados/ativos", não "online", até haver processo MCP real.
- Aceite:
  - Secrets nunca aparecem em texto claro na UI normal.
  - Conector com env obrigatório vazio não habilita silenciosamente.
- Verificação:
  - testes de storage existentes.
  - teste manual no painel de conectores.

### P4 - Validação Futura

#### V01 - Gemini provider

- Status: bloqueado.
- Critério para desbloquear: validar `/models`, request body, streaming, errors e compatibilidade com OpenAI-compatible.
- Não fazer: mostrar Gemini como opção pronta antes dessa validação.

#### V02 - Helical timeline e motion orbital

- Status: pesquisa/protótipo.
- Critério para desbloquear: protótipo visual comparado contra chat linear em legibilidade, navegação e performance.
- Não fazer: substituir scroll linear no produto principal sem validação.

#### V03 - Prompt library, agent profiles e file attachments

- Status: depois do chat core.
- Critério para desbloquear: `Turn[]`, composer isolado e persistência de turns completos.
- Não fazer: adicionar nova camada de UI em `CommandPalette` antes do component split.

#### V04 - Workflow LLM-only

- Status: depois de permissões e cancellation.
- Critério para desbloquear: contrato de tool selection, limites de steps, cancelamento e aprovação sensível funcionando.
- Não fazer: remover fallback atual antes de ter testes de erro e permissão.

## Ordem Recomendada De Commits

1. `docs: refine helix product plan`
2. `feat: persist helix window settings`
3. `feat: add versioned storage migrations`
4. `chore: harden tauri shell foundation`
5. `feat: add helix error boundary`
6. `refactor: split helix command surface`
7. `feat: introduce helix multi-turn chat`

## Critérios De Aceite Do Release Slice

- O app não usa `Option+Space` como atalho padrão.
- Normal mode abre em `520x820`.
- `alwaysOnTop` e último modo persistem entre troca de modo e restart.
- A primeira tela funciona sem clipboard.
- Pinstripes aparece como provider principal e modelo selecionável.
- Logs técnicos não dominam tarefas simples.
- `CommandPalette` tem plano de split antes do chat multi-turn completo.
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
