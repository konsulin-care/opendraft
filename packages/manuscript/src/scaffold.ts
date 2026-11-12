import type { WorkspaceAdapter } from '@opendraft/workspace';
import { stringify } from 'yaml';

/** Path of the project configuration file at the workspace root. */
export const OPENDRAFT_CONFIG_PATH = 'opendraft.yml';

/** Path of the shared bibliography for all manuscripts. */
export const SHARED_BIB_PATH = 'manuscripts/references.bib';

/** Protocol revision block written as `protocol` in opendraft.yml. */
export interface ProtocolBlock {
  /** Fixed protocol name (`opendraft`). */
  name: string;
  /** Full 40-character Git commit SHA of the protocol revision. */
  version: string;
  /** Canonical repository URL. */
  repository: string;
  /** Full 40-character Git commit SHA; must equal `version`. */
  commit: string;
}

/** Options for scaffolding a new project workspace. */
export interface ScaffoldOptions {
  /** Identifier for the initial manuscript (lowercase alphanumeric + hyphens). */
  manuscriptId: string;
  /** Protocol block copied verbatim into `opendraft.yml`. */
  protocol: ProtocolBlock;
}

/**
 * Build the container article text.
 *
 * The scaffolded article ships with no include shortcodes: blocks are
 * created later by the user, so the container only carries the metadata
 * frontmatter and the refs fence.
 *
 * @returns Container article text with no include shortcodes.
 */
function containerArticle(): string {
  return `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

::: {#refs}
:::
`;
}

/** Starter author metadata, mirroring templates/manuscript/_author.yml. */
const AUTHOR_YML = `authors: []
affiliations: []
`;

/** Starter abstract, mirroring templates/manuscript/_abstract.yml. */
const ABSTRACT_YML = `abstract: ""\n`;

/**
 * Build the starter frontmatter, mirroring templates/manuscript/_frontmatter.yml.
 *
 * @param date - Publication date as `YYYY-MM-DD` (local time).
 * @returns Frontmatter YAML text with the given date.
 */
function frontmatterYml(date: string): string {
  return `title: "Article Title"
date: ${date}
keywords:
  - keyword1
  - keyword2
license: "CC BY 4.0"
`;
}

/**
 * Format today's date as `YYYY-MM-DD` in local time.
 *
 * @returns The local-date stamp for the scaffolded frontmatter.
 */
function todayIsoDate(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Starter references, mirroring templates/project/manuscripts/references.bib. */
const REFERENCES_BIB = `@article{doe2024,
  title = {Example Article},
  author = {Doe, Jane},
  journal = {Journal of Examples},
  year = {2024},
  volume = {1},
  pages = {1--10}
}
`;

/**
 * Scaffold a new project workspace.
 *
 * Writes a spec-conformant `opendraft.yml` whose protocol block is the one
 * passed in options, plus the manuscript layout under
 * `manuscripts/<manuscriptId>/`: a container `article.qmd` with no include
 * shortcodes and no starter block file under `blocks/`, the metadata files.
 * The shared `manuscripts/references.bib` is written only when missing.
 *
 * @param ws - Workspace adapter to write into (in-place).
 * @param options - Scaffold options; see {@link ScaffoldOptions}.
 */
export async function scaffoldProject(ws: WorkspaceAdapter, options: ScaffoldOptions): Promise<void> {
  const { manuscriptId, protocol } = options;
  const manuscriptPath = `manuscripts/${manuscriptId}`;

  const config = {
    protocol,
    manuscripts: [{ id: manuscriptId, path: manuscriptPath }],
  };
  await ws.writeFile(OPENDRAFT_CONFIG_PATH, stringify(config));

  await ws.writeFile(`${manuscriptPath}/article.qmd`, containerArticle());
  await ws.writeFile(`${manuscriptPath}/_author.yml`, AUTHOR_YML);
  await ws.writeFile(`${manuscriptPath}/_abstract.yml`, ABSTRACT_YML);
  await ws.writeFile(`${manuscriptPath}/_frontmatter.yml`, frontmatterYml(todayIsoDate()));
  if ((await ws.readFile(SHARED_BIB_PATH)) === null) {
    await ws.writeFile(SHARED_BIB_PATH, REFERENCES_BIB);
  }
}
