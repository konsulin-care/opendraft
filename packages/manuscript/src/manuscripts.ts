/**
 * Manuscript registration: create the starter files for a new manuscript
 * and append it to `opendraft.yml`.
 *
 * `addManuscript` validates the id, rejects duplicates against the
 * existing `opendraft.yml` manuscript list without writing anything, then
 * writes the starter document set under `manuscripts/<id>/` and appends
 * `{ id, path }` to the config, preserving the protocol block and any
 * other existing entries.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse, stringify } from 'yaml';
import { OPENDRAFT_CONFIG_PATH } from './scaffold.js';

/** Manuscript id pattern: lowercase alphanumeric groups joined by hyphens. */
const MANUSCRIPT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Build the container article text (metadata frontmatter + refs fence). */
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
 * Build the starter frontmatter for a new manuscript.
 *
 * @returns Frontmatter YAML text stamped with today's local date.
 */
function frontmatterYml(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const date = `${now.getFullYear()}-${mm}-${dd}`;
  return `title: "Article Title"
date: ${date}
keywords:
  - keyword1
  - keyword2
license: "CC BY 4.0"
`;
}

/**
 * Narrow an arbitrary parsed value to a plain record.
 *
 * @param value - Parsed YAML value.
 * @returns The value as a record, or an empty record for non-objects.
 */
function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Create a new manuscript and register it in `opendraft.yml`.
 *
 * Writes the starter document set (`article.qmd`, `_author.yml`,
 * `_abstract.yml`, `_frontmatter.yml`) under `manuscripts/<id>/` and
 * appends `{ id, path }` to the `manuscripts` list of `opendraft.yml`,
 * keeping every existing entry and the protocol block. The id must be
 * lowercase alphanumeric with hyphens; an id already listed in the config
 * is rejected. Both rejections happen before any file is written.
 *
 * @param ws - Workspace adapter to write into (in-place).
 * @param id - Manuscript id and directory name (lowercase alphanumeric + hyphens).
 * @returns Resolves once the starter files and config update are written.
 * @throws If the id is malformed or already listed in `opendraft.yml`.
 */
export async function addManuscript(ws: WorkspaceAdapter, id: string): Promise<void> {
  if (!MANUSCRIPT_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid manuscript id "${id}": must be lowercase alphanumeric with hyphens.`,
    );
  }

  const raw = await ws.readFile(OPENDRAFT_CONFIG_PATH);
  const config = raw === null ? {} : toRecord(parse(raw));
  const listed = Array.isArray(config.manuscripts) ? config.manuscripts : [];
  const duplicate = listed.some((entry) => {
    const entryId = toRecord(entry).id;
    return typeof entryId === 'string' && entryId === id;
  });
  if (duplicate) {
    throw new Error(`Manuscript "${id}" is already listed in ${OPENDRAFT_CONFIG_PATH}.`);
  }

  const dir = `manuscripts/${id}`;
  await ws.writeFile(`${dir}/article.qmd`, containerArticle());
  await ws.writeFile(`${dir}/_author.yml`, AUTHOR_YML);
  await ws.writeFile(`${dir}/_abstract.yml`, ABSTRACT_YML);
  await ws.writeFile(`${dir}/_frontmatter.yml`, frontmatterYml());

  await ws.writeFile(
    OPENDRAFT_CONFIG_PATH,
    stringify({ ...config, manuscripts: [...listed, { id, path: dir }] }),
  );
}
