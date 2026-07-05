# Desktop Agent Backlog

## Objetivo

Transformar o prototipo em um agente pessoal leve para macOS, com uma interface menos terminal e mais utilitaria, ainda discreta, mas capaz de fazer mais do que processar o clipboard. A experiencia deve continuar rapida via teclado, com pet/status flutuante, menu bar e Pinstripes como provedor principal.

## Pesquisa usada

- Raycast e um produto keyboard-first; o manual lista `Command/Alt + Space` como atalho global padrao para abrir/fechar o app, entao manter `Option + Space` aqui tende a brigar com o fluxo do usuario. Fonte: https://manual.raycast.com/keyboard-shortcuts
- ChatGPT Desktop tambem usa `Option + Space` no macOS para abrir de qualquer tela, reforcando que esse atalho virou uma convencao ocupada por assistentes desktop. Fonte: https://chatgpt.com/features/desktop/
- Tauri ja oferece global shortcut, tray e janela sempre no topo, que sao exatamente os blocos que o app usa e deve manter. Fontes: https://v2.tauri.app/plugin/global-shortcut/ e https://v2.tauri.app/learn/system-tray/
- Raycast AI aponta bons padroes para este produto: acesso por hotkey, janela flutuante discreta, presets/modelos, anexos/contexto e comandos que viram acoes do sistema. Fonte: https://www.raycast.com/core-features/ai
- Raycast Notes reforca uma direcao boa para o pet: notas/scratchpad leves, menu bar, janela flutuante acima dos apps e comandos de IA sobre conteudo escrito. Fonte: https://www.raycast.com/core-features/notes
- Recursos que controlam o Mac por acessibilidade precisam ser explicados com clareza e permissao explicita, porque a Apple alerta que apps com esse acesso podem controlar o computador e acessar informacoes pessoais. Fonte: https://support.apple.com/guide/mac-help/allow-accessibility-apps-to-access-your-mac-mh43185/mac

## Estado atual observado

- App Tauri + React com janela principal transparente, `alwaysOnTop`, tray icon e global shortcut em `Option + Space`.
- UI atual: painel de 380x560, visual dark/glass, header com pet, tabs `COMMAND CORE` e `LOGS`, drawer de configuracao e sugestao baseada no clipboard.
- Pet atual: orb SVG com estados `connecting`, `thinking`, `success`, `error` e `idle`.
- Runtime: sidecar Bun, kkrpc, SQLite, provider gateway e tool registry.
- Ferramentas registradas: `text.rewrite`, `text.summarize`, `text.translate`, `desktop.clipboard`.
- Pinstripes ja aparece como provider com modelos estaticos `ps/warp`, `ps/thinking` e `ps/pro`.
- Worktree atual ja contem mudancas nao commitadas em arquivos centrais; preservar isso e commitar checkpoints pequenos por fatia.

## Direcao de produto

### Nome provisiorio

Usar `Desktop Agent` internamente por enquanto, mas a interface deve parar de parecer produto generico. A proposta visual pode tratar o agente como uma "mesa de comando pessoal": pequeno painel de captura, leitura e acao, sem hero, sem marketing e sem excesso decorativo.

### Comportamento principal

1. Abrir rapido por atalho global.
2. Detectar contexto disponivel: texto do clipboard, prompt digitado, historico recente e comandos rapidos.
3. Mostrar acoes de IA como uma camada de trabalho: escrever, resumir, traduzir, explicar, planejar, extrair tarefas e responder livremente.
4. Manter resultado editavel/copiavel, com historico e status claro do modelo.
5. Deixar o pet como entrada/status discreto, nao como decoracao central.

## Decisoes de UX

- Trocar o atalho global padrao de `Option + Space` para `Control + Shift + Space`.
- Mostrar o atalho novo em todos os hints da UI.
- Transformar o painel em layout de trabalho com regioes fixas:
  - topo: status, modelo ativo, colapso/pin/settings;
  - centro: composer com modo de entrada;
  - acoes: grid de comandos frequentes;
  - execucao: logs compactos e resultado;
  - fundo: historico/atalhos.
- Separar "acao rapida" de "prompt livre". O usuario nao deveria precisar lembrar comandos como se estivesse em terminal.
- Usar linguagem PT-BR natural: "Perguntar", "Melhorar texto", "Extrair tarefas", "Explicar", "Traduzir", "Copiar resultado".
- Settings devem tratar Pinstripes como principal: mostrar os 3 modelos com descricao curta e deixar OpenAI-compatible como opcao avancada.
- Qualquer futura acao que precise permissao de acessibilidade ou tela deve ter disclosure antes de pedir permissao.

## Direcao visual

### Tokens

- `ink`: `#101113`, fundo principal quase preto, menos azulado que o atual.
- `panel`: `#18191B`, superficies de trabalho.
- `paper`: `#F4EEE2`, texto/acento quente usado com parcimonia para leitura e contraste.
- `signal`: `#7CFFB2`, status ativo e sucesso.
- `amber`: `#F2B84B`, pensando/aviso.
- `violet`: `#8F7CFF`, assinatura Pinstripes/IA.

