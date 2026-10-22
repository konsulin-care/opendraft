import type { WorkspaceAdapter } from '@opendraft/workspace';
import { ulid } from 'ulid';
import { stringify } from 'yaml';
import protocolManifest from '../../../../protocol/protocol.manifest.json' with { type: 'json' };

/** Path of the project configuration file at the workspace root. */
export const OPENDRAFT_CONFIG_PATH = 'opendraft.yml';

/** Options for scaffolding a new project workspace. */
export interface ScaffoldOptions {
  /** Identifier for the initial manuscript (lowercase alphanumeric + hyphens). */
  manuscriptId: string;
}

/**
 * Build the container article text for a starter block.
 *
 * @param blockPath - Repo-relative block path (`blocks/<slug>.qmd`).
 * @returns Container article text with a single include and a refs fence.
 */
function containerArticle(blockPath: string): string {
  return `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
---

{{< include ${blockPath} >}}

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

/** Starter references, mirroring templates/manuscript/references.bib. */
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
 * Writes a spec-conformant `opendraft.yml` whose protocol block is copied
 * from protocol/protocol.manifest.json, plus the manuscript layout under
 * `manuscripts/<manuscriptId>/`: a container `article.qmd` that includes
 * an empty starter block, the metadata files, and the references file.
 *
 * @param ws - Workspace adapter to write into (in-place).
 * @param options - Scaffold options; see {@link ScaffoldOptions}.
 */
export async function scaffoldProject(ws: WorkspaceAdapter, options: ScaffoldOptions): Promise<void> {
  const { manuscriptId } = options;
  const manuscriptPath = `manuscripts/${manuscriptId}`;

  const config = {
    protocol: protocolManifest.protocol,
    manuscripts: [{ id: manuscriptId, path: manuscriptPath }],
  };
  await ws.writeFile(OPENDRAFT_CONFIG_PATH, stringify(config));

  // Lowercase ULID: the validator (INCLUDE_RE, SLUG_RE) and the pre-commit
  // assembly flow only accept blocks/[a-z0-9-]+.qmd.
  const blockPath = `blocks/${ulid().toLowerCase()}.qmd`;
  // Empty on purpose: Milkdown would render any comment or text in the
  // visual editor.
  await ws.writeFile(`${manuscriptPath}/${blockPath}`, '');
  await ws.writeFile(`${manuscriptPath}/article.qmd`, containerArticle(blockPath));
  await ws.writeFile(`${manuscriptPath}/_author.yml`, AUTHOR_YML);
  await ws.writeFile(`${manuscriptPath}/_abstract.yml`, ABSTRACT_YML);
  await ws.writeFile(`${manuscriptPath}/_frontmatter.yml`, frontmatterYml(todayIsoDate()));
  await ws.writeFile(`${manuscriptPath}/references.bib`, REFERENCES_BIB);
}
