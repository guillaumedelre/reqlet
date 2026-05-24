# Development guide

## Prerequisites

- [Docker][docker] (with Compose v2 plugin)
- `make`
- An editor — the project ships an `.editorconfig`

Nothing else needs to be installed on the host. All tooling runs inside
containers.

## First-time setup

```bash
# Install Go module dependencies (writes go.sum)
docker compose run --rm go go mod download

# Install Node.js dependencies for node-runner/
docker compose run --rm node npm install

# Install Node.js dependencies for gui/frontend/
docker compose run --rm frontend npm install
```

## Daily commands

The **Makefile** is the primary entry point. It wraps `docker compose run --rm`
for every operation:

```bash
make help            # list all targets
make build-cli       # build dist/reqlet-cli
make test-all        # full test suite (engine/ + cli/)
make test-unit       # unit tests only
make test-integration
make test-coverage   # generates coverage.html
make go-lint         # golangci-lint
make go-fmt          # apply gofumpt
make go-check        # check formatting without modifying
make shell-go        # interactive Go shell
make shell-node      # interactive Node.js shell (node-runner/)
```

### Go test scope

Tests cover `./engine/...` and `./cli/...` only. `gui/` requires GTK headers
and is compiled separately via `Dockerfile.gui`.

### Go (engine/, cli/) — direct docker compose commands

```bash
# Interactive Go shell
docker compose run --rm go sh

# Run all tests
docker compose run --rm test

# Run tests with coverage report
docker compose run --rm test gotestsum -- -coverprofile=coverage.out -covermode=atomic ./engine/... ./cli/...

# Run unit tests only (exclude integration)
docker compose run --rm test gotestsum -- -tags=!integration ./engine/... ./cli/...

# Run integration tests only
docker compose run --rm test gotestsum -- -tags=integration ./engine/... ./cli/...

# Lint (golangci-lint via official image)
docker compose run --rm lint

# Check formatting (no changes applied)
docker compose run --rm go gofumpt -l .

# Apply formatting
docker compose run --rm go gofumpt -w .

# Build CLI binary to dist/
docker compose run --rm build-cli

# Generate mocks from an interface
docker compose run --rm go mockgen \
  -source=engine/runner/runner.go \
  -destination=engine/runner/mock_runner_test.go \
  -package=runner
```

### Node.js (node-runner/)

```bash
# Interactive Node.js shell
docker compose run --rm node sh

# Lint
docker compose run --rm node npm run lint

# Tests
docker compose run --rm node npm test
```

### Frontend (gui/frontend/)

```bash
# Start Vite dev server (accessible at http://localhost:5173)
docker compose up frontend

# Format (apply)
docker compose run --rm frontend npm run format

# Format (check only, no changes)
docker compose run --rm frontend npm run format:check

# Lint
docker compose run --rm frontend npm run lint

# Type-check and build
docker compose run --rm frontend npm run build

# Run tests
docker compose run --rm frontend npm test

# Run tests in watch mode
docker compose run --rm frontend npm run test:watch

# Run tests with coverage report (html + lcov in coverage/)
docker compose run --rm frontend npm run test:coverage

# Add a shadcn/ui component
docker compose run --rm frontend npx shadcn@latest add <name>
```

#### Code style

Formatting is handled by **Prettier** (`.prettierrc`) — no semicolons, double quotes, 2-space indent, 100-char line width. The ESLint config extends `eslint-config-prettier` to disable any conflicting rules.

#### Tests

Tests use **Vitest** with `jsdom` environment and **React Testing Library**. Files are colocated: `src/store/ui.test.ts` next to `src/store/ui.ts`. Coverage threshold is 80% (lines, functions, branches) — enforced locally and in CI.

| Script | What it does |
|---|---|
| `npm test` | Single run, no coverage |
| `npm run test:watch` | Interactive watch mode |
| `npm run test:coverage` | With HTML + lcov report |
| `npm run test:ci` | Verbose + JUnit XML + coverage (used in CI) |

## GUI development

`wails dev` (hot-reload) requires a display server — it cannot run in a
container.

The recommended workflow:

1. Run `docker compose up frontend` for the React side (Vite on port 5173).
   The Wails bindings (`window.go.*`) are mocked in the frontend so it works
   without the Go backend.
2. Develop Go backend code in the `go` container as usual.
3. Run `docker compose run --rm go wails generate types` to regenerate
   TypeScript types from Go structs whenever a bound method changes.

Linux GUI binaries are built via `Dockerfile.gui` (builds the frontend via
`npm ci && npm run build`, then `go build ./gui/...`). macOS and Windows builds
run on native GitHub Actions runners.

## Running what CI runs

Before opening a PR, replicate the four CI jobs locally:

```bash
# 1. go — formatting, lint, tests
docker compose run --rm go gofumpt -l . | tee /tmp/gofumpt.out && test ! -s /tmp/gofumpt.out
docker compose run --rm lint
docker compose run --rm test

# 2. frontend — format, lint, build, tests
docker compose run --rm frontend npm run format:check
docker compose run --rm frontend npm run lint
docker compose run --rm frontend npm run build
docker compose run --rm frontend npm run test:ci

# 3. node-runner — lint + tests
docker compose run --rm node npm run lint
docker compose run --rm node npm test

# 4. docker — build images
docker build -f Dockerfile.dev .
docker build -f Dockerfile .
docker build -f Dockerfile.gui .
```

## Project structure

```
reqlet/
├── engine/          # Shared Go library (business logic)
├── cli/             # CLI binary → binary: reqlet-cli
├── gui/             # Wails desktop app → binary: reqlet
│   └── frontend/    # React + TypeScript (Vite, Tailwind v4, shadcn/ui, Zustand)
├── node-runner/     # Node.js pm.* sandbox
├── docs/            # This documentation
├── .github/         # CI workflows, issue templates, dependabot
├── compose.yaml     # Dev environment
├── Makefile         # Local build & dev shortcuts (wraps docker compose)
├── Dockerfile       # CLI production image
├── Dockerfile.dev   # Dev image (Go + Node.js + tools)
└── Dockerfile.gui   # GUI Linux build (WebKit2GTK + Wails, builds frontend first)
```

See [architecture.md](architecture.md) for a deeper look at the component model.

[docker]: https://docs.docker.com/get-docker/
