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
        │ OAuth
┌───────┼─────────────────────────────────────┐
│       ▼                                     │
│  ┌─────────┐                                │
│  │   bff   │──── GitHub API                 │
│  │  (Go)   │                                │
│  └─────────┘                                │
└─────────────────────────────────────────────┘
```

## Key Decisions

- Client-first: no server storage, BFF is auth-only.
- Git in browser: no Git proxy in BFF.
- RDF for protocol: machine-readable, independently verifiable.

See ADR-001 through ADR-016 for full rationale.
