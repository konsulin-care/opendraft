# @konsulin/opendraft

OpenDraft command-line tools: scaffold a manuscript project, validate it, and
compile its publication metadata.

The package publishes the `opendraft` binary. Requires Node.js >= 20.

## What OpenDraft is

OpenDraft is a Git-native toolchain for scientific manuscripts. A manuscript
lives in a repository as plain text — Quarto Markdown, YAML metadata and a
BibTeX bibliography — and the structure it must satisfy is a machine-checkable
protocol: an RDF vocabulary plus SHACL shapes stored in the OpenDraft
repository and pinned by commit SHA.

That design answers three problems that usually surface only when a paper is
already written.

**Structure is checked late.** A missing author, an affiliation-less author, a
dangling citation or a heading that no standard section type covers normally
turns up during submission or typesetting. OpenDraft validates them locally, on
every commit, before a DOI is involved.

**Publication metadata is hand-assembled.** Authorship, affiliations,
identifiers and provenance get re-typed into publisher forms and repository
records. OpenDraft compiles them once from source files into RDF, so the same
data feeds validation, the web editor and the DOI deposit.

**Provenance is not reproducible.** A published artifact should state which
source revision produced it. OpenDraft records the Git commit of the manuscript
and the commit of the validation protocol inside the publication graph itself.

The CLI is the non-interactive half of the project: the same validation engine
the OpenDraft web editor runs, packaged so it can run in an editor, a commit
hook or CI.

## Getting started

Install and scaffold a project:

```bash
npx @konsulin/opendraft@latest init my-paper --manuscript paper
cd my-paper
```

Add a first section and fill in the metadata:

```bash
opendraft block add "Introduction" --type introduction
$EDITOR manuscripts/paper/_frontmatter.yml   # title, date, license
$EDITOR manuscripts/paper/_author.yml        # authors and affiliations
$EDITOR manuscripts/paper/_abstract.yml      # abstract
```

Validate:

```bash
opendraft validate
```

A fresh project passes with warnings only: the missing authors and abstract are
publish-level findings, and they become errors once the manuscript is being
released (`opendraft validate --release`). Errors print as
`location (path): message`; the exit code is 0 when no errors were found.

