# Histórico Do Backlog Helix

> Este arquivo não é mais a fonte principal de planejamento.
> Use [PLANO.md](/Users/gabrielbezerrarodrigues/dev/desktop-agent/PLANO.md) como fonte de verdade do produto.
> O backlog ativo de UI/UX, redesign e profiles está documentado em `PLANO.md`.

## Origem

O backlog original nasceu para transformar o protótipo `Desktop Agent` em um copilot macOS leve, rápido via teclado, com pet/status flutuante, menu bar, Pinstripes como provider principal e fluxo útil mesmo sem clipboard.

## Pesquisa Preservada

- Raycast é keyboard-first e usa `Command/Alt+Space` como atalho global padrão, então Helix evita competir com esse padrão.
- ChatGPT Desktop usa `Option+Space` no macOS, reforçando que esse atalho já é uma convenção ocupada por assistentes desktop.
- Tauri oferece global shortcut, tray e janelas sempre no topo, que são os blocos nativos do produto.
- Raycast AI e Raycast Notes sustentam a direção de janela flutuante, comandos rápidos, histórico, notas/scratchpad e modelos selecionáveis.
- ChatGPT Work with Apps reforça o padrão de contexto de apps com banner/estado explícito e permissões por integração.
- Apple alerta que Accessibility permite controlar o Mac e acessar informações pessoais, então qualquer feature desse tipo precisa de disclosure claro.

## Decisões Que Viraram Plano

- Nome do produto: Helix.
- Atalho global: `Control+Shift+Space`.
- Provider principal: Pinstripes com `ps/warp`, `ps/thinking` e `ps/pro`.
- Janela normal oficial: `520x820`.
- UI deve deixar de parecer terminal de debug e virar superfície de trabalho.
- Clipboard é contexto opcional, não pré-requisito.
- Pet é launcher/status discreto, não decoração central.
- Permissões sensíveis precisam ser explícitas antes de qualquer pedido de acesso.

## Status Herdado

### Concluído Ou Parcialmente Concluído

- Atalho global já foi alterado para `Control+Shift+Space`.
- Ações rápidas já cobrem prompt livre e tarefas além de rewrite/summarize/translate.
- Pinstripes já aparece como provider principal com seleção de modelo.
- Histórico e logs já existem, mas precisam de melhor separação visual.
- MCP/web/OCR já têm base técnica, mas ainda não têm UX final.

### Migrado Para `PLANO.md`

- Persistência de `alwaysOnTop` e `lastWindowMode`.
- Migration framework versionado.
- Component split da Command Palette.
- Chat multi-turn com `Turn[]`.
- Error boundary, loading states e sidecar cleanup.
- Context chips, disclosure de permissões e MCP env vars.

### CP3 — Chat Core (2026-07-06)

- R04: Pet status dot no header (variant `"dot"` com glow por estado).
- F01: Modelo `Turn[]` completo com `currentConversationId`, `startUserTurn`, `appendAssistantChunk`, `finalizeAssistantTurn`.
- F02: `ChatView` com bubbles (user à direita, assistant à esquerda com avatar Pet dot), auto-scroll inteligente e botão "Ir para o final".
- F03: `Composer` isolado com auto-expand (1-4 linhas), Enter envia, Shift+Enter quebra linha.
- F04: Repositório `conversations.ts` com `createConversation`, `createTurn`, `listConversations`, `listTurns`. RPC APIs `saveConversation`, `listConversations`, `listTurns`.
- F05: Ações pós-resposta por bubble: copiar prompt, copiar resposta, regenerar, editar prompt.
- F06: Streaming cancellation com `activeRequestId` no frontend RPC; chunks de request antigo são filtrados.
- MarkdownRenderer via `react-markdown` + `remark-gfm`: code blocks, links, tabelas, listas, blockquotes. Links abrem no browser via Tauri shell.
- P1 e P2 unificados em uma única fase de entrega.

### Revamp Visual Do Pet (2026-07-07)

- Redesign do `PetFull`: esfera central com gradiente de alto contraste, anéis concêntricos espirais fluindo continuamente e anel interno sutil.
- Simplificação do `PetDot`: círculo flat com cor do estado, sem rosto nem glow externo.
- Header com mini-orb alinhado e sem órbitas ilegíveis.
- Chat com mini-orb como avatar do Helix e indicador "pensando" usando texto + três pontos animados.
- Container do modo collapsed limpo: removido gradiente quadrado, ring e sombra artificial.
- Animações disruptivas de hover/focus: shockwave expansivo, pulso da esfera e aceleração dos anéis.
- Estados por cor mantidos (idle roxo, thinking amarelo, success verde, error vermelho, connecting laranja).
- Arquivos principais: `apps/desktop/src/components/ui/pet.tsx`, `apps/desktop/src/app.tsx`, `apps/desktop/src/surfaces/helix/ResponseBubble.tsx`, `apps/desktop/src/index.css`.

## UI/UX Redesign e Novo Backlog (2026-07-07)

Após conclusão do backlog anterior, a próxima onda de trabalho foca em melhorias de interface, padronização visual e refinamento de fluxo.

