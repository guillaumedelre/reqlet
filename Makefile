# Colors
RESET   := \033[0m
BOLD    := \033[1m
GREEN   := \033[32m
YELLOW  := \033[33m
BLUE    := \033[34m
CYAN    := \033[36m
RED     := \033[31m
GRAY    := \033[90m

# Helpers
INFO    := @printf "$(CYAN)➜$(RESET)  "
OK      := @printf "$(GREEN)✔$(RESET)  "
WARN    := @printf "$(YELLOW)⚠$(RESET)  "
DC      := docker compose run --rm

.DEFAULT_GOAL := help

.PHONY: help build-cli build-agent build-gui build-web dev-agent dev-agent-prod dev-web dev-stack test-all test-coverage test-unit test-integration go-lint go-fmt go-check shell-go shell-node shell-web

help: ## Show this help message
	@printf "\n$(BOLD)Reqlet — build & dev targets$(RESET)\n\n"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(CYAN)%-22s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf "\n"

build-cli: ## Build the reqlet-cli binary into dist/
	$(INFO) @printf "Building reqlet-cli...\n"
	$(DC) build-cli
	$(OK) @printf "Binary available at $(BOLD)dist/reqlet-cli$(RESET)\n"

build-web: ## Build the React frontend into gui/web/dist/
	$(INFO) @printf "Building web UI...\n"
	$(DC) web npm run build
	$(OK) @printf "Frontend built in $(BOLD)gui/web/dist/$(RESET)\n"

build-agent: ## Build the reqlet-agent Docker image (node build → go:embed → alpine)
	$(INFO) @printf "Building reqlet-agent image...\n"
	docker build -f Dockerfile.agent -t reqlet-agent .
	$(OK) @printf "Image $(BOLD)reqlet-agent$(RESET) built.\n"

build-gui: ## Build the GUI Linux image via Dockerfile.gui (macOS/Windows require native runners)
	$(INFO) @printf "Building GUI (Linux) via Dockerfile.gui...\n"
	docker build -f Dockerfile.gui -t reqlet-gui .
	$(OK) @printf "Image $(BOLD)reqlet-gui$(RESET) built.\n"

dev-web: ## Start the React dev server at http://localhost:5173 (UI only, no Go backend)
	$(INFO) @printf "Starting Vite dev server at $(CYAN)http://localhost:5173$(RESET)\n"
	docker compose up web --remove-orphans

dev-agent: ## Start the Go agent at http://localhost:3001 — fast rebuild via go run (dev use)
	$(INFO) @printf "Starting dev agent (go run) at $(CYAN)http://localhost:3001$(RESET)\n"
	docker compose up dev-agent --remove-orphans

dev-agent-prod: ## Start the production agent image at http://localhost:3001 (full Docker build)
	$(INFO) @printf "Starting production reqlet-agent at $(CYAN)http://localhost:3001$(RESET)\n"
	docker compose up agent --remove-orphans

dev-stack: ## Start Vite (HMR) + Go agent in parallel — open http://localhost:5173
	$(INFO) @printf "Starting Vite + dev agent — open $(CYAN)http://localhost:5173$(RESET) ($(CYAN)/api/*$(RESET) proxied to port 3001)\n"
	docker compose up web dev-agent --remove-orphans

test-all: ## Run the full test suite
	$(INFO) @printf "Running tests...\n"
	$(DC) test

test-coverage: ## Run tests with coverage report (coverage.out + coverage.html)
	$(INFO) @printf "Running tests with coverage...\n"
	$(DC) test gotestsum -- -coverprofile=coverage.out -covermode=atomic ./engine/... ./cli/... ./agent/...
	$(DC) go go tool cover -html=coverage.out -o coverage.html
	$(OK) @printf "Coverage report: $(BOLD)coverage.html$(RESET)\n"

test-unit: ## Run unit tests only (excludes integration tag)
	$(INFO) @printf "Running unit tests...\n"
	$(DC) test gotestsum -- -tags='!integration' ./engine/... ./cli/... ./agent/...

test-integration: ## Run integration tests only
	$(INFO) @printf "Running integration tests...\n"
	$(DC) test gotestsum -- -tags=integration ./engine/... ./cli/... ./agent/...

go-lint: ## Run golangci-lint
	$(INFO) @printf "Running linter...\n"
	$(DC) lint

go-fmt: ## Format Go source files with gofumpt
	$(INFO) @printf "Formatting source files...\n"
	$(DC) go gofumpt -w .
	$(OK) @printf "Done.\n"

go-check: ## Check formatting without modifying files
	$(INFO) @printf "Checking formatting...\n"
	$(DC) go gofumpt -l .

shell-go: ## Open an interactive Go dev shell (engine/, cli/, agent/)
	$(INFO) @printf "Opening Go shell...\n"
	$(DC) go sh

shell-node: ## Open an interactive Node.js shell (node-runner/)
	$(INFO) @printf "Opening Node.js shell...\n"
	$(DC) node sh

shell-web: ## Open an interactive shell in the web container (gui/web/)
	$(INFO) @printf "Opening web shell...\n"
	$(DC) web sh
