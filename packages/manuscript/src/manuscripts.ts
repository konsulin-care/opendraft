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
import { MANUSCRIPT_ID_PATTERN } from '@opendraft/schema';
import { parse, stringify } from 'yaml';
import { OPENDRAFT_CONFIG_PATH } from './scaffold.js';
import { starterManuscriptFiles, todayIsoDate } from './templates.js';

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
  for (const [file, content] of Object.entries(starterManuscriptFiles(todayIsoDate()))) {
    await ws.writeFile(`${dir}/${file}`, content);
  }

  await ws.writeFile(
    OPENDRAFT_CONFIG_PATH,
    stringify({ ...config, manuscripts: [...listed, { id, path: dir }] }),
  );
}