### Tipografia

- Corpo: system UI, para manter sensacao nativa macOS.
- Utilitario/dados: `ui-monospace`, apenas para modelo, logs, kbd e metadados.
- Display restrito: peso 650/700, letras normais, sem tracking negativo.

### Layout

```text
+--------------------------------------+
| pet  Desktop Agent       model  pin x |
+--------------------------------------+
| Ask anything...                       |
| [composer grande]                 run |
+--------------------------------------+
| Contexto detectado: clipboard/history |
| [Melhorar] [Resumir] [Traduzir]       |
| [Explicar] [Tarefas] [Responder]      |
+--------------------------------------+
| execucao compacta / resultado         |
+--------------------------------------+
| historico recente + shortcuts         |
+--------------------------------------+
```

### Assinatura

A assinatura deve ser uma "barra de sinais" fina ligada ao pet: uma linha viva que muda por estado e atravessa header/composer. Ela comunica que o agente esta ouvindo, pensando ou terminou, sem depender de card decorativo ou orb grande.

## Backlog de implementacao

### P0 - Checkpoint de planejamento

- [x] Ler objetivo do goal.
- [x] Pesquisar padroes externos.
- [x] Ler estrutura local do app.
- [ ] Commitar este backlog.

### P1 - Atalho e copia de interface

- [ ] Alterar atalho global em Rust de `Alt/Option + Space` para `Control + Shift + Space`.
- [ ] Atualizar todos os textos de UI que mencionam `Option + Space`.
- [ ] Se possivel, centralizar label do atalho para evitar divergencia futura.
- [ ] Validar que tray ainda abre/foca a janela.

### P1 - Redesign do shell

- [ ] Revisar dimensoes da janela expandida para comportar mais funcoes sem parecer modal pesado.
- [ ] Reorganizar header para status/modelo/acoes essenciais.
- [ ] Redesenhar pet colapsado como status compacto e arrastavel.
- [ ] Remover excesso de linguagem terminal (`COMMAND CORE`, `$`, `ERROR`) onde isso atrapalha uso diario.
- [ ] Manter foco de teclado e estados `streaming`, `error`, `success`.

### P1 - Acoes de IA alem do clipboard

- [ ] Expandir quick actions para pelo menos:
  - perguntar livremente sem clipboard obrigatorio;
  - explicar texto;
  - extrair tarefas;
  - responder mensagem/email;
  - transformar em checklist;
  - resumir em bullets.
- [ ] Adaptar prompt/orchestrator para nao sempre assumir que clipboard e o centro da tarefa.
- [ ] Mostrar quando uma acao vai usar clipboard e quando vai usar apenas o prompt.
- [ ] Tratar clipboard vazio como estado normal, nao como falha.

### P2 - Pinstripes como provedor principal

- [ ] Mostrar modelos `ps/warp`, `ps/thinking`, `ps/pro` com descricoes:
  - Warp: rapido e melhor custo;
  - Thinking: raciocinio mais profundo;
  - Pro: respostas mais deliberadas.
- [ ] Permitir escolher o modelo Pinstripes, nao apenas travar em `ps/warp`.
- [ ] Persistir escolha do modelo.
- [ ] Ajustar badge ativo para ser legivel e menos tecnico.

### P2 - Historico e scratchpad

- [ ] Tornar historico recente mais acessivel no fluxo principal.
- [ ] Adicionar um modo simples de scratchpad local ou preparar espaco visual para isso.
- [ ] Permitir copiar resultado, copiar prompt e limpar conversa.
- [ ] Evitar que logs tecnicos dominem a tela em tarefas simples.

### P3 - Permissoes futuras

- [ ] Mapear funcoes de futuro que exigem Accessibility, Screen Recording ou File System.
- [ ] Criar texto de disclosure antes de pedir permissao.
- [ ] Nao implementar controle do Mac sem confirmar limites e permissoes.

## Criterios de aceite

- O app nao usa mais `Option + Space` como atalho padrao.
- A primeira tela deve ser o produto utilizavel, nao landing page ou explicacao.
- O painel deve funcionar bem sem texto no clipboard.
- Pinstripes deve parecer o provedor principal, com modelo selecionavel.
- Acoes rapidas devem cobrir tarefas leves reais do dia a dia, nao apenas rewrite/summarize/translate.
- UI nao pode parecer terminal de debug como fluxo principal.
- Pet deve comunicar status e abrir o painel sem atrapalhar a area de trabalho.
- Lint/typecheck/test devem ser rodados ao final de edicoes, se viaveis.

## Checkpoints de commit previstos

1. `docs: add desktop agent redesign backlog`
2. `feat: update global shortcut and agent shell copy`
3. `feat: redesign desktop agent command surface`
4. `feat: add broader personal agent quick actions`
5. `feat: improve pinstripes model selection`
6. `chore: verify desktop agent release slice`
