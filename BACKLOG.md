# Histórico Do Backlog Helix

> Este arquivo não é mais a fonte principal de planejamento.
> Use [PLANO.md](/Users/gabrielbezerrarodrigues/dev/desktop-agent/PLANO.md) como fonte de verdade do produto.

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

## Próximo Uso Deste Arquivo

- Registrar contexto histórico que explique por que uma decisão foi tomada.
- Não adicionar novos itens de implementação aqui.
- Quando uma decisão mudar, atualizar primeiro `PLANO.md` e só então resumir o histórico aqui se necessário.
