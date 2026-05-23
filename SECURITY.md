# Security Policy

## Supported Versions

Only the latest released version of `reqlet` receives security updates.
Older versions are not maintained.

| Version  | Supported          |
| -------- | ------------------ |
| latest   | :white_check_mark: |
| < latest | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in `reqlet`, please report it
responsibly. **Please do not open a public issue, pull request, or discussion
for security problems**, as this could put other users at risk before a fix is
available.

Please use one of the following private channels:

- **GitHub Security Advisories** (preferred): use the
  **"Report a vulnerability"** button under the
  [Security tab](https://github.com/guillaumedelre/reqlet/security/advisories/new)
  of this repository. This keeps the report private and lets us coordinate a
  fix and disclosure with you.
- **Email**: [delre.guillaume@gmail.com](mailto:delre.guillaume@gmail.com)

When reporting, please include as much of the following as you can:

- A description of the vulnerability and its potential impact
- The affected component (Go backend, TypeScript frontend/package, or shared code)
- Step-by-step instructions to reproduce
- Affected version(s) or commit hash
- Any relevant logs, request payloads, or proof-of-concept

## Response Process

- We will acknowledge your report within **3 business days**.
- We will provide an initial assessment (confirmed / needs more info / not a
  vulnerability) within **7 business days**.
- Once a fix is ready, we will coordinate a disclosure timeline with you.
- We follow a **responsible disclosure** policy: we ask that you give us a
  reasonable period (up to **90 days**) to release a fix before any public
  disclosure. We are happy to credit you in the advisory unless you prefer to
  remain anonymous.

## Scope

This policy applies to the latest released version of `reqlet`, hosted at
<https://github.com/guillaumedelre/reqlet>. As a monorepo, this covers both
the Go and TypeScript components of the project, including shared code.

The following are generally **out of scope**:

- Vulnerabilities in third-party dependencies (please report those upstream;
  you may still let us know so we can bump or pin the affected version)
- Issues requiring physical access to a user's machine
- Reports generated solely by automated scanners without a demonstrated,
  exploitable impact

## Dependency & Tooling Security

`reqlet` uses automated tooling to reduce the risk of known vulnerabilities
across both ecosystems:

**Go**
- `govulncheck` — scans for known vulnerabilities in Go modules and standard library
- `gosec` — static analysis for common security issues in Go code

**TypeScript / Node**
- `npm audit` — scans the dependency tree for known advisories

**Cross-cutting**
- Dependabot keeps dependencies current and surfaces security advisories early

We aim to keep dependencies up to date and to address known advisories promptly.