From here, [Project layout](#project-layout) explains the files you just
created, [The protocol](#the-protocol) explains what the shapes check, and
[Commands](#commands) documents every command.

## What the CLI does

| Job | Command |
| --- | --- |
| Create a project | `opendraft init` |
| Add a manuscript to an existing project | `opendraft manuscript add` |
| Add, list and normalise the sections of a manuscript | `opendraft block` |
| Validate config, metadata, assembly and the RDF graph | `opendraft validate` |
| Print the compiled publication graph | `opendraft rdf` |
| Move a project to the newest protocol revision | `opendraft protocol upgrade` |

`validate` prints findings and returns exit code 0 when no errors were found
(warnings are allowed), 1 when errors were found and 2 on usage errors, so it
can gate a commit hook or a CI job directly.

## Installation

Run it ad hoc with `npx` (no install):

```bash
npx @konsulin/opendraft@latest validate
```

Install it as a dev dependency with `pnpm add -D`:

```bash
pnpm add -D @konsulin/opendraft
pnpm exec opendraft validate
```

Install it globally with `npm i -g`:

```bash
npm i -g @konsulin/opendraft
opendraft validate
```

Pin the version in CI so builds never pick up a breaking release:

```yaml
- name: Install OpenDraft CLI (pinned)
  run: npm install -g @konsulin/opendraft@x.y.z
```

Or pin an exact version with `npx` in a CI step:

```yaml
- name: Validate project (pinned)
  run: npx @konsulin/opendraft@x.y.z validate
```

## Project layout

`opendraft init demo --manuscript paper` writes:

```text
opendraft.yml              project config: protocol pin, manuscript registry
manuscripts/
  references.bib           shared bibliography for every manuscript
  paper/
    article.qmd            container: metadata files, bibliography, includes
    _frontmatter.yml       title, date, license, keywords
    _author.yml            authors, affiliations, ORCID, CRediT roles
    _abstract.yml          abstract text
    blocks/                one file per section, created as you add them
```

Two ideas shape this layout.

**The manuscript is a container plus sections.** `article.qmd` holds front matter
and an ordered list of include shortcodes
(`{{< include blocks/_introduction.qmd >}}`), and each section lives in its own
file. Sections are reordered by moving include lines, and a section file can be
reviewed on its own in a diff. `opendraft block add` keeps the include list and
the files in sync; `init` scaffolds an empty container with no includes and no
`blocks/` directory yet.

**Metadata is data, not prose.** `_frontmatter.yml`, `_author.yml` and
`_abstract.yml` are parsed into the publication graph, so validation and export
read structured fields instead of scraping Markdown.

`opendraft.yml` registers the manuscripts and pins the protocol:

```yaml
protocol:
  name: opendraft
  version: <40-character protocol commit SHA>
  repository: https://github.com/konsulin-care/opendraft
  commit: <40-character protocol commit SHA>
manuscripts:
  - id: paper
    path: manuscripts/paper
```

The pin belongs to the project, not to the tool: a project keeps validating
against the protocol revision it was created with, and
`opendraft protocol upgrade` is an explicit, reviewable change.

## The protocol

The protocol lives under `protocol/` in the OpenDraft repository and consists of
Turtle files:

| Artifact | Purpose |
| --- | --- |
| `opendraft.ttl` | Core vocabulary (`od:` terms) sitting on top of FaBiO, FRBR, PRO, SCoRO, OCO, CiTO, DataCite and CRediT |
| `article.shacl.ttl` | Shapes every manuscript graph must satisfy |
| `article-release.shacl.ttl` | Extra shapes for released, DOI-bearing publications |
| `registry.shacl.ttl` | Shapes for discovery registries |
| `protocol.manifest.json` | Pinned revision plus the SHA-256 of every artifact |

A publication is an `od:Publication` — a FaBiO expression carrying a version
DOI. Authorship follows the OCDM role model rather than a flat author list: roles
are `pro:RoleInTime` nodes linked from the publication with
`pro:isDocumentContextFor`, held by persons or groups through `pro:isHeldBy`,
typed with `pro:withRole` (author, a CRediT contributor role, affiliate,
corresponding-author), and ordered through an `oco:hasNext` chain.
`dcterms:creator` shortcuts are emitted alongside for consumers that expect a
plain creator list. Affiliations are `scoro:affiliate` roles pointing at named
organizations, and sections are `doco:Section` nodes carrying a DEO role class.

### Draft and release profiles

Not every rule applies all the time. A project straight out of `init` has no
authors yet; a submitted paper must have them.

- A graph is a **release** when its publication carries a DOI identifier or
  realizes a FaBiO Work; otherwise it is a **draft**. The profile is detected
  from the graph itself, never from a flag.
- Drafts validate against `article.shacl.ttl` alone. Releases validate against
  the union with `article-release.shacl.ttl`, which adds what a publication
  cannot ship without: at least one creator, an author role, exactly one head of
  the author chain, a corresponding author with a mailbox, a DOI, a single Work
  realization, a repository URL and source revision, and a source file for every
  section.
- `opendraft validate --release` is a different control: it escalates
  publish-level metadata findings (below) from warnings to errors, so a project
  can be checked as if it were about to publish.

### Protocol resolution

Validation needs the shape files for the revision a project pins. The CLI
resolves the pin in this order:

1. the protocol history bundled into the package, which needs no network access;
2. a local cache of previously fetched revisions;
3. `raw.githubusercontent.com`, for a revision newer than the installed CLI.

A revision older than the tool's compatibility floor is skipped with a warning
that suggests `opendraft protocol upgrade`; an unknown revision is fetched and
validated with a warning to upgrade the CLI. `opendraft validate --offline`
forbids steps 2 and 3, which makes it the right choice for air-gapped CI.

## What `validate` checks

Validation runs three stages and reports everything it finds in one pass.

### Project

`opendraft.yml` must match its schema, every manuscript id must match its
directory name, and `manuscripts/references.bib` must exist.

### Manuscript

File naming must follow the conventions, `article.qmd` must include exactly the
block files that exist as sections, headings must carry a valid anchor and a
known DEO role class, and every citekey used in a block must be defined in the
bibliography named by the container front matter. Metadata is checked against
the publish-readiness profile, whose findings come in three severities:

| Severity | Meaning | Reported as |
| --- | --- | --- |
| `commit` | The metadata is malformed: a bad ORCID, ROR or DOI, a YAML parse error, a missing title, an id used twice | always an error |
| `publish` | The manuscript cannot be published as it stands: no authors, a person author without an affiliation, a repository that does not match the registered one | error with `--release`, warning otherwise |
| `warning` | Worth fixing before submission: a missing license or abstract, no corresponding author with an email | always a warning |

### RDF

The project is compiled into a single Turtle graph — publication, Work,
identifier nodes, roles, affiliations, sections and provenance scalars — the
draft or release profile is detected, and the graph is validated against the
matching SHACL shapes. `sh:Violation` results become errors and `sh:Warning`
results become warnings. When the metadata stage already reported errors, the
RDF stage is skipped with a warning, because a graph built from unparseable
metadata would only produce noise. `opendraft rdf` prints the same graph, which
makes a SHACL message traceable back to the YAML that produced it.

A fresh project therefore validates: the missing authors and abstract are
publish-level warnings, not errors. Once the manuscript carries a DOI, the same
findings become blocking.

## Commands

```text
usage: opendraft <command> [arguments]
commands:
  validate [dir] [--json] [--offline] [--release]  Validate config, metadata and assemblies
  init [dir] --manuscript <id>  Scaffold a new project
  manuscript              Manage manuscripts
  block                   Manage blocks
  protocol upgrade [dir]  Pin the protocol to the bundled latest revision
  rdf [dir] [-m <id>]     Print the manuscript RDF graph as Turtle
```

### `validate`

```bash
opendraft validate [dir] [--json] [--offline] [--release]
```

Validates the project rooted at `dir` (defaults to the current directory).
Findings print as `location (path): message` on stderr and a pass line goes to
stdout. `--json` prints a single JSON object with `errors` and `warnings`
arrays instead, which is the form to parse in tooling. `--offline` restricts
protocol resolution to what is already bundled or cached, and `--release`
escalates publish-level metadata findings to errors. See
[What `validate` checks](#what-validate-checks) for the stages and severities.

### `init`

```bash
opendraft init [dir] --manuscript <id>
```

Scaffolds a project (config, container article, metadata files, bibliography)
into `dir`. Refuses to overwrite an existing `opendraft.yml` and rejects
manuscript ids that are not lowercase alphanumeric with hyphens. The new project
pins the protocol revision bundled with this CLI.

### `manuscript`

```bash
opendraft manuscript add <id> [dir]
```

Creates the starter files for another manuscript under `manuscripts/<id>/` and
registers it in `opendraft.yml`. Requires an existing project config and rejects
ids that are already registered.

### `block`

```bash
opendraft block add <title> [dir] [-m <id>] [--after <short>] [--type <role>]
opendraft block ls [dir] [-m <id>]
opendraft block normalize [dir] [-m <id>]
```

`block add` writes `blocks/_<short>.qmd` with a heading carrying the `sec-`
anchor and the DEO role class, then inserts its include line into the assembly.
`--after <short>` places the include after an existing block, `--type <role>`
sets the DEO role — `introduction`, `methods`, `results`, `discussion` and the
other standard section roles — and defaults to a plain section. `block ls`
prints one `short<TAB>title` line per included block, in reading order.
`block normalize` rewrites legacy unprefixed block files and their include lines
to the current `blocks/_<short>.qmd` convention.

The target manuscript comes from `-m`/`--manuscript`, otherwise from the
project's only manuscript.

### `rdf`

```bash
opendraft rdf [dir] [-m <id>]
```

Compiles the manuscript and prints its publication graph as Turtle. Useful for
seeing exactly what validation saw, for debugging a SHACL message, or for
handing the graph to an external consumer.

### `protocol upgrade`

```bash
opendraft protocol upgrade [dir]
```

Rewrites `protocol.version` and `protocol.commit` in `opendraft.yml` to the
revision bundled with this CLI, preserving the rest of the file, and reports
when the project is already current. Treat the resulting diff as a reviewable
change: an upgrade can tighten validation.

## Typical workflow

```bash
opendraft init my-paper --manuscript paper
cd my-paper

opendraft block add "Introduction" --type introduction
opendraft block add "Methods" --type methods
opendraft block add "Results" --type results

# fill in _frontmatter.yml, _author.yml, _abstract.yml and the block files
opendraft validate            # iterate until only warnings remain
opendraft rdf > paper.ttl     # inspect or export the publication graph
opendraft validate --release  # strict check before submitting
```

Quarto renders the manuscript; OpenDraft does not typeset. Nothing in the CLI
mints DOIs either: it enforces the metadata a DOI deposit needs, and the DOI
itself is added when the publication is registered.

## Related packages

The CLI is one consumer of a shared core. `@opendraft/workspace` abstracts the
file system, so the same validation runs against a real directory, an in-memory
project or a browser store. `@opendraft/schema` holds the naming, assembly and
publish-readiness rules; `@opendraft/manuscript` implements block, heading and
scaffold operations; `@opendraft/metadata` compiles YAML into the publication
graph; `@opendraft/rdf` parses Turtle, resolves protocol revisions and runs
SHACL validation. The OpenDraft web editor wires the same packages to a browser
workspace, which is why a manuscript validated in the browser and in CI agrees.

## License

AGPL-3.0-only. See the repository `LICENSE`.
