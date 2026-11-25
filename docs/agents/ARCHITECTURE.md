# ARCHITECTURE.md — Tech Stack & Rationale

## Overview

OpenDraft is a client-first PWA with a minimal Go backend. Protocol artifacts are RDF/Turtle validated by SHACL.

## Tech Stack

### Web Client (apps/web/)

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| TypeScript | Language | Type safety, ecosystem |
| React/Preact | UI framework | Lightweight, PWA-friendly |
| Vite | Build tool | Fast HMR, ESM-native |
| IndexedDB | Persistence | Large storage, structured data |
| isomorphic-git | Git in browser | Client-side Git operations |

### BFF (apps/bff/)

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| Go | Language | Simple, fast, stdlib |
| net/http | HTTP server | No framework dependency |

### Protocol

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| Turtle | Serialization | Human-readable RDF |
| SHACL | Validation | W3C standard, machine-readable |
| SKOS | Subjects | Simple concept scheme |

### Build & CI

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| GitHub Actions | CI/CD | Native GitHub integration |
| Quarto | Compilation | Markdown to HTML, citations |

## Deployment

One Docker image ships the Go BFF **plus the static web app**, same-origin,
hosted at e.g. `https://publish.konsulin.care`. Replacing `github.com` with that
host must open the draft:

- `/{owner}/{repo}` — reader route
- `/{owner}/{repo}/tree/{ref}` — reader route at a ref

### Reserved URL Namespace

The reserved namespace uses `@`, because it is never a valid GitHub owner
(`-` and `assets` are real accounts):

- BFF endpoints under `/@api/*`
- Vite build assets under `/@assets/*`

Root files whose first path segment contains a dot (`/favicon.ico`, `/sw.js`,
`/manifest.webmanifest`, `/robots.txt`) are static files. Every other path
serves `index.html` (SPA fallback); the web app parses the path.

### BFF Responsibilities

- Authentication (GitHub App user access tokens only)
- Sealed-cookie session management
- Repository creation
- Permission checks
- Pull requests
- Forks
- Sign-in-only git transport relay (`/@api/git/{owner}/{repo}.git/...`)
- Static hosting of the web app

The relay contains no git logic; anonymous reading and git logic stay
client-side.

## Component Interaction

```text
┌─────────────────────────────────────────────┐
│                  Browser                    │
│  ┌─────────┐  ┌─────────┐  ┌────────────┐  │
│  │   web   │──│ packages│──│ IndexedDB  │  │
│  │  (PWA)  │  │ (git,   │  │ (offline)  │  │
│  │         │  │  rdf...) │  └────────────┘  │
│  └────┬────┘  └─────────┘                   │
│       │                                     │
└───────┼─────────────────────────────────────┘
        │ sealed session cookie
┌───────┼─────────────────────────────────────┐
│       ▼                                     │
│  ┌─────────┐                                │
│  │   bff   │── GitHub API (tokens) ────────>│
│  │  (Go)   │── git relay (sign-in only) ───>│
│  └─────────┘                                │
└─────────────────────────────────────────────┘

Anonymous reads: Browser ──> api.github.com / raw.githubusercontent.com
```

## Key Decisions

- Client-first: no server storage, BFF is auth and relay only.
- Git logic in browser: the BFF relay is sign-in only and contains no git logic.
- One image, same-origin: BFF under `/@api`, assets under `/@assets`.
- RDF for protocol: machine-readable, independently verifiable.

See ADR-001 through ADR-027 for full rationale.
