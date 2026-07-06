# Helix

Lightweight macOS copilot with a floating command surface, optional clipboard context, Pinstripes-first model selection, and local AI tool execution.

See [PLANO.md](/Users/gabrielbezerrarodrigues/dev/desktop-agent/PLANO.md) for the current product plan. [BACKLOG.md](/Users/gabrielbezerrarodrigues/dev/desktop-agent/BACKLOG.md) is kept as historical context.

## Architecture

```
Tauri/Rust Desktop Shell
  └─ React UI (command palette, result previews)
       └─ kkrpc (type-safe IPC over stdio)
            └─ Bun Agent Runtime
                 ├─ tool registry
                 ├─ provider gateway (mock, OpenAI-compatible)
                 ├─ SQLite storage + FTS5
                 └─ text tools (rewrite, summarize, translate)
```

## Prerequisites

- **Rust** 1.77+ (`rustup`)
- **Bun** 1.3+
- **Xcode Command Line Tools** (macOS)
- **Node.js** 20+ (only for npm packages, runtime is Bun)

## Quick Start

```bash
# Install dependencies
bun install

# Build the agent sidecar
bun run build:sidecar

# Run in development mode
bun run desktop:dev
```

## Project Structure

```
desktop-agent/
  apps/
    desktop/           # Tauri + React desktop app
      src/              # React UI (command palette, stores)
      src-tauri/        # Rust host (lifecycle, shortcuts, clipboard)
  packages/
    shared/             # Shared types and schemas
    storage/            # SQLite database and repositories
    provider-gateway/   # LLM provider adapters (mock, OpenAI-compatible)
    tool-registry/      # Tool registration and discovery
    tools-text/         # Text tools (rewrite, summarize, translate)
    tools-desktop/      # Desktop tools (clipboard, files, selection)
    agent-runtime/      # Bun sidecar entry point + orchestrator
```

## MVP Flow

```
Copy text → Control+Shift+Space → type "melhore isso" → Enter
  → Helix reads clipboard when relevant
  → Executes text.rewrite tool
  → Provider generates response
  → UI shows preview
  → Click "Copy" → result written to clipboard
  → Audit log recorded in SQLite
```

## Commands

| Command                  | Description                     |
| ------------------------ | ------------------------------- |
| `bun install`            | Install all dependencies        |
| `bun run build:sidecar`  | Compile agent runtime to binary |
| `bun run desktop:dev`    | Start Tauri dev mode            |
| `bun run desktop:build`  | Build distributable app         |
| `bun run build:packages` | Typecheck all workspaces        |
| `bun test`               | Run all tests                   |
| `bun run lint`           | Lint all code                   |
| `bun run format`         | Format all code                 |

## Environment

| Variable         | Description                                   | Default                     |
| ---------------- | --------------------------------------------- | --------------------------- |
| `AGENT_PROVIDER` | Provider type (`mock` or `openai-compatible`) | `mock`                      |
| `AGENT_API_KEY`  | API key for provider                          | -                           |
| `AGENT_BASE_URL` | Base URL for provider                         | `https://api.openai.com/v1` |
| `AGENT_MODEL`    | Model name                                    | `gpt-4o`                    |

## Tech Stack

- **Desktop**: Tauri 2, Rust
- **UI**: React 19, Vite 7, Tailwind CSS 4, Zustand
- **Agent Runtime**: Bun, TypeScript
- **IPC**: kkrpc (type-safe bidirectional RPC over stdio)
- **Storage**: SQLite + FTS5 (via bun:sqlite)
- **Providers**: Mock, OpenAI-compatible (extensible to Anthropic, Ollama)
