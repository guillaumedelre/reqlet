# Contributing to Reqlet

Thank you for your interest in contributing!

## Prerequisites

Only [Docker][docker] is required. No Go, Node.js, Wails, or other tools need to be installed on your host machine.

## Setup

```bash
git clone git@github.com:guillaumedelre/reqlet.git
cd reqlet
```

## Development workflow

All commands run inside Docker containers:

```bash
# Go dev shell (engine/, cli/, agent/)
docker compose run --rm go sh

# Run tests
docker compose run --rm test

# Run linter
docker compose run --rm lint

# Build CLI binary
docker compose run --rm build-cli

# Node.js shell (runner/)
docker compose run --rm node sh

# Frontend dev server — accessible at http://localhost:5173
docker compose up web

# Web agent (full stack, embedded web UI) — accessible at http://localhost:3001
docker compose up agent
```

See [docs/development.md](docs/development.md) for a full guide.

## Commit messages

This project follows [Conventional Commits v1.0.0][conventional-commits].

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | No feature or fix |
| `test` | Tests only |
| `ci` | CI/CD changes |
| `chore` | Maintenance |

Examples:

```
feat(engine): add collection v2.1 parser
fix(runner): prevent duplicate execution on retry
docs: update Newman migration guide
ci: add arm64 runner to release matrix
```

## Pull request process

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes
3. Run checks locally before pushing:
   ```bash
   # Go — format, lint, unit tests
   docker compose run --rm go gofumpt -l . | tee /tmp/gofumpt.out && test ! -s /tmp/gofumpt.out
   docker compose run --rm lint
   docker compose run --rm test

   # Go — functional tests (N2, requires node)
   docker compose run --rm test gotestsum -- -tags=functional ./engine/... ./cli/...

   # Frontend
   docker compose run --rm web npm run format:check
   docker compose run --rm web npm run lint
   docker compose run --rm web npm run test:ci

   # Runner
   docker compose run --rm node npm run lint
   docker compose run --rm node npm test
   ```
4. Open a PR against `main` — fill in the PR template
5. All CI checks must pass and all conversations must be resolved before merging

## Code standards

- **Go** — formatted with `gofumpt`, linted with `golangci-lint` (zero warnings tolerated)
- **TypeScript** — strict mode, linted with ESLint
- **Tests** — `_test.go` files alongside source, coverage ≥ 80% on `engine/`; functional tests (N2) use `//go:build functional` and require `node` in PATH
- **Documentation** — any change affecting user-facing behavior must update `docs/` in the same PR

## Reporting issues

- **Bug**: use the [bug report template][bug-template]
- **Feature**: use the [feature request template][feature-template]
- **Security vulnerability**: see [SECURITY.md](SECURITY.md)

[docker]: https://docs.docker.com/get-docker/
[conventional-commits]: https://www.conventionalcommits.org/en/v1.0.0/
[bug-template]: https://github.com/guillaumedelre/reqlet/issues/new?template=bug_report.md
[feature-template]: https://github.com/guillaumedelre/reqlet/issues/new?template=feature_request.md
