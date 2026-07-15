<div align="center">

<pre align="center" style="color: #c499f4; line-height: 1.1;">
██╗  ██╗███████╗██╗     ██╗██╗  ██╗
██║  ██║██╔════╝██║     ██║╚██╗██╔╝
███████║█████╗  ██║     ██║ ╚███╔╝ 
██╔══██║██╔══╝  ██║     ██║ ██╔██╗ 
██║  ██║███████╗███████╗██║██╔╝ ██╗
╚═╝  ╚═╝╚══════╝╚══════╝╚═╝╚═╝  ╚═╝ 
</pre>

# Helix

**A lightweight, keyboard-first macOS copilot that lives in a floating command surface.**

[![License](https://img.shields.io/badge/license-MIT-c499f4.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-5fd0a0.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Bun](https://img.shields.io/badge/Bun-1.3-f0a040.svg)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org)

</div>

## Overview

Helix is a macOS desktop assistant designed to feel like a natural extension of your workspace. It sits quietly in a small, floating window until you summon it with a global shortcut, then helps you act on selected text, clipboard content, or quick ideas without leaving your flow.

The packaged native bundle targets **macOS 13.0 or newer**. Vision, screen capture and Accessibility stay inside the Tauri host; the agent sidecar receives only typed, derived context.

Copy text, press `Control+Shift+Space`, type what you want, and Helix does the rest.

## Features

- **Floating command surface** — a compact, always-on-top window with three modes: collapsed seed, normal panel, and expanded workspace.
- **Keyboard-first** — global shortcut (`Control+Shift+Space`), system tray integration, and composer-first navigation keep you on the keyboard.
- **Context-aware** — optional clipboard context, screen capture, and active-app context with explicit permission disclosures.
- **Multi-turn chat** — persistent conversations, streaming assistant responses, and Markdown rendering with syntax highlighting.
- **Workflow engine** — persistent multi-step runs with plan, act, observe, approval, and resume loops.
- **Skills** — specialized assistant profiles with custom system prompts, tones, response styles, and constraints.
- **Spaces** — workspace organization with collections, records, views, and customization.
- **Prompt library** — saved and reusable prompt templates.
- **Follow-up sessions** — persistent observation tracking with hypothesis management and approval workflows.
- **MCP connectors** — extensible tool registration for external MCP servers with permission policies and environment variable expansion.
- **Pluggable providers** — Pinstripes, OpenAI-compatible, and Mock providers with configurable models and timeouts.
- **Local-first tools**:
  - **Text** — rewrite, summarize, translate, and Mermaid diagram generation.
  - **Desktop** — clipboard, file read/write, file patch, shell execution, and Git diff/log/status.
  - **Native** — desktop app control, notifications, and system context via Tauri.
  - **Web** — search (Brave/Tavily/Jina), URL extraction (local/Firecrawl/Jina), and crawling.
  - **Vision/OCR** — on-device image OCR, screen capture analysis with text, classification, barcode, and saliency features.
- **Document parsing** — PDF, DOCX, and other formats via LiteParse with AI-powered document improvement.
- **i18n** — Portuguese (pt-BR) and English (en) interface.
- **Local storage** — SQLite with FTS5 full-text search, 20 migrations, and repositories for conversations, workflows, skills, spaces, MCP servers, parsed documents, prompt templates, and follow-up sessions.

## Quick Start

Requires **macOS 13+**, **Rust 1.77+**, **Bun 1.3+**, and **Xcode Command Line Tools**.

```bash
# Install dependencies
bun install

# Build the agent sidecar
bun run build:sidecar

# Run in development mode
bun run desktop:dev
```

Common commands:

| Command                  | Description                     |
| ------------------------ | ------------------------------- |
| `bun install`            | Install all dependencies        |
| `bun run build:sidecar`  | Compile agent runtime to binary |
| `bun run desktop:dev`    | Start Tauri dev mode            |
| `bun run desktop:build`  | Build distributable app         |
| `bun test`               | Run all tests                   |
| `bun run lint`           | Lint all code                   |
| `bun run format`         | Format all code                 |
| `bun run typecheck`      | Type-check all packages         |

## Project Structure

```
desktop-agent/
├── apps/
│   └── desktop/              # Tauri 2 + React 19 desktop app
│       ├── src/              # Frontend (surfaces, components, hooks, stores)
│       └── src-tauri/        # Rust native shell (Vision, clipboard, shortcuts, tray)
├── packages/
│   ├── agent-runtime/        # Agent runtime (workflow engine, MCP, orchestrator, parser)
│   ├── provider-gateway/     # LLM provider abstraction (Mock, OpenAI-compatible, Pinstripes)
│   ├── shared/               # Shared types, schemas, and utilities
│   ├── storage/              # SQLite storage with migrations and repositories
│   ├── tool-registry/        # Tool registration and discovery
│   ├── tools-desktop/        # Desktop tools (clipboard, file, git, shell, patch, native)
│   ├── tools-text/           # Text tools (rewrite, summarize, translate, mermaid)
│   ├── tools-web/            # Web tools (search, extract, crawl)
│   ├── tools-ocr/            # Vision/OCR tools (image OCR, screen capture)
│   └── lite-parse/           # Document parsing via LiteParse
├── tests/                    # Integration and end-to-end tests
└── docs/                     # Documentation
```

## Tech Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Desktop shell    | Tauri 2, Rust                                           |
| UI               | React 19, Vite 7, Tailwind CSS 4, Zustand, Lucide icons |
| Markdown         | react-markdown, remark-gfm, react-syntax-highlighter    |
| Agent runtime    | Bun, TypeScript                                         |
| IPC              | kkrpc (type-safe bidirectional RPC over stdio)          |
| Storage          | SQLite + FTS5 (via bun:sqlite)                          |
| Document parsing | LiteParse (via @llamaindex/liteparse)                   |
| Providers        | Pinstripes, OpenAI-compatible, Mock                     |

## Environment

| Variable         | Description                                          | Default                     |
| ---------------- | ---------------------------------------------------- | --------------------------- |
| `AGENT_PROVIDER` | Provider type (`mock`, `pinstripes`, `openai-compatible`) | `mock`                      |
| `AGENT_API_KEY`  | API key for provider                                 | -                           |
| `AGENT_BASE_URL` | Base URL for provider                                | `https://api.openai.com/v1` |
| `AGENT_MODEL`    | Model name                                           | `gpt-4o`                    |

## License

Helix is released under the [MIT License](LICENSE).
