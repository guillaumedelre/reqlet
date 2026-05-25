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

### `agent/`

Standalone Go HTTP server (`reqlet-agent` binary). It:

- Embeds `agent/web/` via `go:embed all:web` and serves the React SPA at `/`
  (`agent/web/` is populated from `gui/web/dist/` during the Docker build)
- Exposes a REST API (`/api/...`) equivalent to the Wails bindings in `gui/`
- Delegates request execution to `engine/http` and script execution to `engine/sandbox`
- Stores data in a SQLite file at `/data/reqlet.db` (Docker) or `~/.reqlet/reqlet.db` (standalone)
- Listens on `:8080` internally; exposed on host port `3001` via Docker Compose (`"3001:8080"`)

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
embedded into the Go binary via `go:embed` — no Node.js installation required
on the end user's machine.

## Data flow (request execution)

```
User (GUI, CLI, or web agent)
     │
     ▼
engine/loader          ← LoadCollection / LoadEnvironment / LoadData
     ├── engine/parser     parse + validate against JSON Schema (per format)
     └── engine/migration  transform v1.0 / v2.0 → v2.1 internal model
     │
     ▼
engine/runner ──── resolves variables ──── engine/variables
     │
     ├── pre-request script ──── engine/sandbox ──── node-runner process
     │
     ├── sends HTTP request ─────────────────────── engine/http
     │
     ├── post-response script ── engine/sandbox ──── node-runner process
     │
     └── persists history ────────────────────────── engine/storage
```

## Frontend transport abstraction

`gui/web/src/lib/backend.ts` provides a unified call interface used by
all React components. It detects the runtime context at startup:

```
Running in Wails WebView?
  → window.go.main.App.SendRequest(...)   (Wails IPC binding)

Running in browser (served by reqlet-agent)?
  → fetch("/api/send", { method: "POST", body: ... })
```

This keeps the React codebase identical regardless of the host.

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
