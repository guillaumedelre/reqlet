# HOW-TO — Build and run Reqlet locally

This guide covers building `reqlet-cli` and `reqlet` (desktop GUI) from source and running them on your machine.

---

## Prerequisites

### reqlet-cli

| Option | Requirement |
|--------|-------------|
| **Docker (recommended)** | Docker Engine + Compose v2 plugin |
| **Native** | Go 1.25+ |

Verify: `docker compose version` or `go version`.

### reqlet (GUI)

The GUI is built with [Wails v2][wails]. Requirements vary by platform:

| Platform | Requirements |
|----------|-------------|
| **macOS** | Xcode Command Line Tools (`xcode-select --install`), Go 1.25+, Node.js 22+ |
| **Windows** | Go 1.25+, Node.js 22+, WebView2 (pre-installed on Windows 10/11), gcc via [MSYS2][msys2] |
| **Linux** | Go 1.25+, Node.js 22+, gcc, `libgtk-3-dev`, `libwebkit2gtk-4.0-dev` |

Install Wails CLI after Go is set up:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails doctor   # verify all platform dependencies
```

> **Note:** The GUI is in active development (Phase 2). The build commands below reflect the intended workflow once Phase 2 is complete. CLI is fully functional today.

---

## Building reqlet-cli

### Option A — Docker (zero local toolchain required)

```bash
# Build the binary into dist/reqlet-cli
docker compose run --rm build-cli

# Verify
./dist/reqlet-cli --help
```

The binary is a self-contained Linux amd64 executable. To run it on macOS or Windows, use Option B or the Docker image.

### Option B — Native Go

```bash
go build -o reqlet-cli ./cli
./reqlet-cli --help
```

### Option C — Docker image (run without installing)

```bash
docker build -f Dockerfile -t reqlet-cli .
docker run --rm -v "$(pwd):/workspace" reqlet-cli run /workspace/collection.json
```

---

## Running reqlet-cli

```bash
# Run a collection
./reqlet-cli run collection.json

# With environment
./reqlet-cli run collection.json --environment prod.json

# With data file (CSV or JSON)
./reqlet-cli run collection.json --data data.csv --iteration-count 5

# TLS client certificate
./reqlet-cli run collection.json \
  --ssl-client-cert client.crt \
  --ssl-client-key client.key

# Export reports
./reqlet-cli run collection.json \
  --reporter-json-export report.json \
  --reporter-junit-export report.xml
```

All flags:

```
--environment          path to Postman environment file
--globals              path to globals file
--data                 path to data file (CSV or JSON)
--iteration-count      number of iterations (default 1)
--folder               run only requests in this folder
--delay-request        delay between requests in ms
--timeout              overall run timeout in seconds
--timeout-request      per-request timeout in seconds (default 30)
--bail                 stop on first failure
--insecure             skip TLS certificate verification
--ssl-client-cert      path to PEM client certificate
--ssl-client-key       path to PEM client private key
--ssl-client-passphrase passphrase for encrypted key
--env-var key=value    override or set an environment variable
--global-var key=value override or set a global variable
--no-color             disable terminal colours
--verbose              print response body for each request
--reporter-json-export write JSON report to file (- for stdout)
--reporter-junit-export write JUnit XML report to file (- for stdout)
```

---

## Building reqlet (GUI)

> The GUI requires Phase 2 to be complete. These steps describe the intended workflow.

### Development mode (hot reload)

```bash
# Start the Vite dev server in one terminal
docker compose up frontend

# Start Wails in dev mode (requires a graphical session — not inside Docker)
wails dev
```

`wails dev` watches Go backend changes and reloads the frontend automatically. The app opens in a native window.

### Production build

```bash
# macOS
wails build

# Linux
wails build -platform linux/amd64

# Windows (cross-compile from Linux requires a Windows runner)
wails build -platform windows/amd64
```

The built binary is placed in `build/bin/reqlet` (or `reqlet.exe` on Windows).

### Linux — build inside Docker

A `Dockerfile.gui` is provided for Linux builds without a local GTK setup:

```bash
docker build -f Dockerfile.gui -t reqlet-gui-builder .
```

This installs WebKit2GTK and compiles the GUI. The resulting binary can be extracted from the image.

---

## Development commands

All Go commands run inside Docker — nothing to install on the host.

```bash
# Run all tests
docker compose run --rm test

# Run linter
docker compose run --rm lint

# Format code
docker compose run --rm go gofumpt -w .

# Interactive Go shell
docker compose run --rm go sh

# Node.js shell (node-runner/)
docker compose run --rm node sh

# Frontend dev server (gui/frontend/ — http://localhost:5173)
docker compose up frontend
```

[wails]: https://wails.io
[msys2]: https://www.msys2.org
