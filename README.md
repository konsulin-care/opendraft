# OpenDraft

Client-first, Git-native, decentralized scientific publication.

## Overview

OpenDraft is a web application and open protocol for creating, managing, publishing, and discovering scientific publications. It uses Git as the source of truth and RDF for semantic representation.

## Quick Start

```bash
# 1. Install Node.js (LTS)
mise install

# 2. Install pnpm
corepack enable && corepack prepare pnpm@latest --activate

# 3. Install dependencies
pnpm install

# 4. Validate protocol artifacts
pnpm run validate:ttl

# 5. Run conformance tests
pnpm test
```

## Architecture

See [docs/STRUCTURE.md](docs/STRUCTURE.md) for directory layout.
See [docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md) for tech stack.

## Protocol

The OpenDraft protocol is defined in [protocol/](protocol/).
See [protocol/README.md](protocol/README.md) for artifact descriptions.
See [docs/agents/PROTOCOL.md](docs/agents/PROTOCOL.md) for summary.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
