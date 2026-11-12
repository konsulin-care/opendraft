# @konsulin/opendraft

OpenDraft command-line tools: validate, init, and manage manuscript blocks.

The package publishes the `opendraft` binary. Requires Node.js >= 20.

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
  run: npm install -g @konsulin/opendraft@0.1.0
```

Or pin an exact version with `npx` in a CI step:

```yaml
- name: Validate project (pinned)
  run: npx @konsulin/opendraft@0.1.0 validate
```

## Commands (v0.1)

```text
usage: opendraft <command> [arguments]
commands:
  validate [dir] [--json]           Validate config, metadata and assemblies
  init [dir] --manuscript <id>      Scaffold a new project
  manuscript                        Manage manuscripts
  block                             Manage blocks
```

### `validate`

```bash
opendraft validate [dir] [--json]
```

Validates `opendraft.yml`, manuscript metadata files and assemblies,
checks the protocol pin against the embedded protocol commit, and prints
a report. `--json` prints the machine-readable report. Exit code 0 when
no errors are found (warnings allowed), 1 otherwise.

### `init`

```bash
opendraft init [dir] --manuscript <id>
```

Scaffolds a new project (config, templates and the initial manuscript)
into `dir` (defaults to the current directory). Refuses to overwrite an
existing `opendraft.yml`; the manuscript id must be lowercase
alphanumeric with hyphens.

### `manuscript`

```bash
opendraft manuscript add <id> [dir]
```

Creates the starter files for a new manuscript under `manuscripts/<id>/`
and registers it in `opendraft.yml`. Requires an existing project
config; rejects ids that are already listed.

### `block`

```bash
opendraft block add <title> [dir] [-m <id>] [--after <short>] [--type <type>]
opendraft block ls [dir] [-m <id>]
```

`block add` writes a new block file and appends its include line to the
manuscript assembly; `--after <short>` places the include after an
existing block, `--type <type>` sets the section type. `block ls` prints
one `short<TAB>title` line per included block. The target manuscript
comes from `-m`/`--manuscript`, otherwise from the project's only
manuscript.

## Manual publish

Publishing is manual and runs from `packages/cli`:

1. Build the bundle:

   ```bash
   mise run build-cli
   ```

2. Run the smoke test against the packed tarball:

   ```bash
   bash packages/cli/scripts/smoke.sh
   ```

3. Bump the version (from `packages/cli`):

   ```bash
   npm version patch   # or minor / major
   ```

4. Publish from `packages/cli`:

   ```bash
   npm publish --access public
   ```

## License

AGPL-3.0-only. See the repository `LICENSE`.
