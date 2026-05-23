# Reqlet

> Open source Postman desktop replacement — GUI, CLI and self-hostable.

[![CI](https://github.com/guillaumedelre/reqlet/actions/workflows/ci.yml/badge.svg)](https://github.com/guillaumedelre/reqlet/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/guillaumedelre/reqlet/branch/main/graph/badge.svg)](https://codecov.io/gh/guillaumedelre/reqlet)
[![Go Report Card](https://goreportcard.com/badge/github.com/guillaumedelre/reqlet)](https://goreportcard.com/report/github.com/guillaumedelre/reqlet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Reqlet is a self-hostable API client designed to replace Postman desktop. It ships as a native desktop GUI (Windows, macOS, Linux) and a standalone CLI — no account required, no cloud dependency.

## Features

- **Desktop GUI** — native app built with [Wails v2][wails], no Electron
- **CLI** — run Postman collections from the terminal, CI/CD ready
- **Postman compatible** — imports Collection v2.1, v2.0, v1.0; exports v2.1
- **Offline-first** — works entirely without an internet connection
- **Self-hostable** — no mandatory third-party services
- **MIT licensed** — fully open source, no feature-gating

## Installation

### Desktop app

Download the installer for your platform from the [Releases page][releases].

### CLI — Binary

```bash
# macOS (Apple Silicon)
curl -L https://github.com/guillaumedelre/reqlet/releases/latest/download/reqlet_darwin_arm64.tar.gz | tar xz

# macOS (Intel)
curl -L https://github.com/guillaumedelre/reqlet/releases/latest/download/reqlet_darwin_amd64.tar.gz | tar xz

# Linux (amd64)
curl -L https://github.com/guillaumedelre/reqlet/releases/latest/download/reqlet_linux_amd64.tar.gz | tar xz
```

Verify the download with the provided `checksums.txt` and cosign signature.

### CLI — Docker

```bash
docker run --rm -v $(pwd):/workspace ghcr.io/guillaumedelre/reqlet run collection.json
```

## Quick start

```bash
# Run a collection
reqlet run collection.json --environment prod.json

# Run with iteration data
reqlet run collection.json --data data.csv --reporters cli,junit

# Run a single request
reqlet run collection.json --folder "Auth" --reporters cli
```

## Documentation

- [Architecture overview](docs/architecture.md)
- [Development guide](docs/development.md)
- [Newman migration guide](docs/newman-migration.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Only Docker is required — no local toolchain needed.

## License

[MIT](LICENSE)

[wails]: https://wails.io
[releases]: https://github.com/guillaumedelre/reqlet/releases
