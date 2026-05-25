# Architecture

## Overview

Reqlet is a monorepo with a single `go.mod`. The codebase is split into five
distinct layers that share no circular dependencies:

```
engine/       ← shared Go library (business logic)
cli/          ← CLI binary (cobra) → binary: reqlet-cli
gui/          ← Wails v2 desktop app → binary: reqlet
agent/        ← web agent (Go HTTP server) → binary: reqlet-agent
node-runner/  ← Node.js process (pm.* sandbox), communicates via stdio JSON
```

```mermaid
graph TD
    Engine["engine/
    shared library"]
    CLI["cli/ → reqlet-cli"]
    GUI["gui/ → reqlet"]
    Agent["agent/ → reqlet-agent"]
    NodeRunner["node-runner/
    pm.* sandbox"]
    WebUI["gui/web/
    React SPA"]

    CLI --> Engine
    GUI --> Engine
    Agent --> Engine
    Engine --> NodeRunner
    GUI -. embeds .-> WebUI
    Agent -. embeds .-> WebUI
```

## Component breakdown

### `engine/`

The core library. All business logic lives here and is reused by the CLI,
the GUI backend, and the web agent. Sub-packages follow a single
responsibility principle:

| Package | Responsibility |
|---------|---------------|
| `engine/parser` | Read and validate Postman collection files; detect format version (v1.0/v2.0/v2.1); enforce official JSON Schema for v2.0 and v2.1 (schemas embedded via `go:embed`) |
| `engine/migration` | Transform parsed v1.0 and v2.0 collections into the v2.1 internal model |
| `engine/loader` | Single entry point for callers (CLI, GUI, agent): `LoadCollection` (parse + migrate → v2.1), `LoadEnvironment`, `LoadData` (CSV/JSON → `[]map[string]string`) |
| `engine/runner` | Orchestrate request execution (ordering, iterations, data injection) |
| `engine/reporter` | Output formatters: terminal (ANSI colours), JSON, JUnit/XML |
| `engine/http` | Execute HTTP requests (`net/http`, redirects, TLS, proxy, client certificates) |
| `engine/variables` | Resolve `{{variable}}` across the five Postman scopes |
| `engine/auth` | Auth strategies (Bearer, Basic, Digest, OAuth 2.0, AWS SigV4…) |
| `engine/storage` | SQLite persistence via `modernc.org/sqlite` + `sqlc` + `golang-migrate` |
| `engine/sandbox` | Lifecycle management of the `node-runner` process (os/exec, IPC) |

### `cli/`

Single binary (`reqlet-cli`). Built with [cobra][cobra]. Has no business logic of its own;
delegates everything to `engine/`. Distributed as:

- Platform binaries (GitHub Releases): Linux x64/arm64, macOS Intel/ARM, Windows x64
- Docker image: `ghcr.io/guillaumedelre/reqlet`

### `gui/`

[Wails v2][wails] desktop application (`reqlet` binary). The Go backend exposes methods to the
React frontend via Wails bindings (`window.go.*`). The frontend communicates
back via those bindings and via `runtime.EventsEmit` / `runtime.EventsOn`.

The WebView is provided by the OS (WKWebView on macOS, WebView2 on Windows,
WebKit2GTK on Linux) — no Chromium bundled.

`gui/web/` contains the React TypeScript frontend (Vite, Tailwind v4, shadcn/ui,
Zustand). It is **not a standalone deployable** — it is a build artefact consumed
by two targets:

- `gui/` embeds `gui/web/dist/` directly via `//go:embed all:web/dist` (Wails)
- `agent/` receives a copy of `gui/web/dist/` during its Docker build, then
  embeds it via `//go:embed all:web`

Both targets run the same React codebase; `gui/web/src/lib/backend.ts` detects
at runtime whether it is running inside the Wails WebView or served by
`reqlet-agent`.

### `agent/`

Standalone Go HTTP server (`reqlet-agent` binary). It:

- Embeds `agent/web/` via `go:embed all:web` and serves the React SPA at `/`
  (`agent/web/` is populated from `gui/web/dist/` during the Docker build)
- Exposes a REST API (`/api/...`) equivalent to the Wails bindings in `gui/` (Phase 2.14 — in progress)
- Will delegate request execution to `engine/http` and script execution to `engine/sandbox`
- Stores data in a SQLite file at `/data/reqlet.db` (Docker) or `~/.reqlet/reqlet.db` (standalone)
- Listens on `:8080` internally; exposed on host port `3001` via Docker Compose (`"3001:8080"`)

