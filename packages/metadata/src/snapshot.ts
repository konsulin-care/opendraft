/**
 * Manuscript snapshot: the parsed inputs of the RDF compiler.
 */

import { parse as parseYaml } from 'yaml';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { listBlocks, splitHeading } from '@opendraft/manuscript';

/** Manuscript entry from opendraft.yml. */
export interface SnapshotEntry {
  /** Manuscript id. */
  id: string;
  /** Manuscript directory, e.g. `manuscripts/demo`. */
  path: string;
}

/** Optional context supplied by the caller. */
export interface SnapshotContext {
  /** Source revision (commit SHA) the snapshot was taken at. */
  sourceRevision?: string;
  /** DOI of this version, when released. */
  versionDoi?: string;
}

/** One section in include order. */
export interface SnapshotSection {
  /** Short name. */
  short: string;
  /** Heading title. */
  title: string;
  /** Role without `deo-` prefix, or null. */
  role: string | null;
}

/** Parsed manuscript inputs. */
export interface ManuscriptSnapshot {
  manuscriptId: string;
  manuscriptPath: string;
  /** Project repository URL from opendraft.yml. */
  repository?: string;
  protocolRepository?: string;
  protocolCommit?: string;
  conceptDoi?: string;
  sourceRevision?: string;
  versionDoi?: string;
  frontmatter: Record<string, unknown>;
  author: Record<string, unknown>;
  abstract: Record<string, unknown>;
  sections: SnapshotSection[];
}

/** Parse YAML text into an object; empty or invalid yields {}. */
function parseObject(text: string | null): Record<string, unknown> {
  if (text === null) return {};
  try {
    const data: unknown = parseYaml(text);
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Return the value when it is a string. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Load a manuscript snapshot from the workspace.
 *
 * @param ws - Workspace adapter.
 * @param entry - Manuscript entry (id and path).
 * @param ctx - Optional sourceRevision and versionDoi.
 * @returns The parsed snapshot.
 */
export async function loadManuscriptSnapshot(
  ws: WorkspaceAdapter,
  entry: SnapshotEntry,
  ctx: SnapshotContext = {},
): Promise<ManuscriptSnapshot> {
  const config = parseObject(await ws.readFile('opendraft.yml'));
  const protocol = parseObject(null);
  const proto = typeof config.protocol === 'object' && config.protocol !== null
    ? (config.protocol as Record<string, unknown>)
    : protocol;
  const dir = entry.path;
  const items = await listBlocks(ws, dir);
  const sections: SnapshotSection[] = [];
  for (const item of items) {
    const text = await ws.readFile(`${dir}/blocks/${item.file}`);
    const role = text === null ? null : splitHeading(text).type;
    sections.push({ short: item.short, title: item.title, role });
  }
  return {
    manuscriptId: entry.id,
    manuscriptPath: dir,
    repository: str(config.repository),
    protocolRepository: str(proto.repository),
    protocolCommit: str(proto.commit),
    conceptDoi: str(config['concept-doi']),
    sourceRevision: ctx.sourceRevision,
    versionDoi: ctx.versionDoi,
    frontmatter: parseObject(await ws.readFile(`${dir}/_frontmatter.yml`)),
    author: parseObject(await ws.readFile(`${dir}/_author.yml`)),
    abstract: parseObject(await ws.readFile(`${dir}/_abstract.yml`)),
    sections,
  };
}
