# OpenDraft Directory Layout

## Overview

OpenDraft uses a monorepo structure containing the application, shared packages, protocol definitions, and documentation.

## Directory Tree

```text
opendraft/
├── apps/                    # Applications
│   ├── web/                 # PWA client (TypeScript)
│   └── bff/                 # Go BFF (auth proxy)
│
├── packages/                # Shared libraries
│   ├── editor/              # Manuscript editing
│   ├── git/                 # Browser-side Git
│   ├── github/              # GitHub API integration
│   ├── metadata/            # YAML metadata handling
│   ├── references/          # BibTeX management
│   ├── rdf/                 # RDF/Turtle generation
│   └── quarto/              # Quarto Markdown processing
│
├── protocol/                # OpenDraft protocol (normative)
│   ├── opendraft.ttl        # RDF vocabulary
│   ├── article.shacl.ttl   # Article validation shapes
│   ├── registry.shacl.ttl  # Registry validation shapes
│   ├── registry.ttl         # Registry vocabulary
│   └── examples/            # Protocol examples
│
├── manuscripts/             # OpenDraft's own manuscripts
│   └── distributed-scientific-publication/
│
├── templates/               # Manuscript templates
│   └── manuscript/
│
├── tests/                   # Test suites
│   └── conformance/         # Protocol conformance tests
│
├── docs/                    # Documentation
│   ├── STRUCTURE.md         # This file
│   ├── ADR/                 # Architecture Decision Records
│   └── agents/              # AI agent documentation
│
├── AGENTS.md                # AI agent entry point
├── README.md                # Human entry point
├── PROPOSAL.md              # Product Requirements Document
└── TASKS.md                 # Implementation tasks
```

## Directory Purposes

### apps/

Contains runnable applications. The web app is a TypeScript PWA. The BFF is a lightweight Go server for GitHub authentication.

### packages/

Contains shared libraries used by apps. Each package is independently importable. Packages do not depend on apps.

### protocol/

Contains normative RDF artifacts that define the OpenDraft protocol. These files are versioned by Git commit SHA. Do not edit without understanding RDF and SHACL.

### manuscripts/

Contains OpenDraft's own explanatory manuscripts. The protocol self-documents here.

### templates/

Contains manuscript templates for new projects.

### tests/

Contains conformance tests that validate protocol compliance.

### docs/ADR/

Contains Architecture Decision Records explaining why decisions were made.

### docs/agents/

Contains documentation for AI coding agents.

## Design Decisions

- Monorepo: apps, packages, and protocol evolve together.
- Protocol is normative: TTL files define the standard.
- Manuscripts are for explanation: human-readable documentation lives here.
- See ADR-001 through ADR-016 for full rationale.
