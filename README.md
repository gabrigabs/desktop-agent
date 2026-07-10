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

Copy text, press `Control+Shift+Space`, type what you want, and Helix does the rest.

## Features

- **Floating command surface** — a compact, always-on-top window with three modes: collapsed seed, normal panel, and expanded workspace.
- **Keyboard-first** — global shortcut, radial launcher, and composer-first navigation keep you on the keyboard.
- **Context-aware** — optional clipboard context, screen awareness, and active-app context with explicit permission disclosures.
- **Multi-turn chat** — persistent conversations, streaming assistant responses, and Markdown rendering.
- **Local-first tools** — text tools, desktop actions, and local SQLite storage with FTS5.
- **Pluggable providers** — Pinstripes-first model selection with OpenAI-compatible and mock providers.
- **Workflow engine** *(foundation)* — persistent multi-step runs with plan, act, observe, approval, and resume loops.
- **Artifacts** *(foundation)* — specialized assistants for finance, code, writing, studies, and product work.
- **MCP connectors** *(foundation)* — extensible tool registration for external servers and services.

## Quick Start

Requires **macOS**, **Rust 1.77+**, **Bun 1.3+**, and **Xcode Command Line Tools**.

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

## Tech Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Desktop shell    | Tauri 2, Rust                                           |
| UI               | React 19, Vite 7, Tailwind CSS 4, Zustand               |
| Agent runtime    | Bun, TypeScript                                         |
| IPC              | kkrpc (type-safe bidirectional RPC over stdio)          |
| Storage          | SQLite + FTS5 (via bun:sqlite)                          |
| Providers        | Pinstripes, OpenAI-compatible, Mock                       |

## Environment

| Variable         | Description                                   | Default                     |
| ---------------- | --------------------------------------------- | --------------------------- |
| `AGENT_PROVIDER` | Provider type (`mock` or `openai-compatible`) | `mock`                      |
| `AGENT_API_KEY`  | API key for provider                          | -                           |
| `AGENT_BASE_URL` | Base URL for provider                         | `https://api.openai.com/v1` |
| `AGENT_MODEL`    | Model name                                    | `gpt-4o`                    |

## License

Helix is released under the [MIT License](LICENSE).
