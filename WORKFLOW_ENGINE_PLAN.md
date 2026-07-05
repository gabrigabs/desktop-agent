# Workflow Engine And Connectors Plan

## Objective

Build the next Desktop Agent phase around persistent runs instead of isolated prompt actions. The app should keep the quick assistant flow, while adding an advanced workflow mode that can plan, execute, observe, ask for approval and resume.

## Product Decisions

- First milestone: workflow engine.
- Execution modes: `simple` and `workflow`.
- Advanced loop: `plan -> act -> observe -> replan/finish`.
- Default safety: ask before sensitive actions.
- Integration strategy: local-first tools with optional external APIs.
- Default workflow limits: 8 steps and the existing app timeout setting.

## Runtime Contract

- Persist workflow state in SQLite using `workflow_runs`, `workflow_steps`, `workflow_templates` and `mcp_servers`.
- Add shared types for execution mode, run status, workflow runs, workflow steps, templates, connector config and approval requests.
- Keep `runAgent` compatible for the current simple UI path.
- Add run APIs for start, cancel, inspect, list, resume, capability listing and MCP server management.
- Emit workflow events in the existing event stream so the UI can render a timeline without polling.

## Safety Model

- Tool permission levels expand beyond `local.read`, `local.write` and `external`.
- Sensitive permissions are `network`, `browser.control`, `screen.read` and `external`.
- Workflow mode can pause with `waiting_approval`; simple mode should avoid sensitive tools unless explicitly requested.
- MCP servers are disabled by default and must expose masked environment variables in UI/API responses.

## Initial Capabilities

- Local web tools: `web.search`, `web.extract`, `web.crawl`.
- OCR tools: local image OCR and a screenshot disclosure stub before any screen capture.
- MCP presets: Playwright, scoped filesystem, SQLite read-only, GitHub, Brave Search, Tavily and Firecrawl.
- Internal hooks: `run_start`, `before_tool`, `after_tool`, `before_finish`, `waiting_for_input`.

## Checkpoint Sequence

1. `docs: plan workflow engine and connectors`
2. `feat: add workflow run persistence`
3. `feat: expose workflow run api`
4. `feat: add simple and workflow execution modes`
5. `feat: add approval and cancellation aware loop`
6. `feat: add mcp connector manager`
7. `feat: add local web and scraping tools`
8. `feat: add screenshot ocr workflow`
9. `chore: verify desktop workflow slice`

## Verification

- Run focused storage/runtime tests after persistence and API work.
- Run UI build after mode/timeline work.
- Final verification: `bun run typecheck`, `bun run lint`, `bun test`, `bun run --cwd apps/desktop build`, `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`, `bun run build:sidecar`.
