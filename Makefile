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

.PHONY: help build-cli build-gui test-all test-coverage test-unit test-integration go-lint go-fmt go-check shell-go shell-node

help: ## Show this help message
	@printf "\n$(BOLD)Reqlet — build & dev targets$(RESET)\n\n"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(CYAN)%-22s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf "\n"

build-cli: ## Build the reqlet-cli binary into dist/
	$(INFO) @printf "Building reqlet-cli...\n"
	$(DC) build-cli
	$(OK) @printf "Binary available at $(BOLD)dist/reqlet-cli$(RESET)\n"

build-gui: ## Build the Reqlet desktop app (available in Phase 2)
	$(WARN) @printf "GUI build is planned for $(BOLD)Phase 2$(RESET) - not yet available.\n"
	@printf "       Run $(CYAN)wails dev$(RESET) locally once Phase 2 is scaffolded.\n"

test-all: ## Run the full test suite
	$(INFO) @printf "Running tests...\n"
	$(DC) test

test-coverage: ## Run tests with coverage report (coverage.out + coverage.html)
	$(INFO) @printf "Running tests with coverage...\n"
	$(DC) test gotestsum -- -coverprofile=coverage.out -covermode=atomic ./...
	$(DC) go go tool cover -html=coverage.out -o coverage.html
	$(OK) @printf "Coverage report: $(BOLD)coverage.html$(RESET)\n"

test-unit: ## Run unit tests only (excludes integration tag)
	$(INFO) @printf "Running unit tests...\n"
	$(DC) test gotestsum -- -tags='!integration' ./...

test-integration: ## Run integration tests only
	$(INFO) @printf "Running integration tests...\n"
	$(DC) test gotestsum -- -tags=integration ./...

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

shell-go: ## Open an interactive Go dev shell (engine/, cli/)
	$(INFO) @printf "Opening Go shell...\n"
	$(DC) go sh

shell-node: ## Open an interactive Node.js shell (node-runner/)
	$(INFO) @printf "Opening Node.js shell...\n"
	$(DC) node sh
