# SCHEMA.md — OpenDraft Configuration Schema

**Audience:** Human developers and AI agents.

This document defines the structure of `opendraft.yml`, the root configuration file in an OpenDraft repository. The machine-readable source is `packages/schema/schemas/opendraft.schema.json`.

---

## Overview

`opendraft.yml` lives at the repository root and declares:

1. Which version of the OpenDraft protocol the repository uses.
2. Which manuscripts the repository contains.

Unknown fields are tolerated — they do not cause validation failure. This allows future extensions without breaking existing repositories.

---

## Structure

```yaml
protocol:
  name: opendraft
  version: <40-char hex SHA>
  repository: <URL>
  commit: <40-char hex SHA>
manuscripts:
  - id: <string>
    path: <string>
```

Both `protocol` and `manuscripts` are required at the top level.

---

## Fields

### `protocol`

Object. Required. Identifies the protocol revision.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Fixed value: `"opendraft"` |
| `version` | string | yes | Full 40-character Git commit SHA of the protocol revision |
| `repository` | string | yes | Canonical repository URL (must start with `http://` or `https://`) |
| `commit` | string | yes | Full 40-character Git commit SHA (must equal `version`) |

Rules:
- `version` and `commit` must be identical — both record the same commit SHA.
- The SHA must be exactly 40 lowercase hexadecimal characters.
- `name` and `repository` are fixed constants; they change only if the protocol is relocated.

See [protocol/versioning.md](../protocol/versioning.md) for the full specification.

### `manuscripts`

Array. Required. Lists manuscripts in the repository.

Each entry is an object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Manuscript identifier (lowercase alphanumeric + hyphens) |
| `path` | string | yes | Relative path to the manuscript directory |

Manuscript identifiers must match the pattern `^[a-z0-9]+(-[a-z0-9]+)*$`:
- Lowercase letters and numbers only.
- Hyphens allowed between segments.
- No uppercase, underscores, spaces, or leading/trailing hyphens.

Examples: `my-article`, `resilience-study-2024`, `article1`.

---

## Example

```yaml
protocol:
  name: opendraft
  version: e849ba8a46528d523d5f3d18f5f0171853f13030
  repository: https://github.com/konsulin-care/opendraft
  commit: e849ba8a46528d523d5f3d18f5f0171853f13030
manuscripts:
  - id: my-article
    path: manuscripts/my-article
```

---

## Validation

The schema is enforced by `@opendraft/schema` (`packages/schema`):

- `validateOpendraft(config)` validates any parsed YAML object against the schema.
- The pre-push hook (`mise run validate-project`) runs this validator.
- The client app imports the same validator to check repository compliance.

Errors include the specific JSON path to the failing field (e.g., `protocol.version`).