**Implemented endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness probe — returns `{"status":"ok"}` (HTTP 200) |
| `GET` | `/` | Serves the embedded React SPA (`index.html`) |
| `ANY` | `/api/*` | 404 — placeholder for Phase 2.14 REST routes |

The frontend auto-detects its runtime context via `gui/web/src/lib/backend.ts`: when
running inside the Wails WebView it calls `window.go.*`, when served by
`reqlet-agent` it calls `fetch("/api/...")`. The React codebase is shared
between both.

`reqlet-agent` is distributed as:

- Platform binaries (GitHub Releases): Linux x64/arm64, macOS Intel/ARM, Windows x64
- Docker image: `ghcr.io/guillaumedelre/reqlet-agent`

### `node-runner/`

A Node.js process that implements the [Postman sandbox][pm-sandbox] (`pm.*`
API). Go starts it as a child process (`os/exec`) and communicates via
newline-delimited JSON over stdio. Packaged as a [Node SEA][node-sea] and
embedded into `engine/sandbox` via `go:embed` — which means the SEA is bundled
into all three Go binaries (`reqlet-cli`, `reqlet`, `reqlet-agent`). No
Node.js installation is required on the end user's machine.

## Data flow (request execution)

```mermaid
flowchart TD
    U["User
    GUI / CLI / Agent"]
    L["engine/loader
    LoadCollection · LoadEnvironment · LoadData"]
    P["engine/parser
    validation JSON Schema"]
    M["engine/migration
    v1.0 / v2.0 → v2.1"]
    R["engine/runner
    orchestration"]
    V["engine/variables
    {{var}} resolution"]
    Pre["engine/sandbox
    pre-request script"]
    H["engine/http
    HTTP request"]
    Post["engine/sandbox
    post-response script"]
    S["engine/storage
    SQLite history"]
    NR["node-runner
    pm.* API"]

    U --> L
    L --> P & M
    P & M --> R
    R <--> V
    R --> Pre
    Pre <--> NR
    R --> H
    R --> Post
    Post <--> NR
    R --> S
```

## Frontend transport abstraction

_(Phase 2.14 — not yet implemented)_

`gui/web/src/lib/backend.ts` will provide a unified call interface for all React
components. It will detect the runtime context at call time:

```mermaid
flowchart TD
    B["gui/web/src/lib/backend.ts"]
    Q{"window.go present?
    (Wails WebView)"}
    W["window.go.main.App.*
    Wails IPC binding"]
    F["fetch('/api/...')
    reqlet-agent REST API"]

    B --> Q
    Q -- yes --> W
    Q -- no --> F
```

This will keep the React codebase identical regardless of whether it runs inside
the Wails desktop app or is served by `reqlet-agent`.

## Storage

All local data (collections, environments, history, settings) lives in a single
SQLite file:

| Context | Path |
|---------|------|
| Desktop GUI / CLI | `~/.reqlet/reqlet.db` (or `$XDG_DATA_HOME/reqlet/` on Linux) |
| reqlet-agent (Docker) | `/data/reqlet.db` (mount a named volume) |
| reqlet-agent (standalone) | `~/.reqlet/reqlet.db` |

Schema migrations are versioned with [golang-migrate][golang-migrate] and run
automatically at startup. Queries are type-safe Go code generated by
[sqlc][sqlc] from `.sql` files.

`modernc.org/sqlite` is used instead of `mattn/go-sqlite3` to avoid CGo and
simplify cross-compilation.

## Build matrix

| Artefact | How |
|----------|-----|
| CLI — Linux x64/arm64 | GitHub Actions `ubuntu-latest` |
| CLI — macOS Intel/ARM | GitHub Actions `macos-latest` |
| CLI — Windows x64 | GitHub Actions `windows-latest` |
| Agent — Linux x64/arm64 | `Dockerfile.agent` (multi-arch) |
| Agent — macOS Intel/ARM | GitHub Actions `macos-latest` |
| Agent — Windows x64 | GitHub Actions `windows-latest` |
| GUI — Linux | `Dockerfile.gui` (WebKit2GTK in container) |
| GUI — macOS | GitHub Actions `macos-latest` (Wails) |
| GUI — Windows | GitHub Actions `windows-latest` (Wails) |

[cobra]: https://github.com/spf13/cobra
[wails]: https://wails.io
[pm-sandbox]: https://learning.postman.com/docs/writing-scripts/script-references/postman-sandbox-api-reference/
[node-sea]: https://nodejs.org/api/single-executable-applications.html
[golang-migrate]: https://github.com/golang-migrate/migrate
[sqlc]: https://sqlc.dev