### Decisões do Redesign

- Home page minimalista estilo ChatGPT/Claude/Grok: título/pet, composer, chips de sugestão contextual e clipboard preview colapsável.
- Top bar unificada: pet mini + título + pin + expandir/minimizar/fechar. Status transmitido apenas pela cor/animação do pet.
- Navegação lateral fixa no modo expandido, drawer overlay no modo normal: Nova conversa, Histórico, Perfis, Conectores, Config.
- Pet collapsed substitui o modo mini: 1 clique abre menu rápido, 2 cliques abrem modo normal.
- Profiles evoluem a partir de Prompts: system prompt evoluído + metadados (nome, descrição, ícone). Memória e skills ficam fora desta fase.
- Clipboard unificado ao chat normal: chips inserem o conteúdo no composer e enviam como turn normal.
- Design system mínimo: componentes reutilizáveis (`Button`, `IconButton`, `Input`, `Card`, `Badge`, `Separator`, `HelixShell`) aplicados às páginas de Config, Prompts/Profiles e Connectors.

### Pontos de Partida

- As evidências visuais mostravam muitos botões, funções repetidas, bolinha do Helix desalinhada e tela inicial sobrecarregada.
- O novo backlog prioriza limpeza visual, fluxo de entrada e consistência de system design.
- Detalhes, fases e critérios de aceite estão em [PLANO.md](/Users/gabrielbezerrarodrigues/dev/desktop-agent/PLANO.md).

## Identidade, Espaços Contínuos e Follow-up (2026-07-10)

Esta rodada refinou o Helix de um conjunto de páginas para um sistema com três níveis claros:

```text
Pet discreto -> command palette/ação -> Espaço ou Follow-up quando o trabalho precisa continuar
```

Decisões consolidadas no plano canônico:

- A identidade visual usa um monograma Helix entrelaçado, legível em tamanhos pequenos e animado por estado, sem depender de glow decorativo.
- O radial e a command palette derivam as seis intenções de `HELIX_ACTIONS`; subações continuam uma segunda camada contextual.
- A navegação principal fica em Nova conversa, Histórico, Espaços, Conectores e Config.
- Profiles são estilos de resposta; Workflows são sequências executáveis; Skills são capacidades; nenhum deles compete com Espaços na navegação principal.
- Artifacts permanece como contrato interno de compatibilidade enquanto a UI migra para Espaços/Workspaces.
- Workspaces terão memória editável, contexto fixado, histórico, quick actions, workflows vinculados e layouts próprios.
- Follow-up Sessions serão o background explícito e pausável para escrita, debug, pesquisa, workflows e visão.
- Vision follow-up depende de disclosure, permissão, captura nativa e controles de pausa/stop já validados; não será ativado silenciosamente.

As unidades executáveis, dependências, edge cases, critérios de aceite e ordem de commits estão em `W01-W04` e `FUP01-FUP04` no [PLANO.md](/Users/gabrielbezerrarodrigues/dev/desktop-agent/PLANO.md).

## Consolidação, Arquivos E Capacidades Nativas (2026-07-10)

A rodada seguinte amplia o produto sem descontinuar as decisões, fases ou entidades anteriores. Workspaces (`W01-W04`) e Follow-up Sessions (`FUP01-FUP04`) continuam no roadmap ativo; a ordem imediata passa a fechar pendências parciais do redesign e preparar ferramentas locais seguras.

Decisões adicionadas ao plano canônico:

- Corrigir a navegação principal bloqueada quando Settings está aberto no modo expanded.
- Concluir o snapshot de Profile por conversa (`PR03`) e o clipboard como bloco explícito do turn `user` (`PR04`).
- Concluir segunda órbita do radial (`A02`), resultado compacto (`R01`) e Context Bar orientada a permissões (`C01`).
- Aplicar o design system às páginas internas antes de mover Profiles, Workflows e Skills para Settings; seus contratos, dados, seleção contextual e execução permanecem ativos.
- Adicionar trabalho com arquivos e pastas em escopo autorizado, incluindo parsers locais para PDF, CSV, Excel e Markdown.
- Adicionar renderização Mermaid no chat e uma tool que valida sintaxe antes de retornar o diagrama.
- Migrar a implementação de OCR para o Vision Framework nativo da Apple, preservando a capacidade de OCR e adicionando classificação, barcode e saliência 100% on-device.
- Implementar memória persistente por Workspace, alinhada a `W03`; memória global transversal continua futura.
- Adicionar tools auditáveis de Git, shell e patch, com aprovação e limites de diretório.
- Adicionar contexto nativo explícito do macOS: app/janela ativa, notificações e informações seguras do sistema.

Novas unidades executáveis no plano: `CL01-CL05`, `FILE01-FILE02`, `MER01-MER02`, `VIS01`, `DEV01` e `DESK01`.

## Próximo Uso Deste Arquivo

- Registrar contexto histórico que explique por que uma decisão foi tomada.
- Não adicionar novos itens de implementação aqui.
- Quando uma decisão mudar, atualizar primeiro `PLANO.md` e só então resumir o histórico aqui se necessário.
