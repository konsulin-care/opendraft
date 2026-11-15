# ADR 025: Block File Underscore Prefix

**Status:** Accepted
**Amends:** ADR-023 (block file naming)

## Context

Quarto renders every `.qmd` file in a project directory. Block files under
`blocks/` are fragments meant for inclusion only, so they must not render as
standalone pages. Quarto ignores files starting with `_`.

## Decision

- Block files are `manuscripts/<id>/blocks/_<short>.qmd`, included as
  `{{< include blocks/_<short>.qmd >}}`.
- The short name (identity) has no underscore: heading
  `# Title {#sec-<short> .deo-<role>|.doco-section}`, references
  `@sec-<short>`.
- Short name rules: NFKD, accents stripped, kebab case, max 40 characters,
  no edge hyphen, fallback `section`, duplicate suffix `-` plus 6 digits.
- Legacy un-prefixed block files (`blocks/<short>.qmd`) are errors and block
  commits.
- The editor auto-normalizes legacy names when a manuscript is opened.
- `opendraft block add` normalizes before writing; `opendraft block normalize`
  fixes existing manuscripts.

## Consequences

- Blocks never render as standalone documents.
- Filename, anchor and reference stay in lockstep through one shared rule set
  in `@opendraft/schema`.
