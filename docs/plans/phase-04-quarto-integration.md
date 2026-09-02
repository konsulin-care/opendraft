# Phase 4 — Quarto Integration

**Summary:** Connects manuscript content to Quarto rendering, defines the author metadata model, and builds the compiler pipeline that normalizes YAML metadata and ingests BibTeX references.

---

## OD-041 — Author metadata model

**Atomic Instruction:** Generate TypeScript interfaces from JSON schemas in `@opendraft/schema` using `json-schema-to-typescript`. Expose these types as the canonical metadata model from `@opendraft/metadata`.

**Definition of Done:**
- [ ] `json-schema-to-typescript` added as dev dependency
- [ ] `generate-types` script in `packages/metadata/package.json` generates `src/types/` from `packages/schema/schemas/`
- [ ] Generated files have `/* DO NOT MODIFY BY HAND */` banner
- [ ] Types exported from `packages/metadata/src/index.ts`: `Author`, `Affiliation`, `Abstract`, `Frontmatter`
- [ ] `pnpm generate` regenerates types without manual intervention
- [ ] Generated types pass typecheck

---

## OD-043 — BibTeX ingestion

**Atomic Instruction:** Implement a BibTeX parser in `@opendraft/references` and define a JSON schema for BibTeX entry validation in `@opendraft/schema`.

**Definition of Done:**
- [ ] `bibtex.schema.json` added to `packages/schema/schemas/` — 14 entry types, 27 fields, `additionalProperties: true`
- [ ] `packages/references/src/parser.ts` parses `.bib` strings into typed `Reference[]` entries
- [ ] Parser handles: nested braces in values, string concatenation (`#`), line comments (`%`), multiline values
- [ ] Parser produces `Reference` objects: `{ citeKey, entryType, fields }` matching schema structure
- [ ] Invalid BibTeX produces structured errors with line numbers
- [ ] `parseBibTeX` exported from `packages/references/src/index.ts`
- [ ] Unit tests cover: valid entries, nested braces, all 14 entry types, malformed input errors, DOI extraction
- [ ] Tests pass

---

## OD-042 — Metadata compiler

**Atomic Instruction:** Implement a compiler in `@opendraft/metadata` that reads manuscript YAML files + optional BibTeX, validates them, and returns a normalized `PublicationMetadata` object.

**Definition of Done:**
- [ ] `packages/metadata/src/compiler.ts` implements `compileManuscript(dir: string): PublicationMetadata`
- [ ] Compiler reads `_author.yml`, `_abstract.yml`, `_frontmatter.yml`, optional `references.bib`
- [ ] YAML validated via existing `validateMetadata()` from `@opendraft/schema`
- [ ] BibTeX validated against `bibtex.schema.json`
- [ ] Required-field checks per entry type enforced in compiler (not schema): article (author, title, journal, year), book (author/editor, title, publisher, year), inproceedings (author, title, booktitle, year), etc.
- [ ] Output is deterministic: sorted keys, normalized dates, consistent ordering
- [ ] Missing required YAML files produce clear error messages
- [ ] `compileManuscript` exported from `packages/metadata/src/index.ts`
- [ ] Unit tests cover: full manuscript, missing files, BibTeX integration, deterministic output
- [ ] Tests pass

---

## OD-040 — Minimal Quarto manuscript + CI

**Atomic Instruction:** Create a test manuscript at `manuscripts/_quarto-test/` and add a GitHub Actions workflow that renders it via Quarto on every PR.

**Definition of Done:**
- [ ] `manuscripts/_quarto-test/` created with: `article.qmd`, `_author.yml`, `_abstract.yml`, `_frontmatter.yml`, `references.bib`
- [ ] Manuscript listed in `opendraft.yml` under manuscripts
- [ ] GitHub Actions workflow (`.github/workflows/quarto-render.yml`) uses `quarto-dev/quarto-actions/setup@v2` and `quarto-dev/quarto-actions/render@v2`
- [ ] Workflow triggers on pull requests
- [ ] `quarto render manuscripts/_quarto-test` succeeds locally
- [ ] `opendraft validate-project` passes with new manuscript

---

## Dependency Graph

```
OD-041 (types) ──────┐
                      ├──> OD-042 (compiler) ──> OD-040 (Quarto + CI)
OD-043 (BibTeX) ─────┘
```

OD-041 and OD-043 can run in parallel. OD-042 depends on both. OD-040 depends on OD-042.
