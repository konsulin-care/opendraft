import { parse } from 'yaml';
import { checkMetadata, validateAssembly, validateManuscript } from '@opendraft/schema';
import type { PublishFileKey } from '@opendraft/schema';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { checkCitekeys } from './citekeys.js';
import type { Finding } from './types.js';

const META_FILES: ReadonlyArray<[PublishFileKey, string]> = [
  ['frontmatter', '_frontmatter.yml'],
  ['author', '_author.yml'],
  ['abstract', '_abstract.yml'],
];

/**
 * Check one manuscript's assembly (article.qmd vs blocks/) and citekeys.
 *
 * @param ws - Workspace to read from.
 * @param mpath - Project-relative manuscript directory.
 * @returns Findings located at the manuscript files; empty when no article.qmd.
 */
export async function checkManuscriptAssembly(
  ws: WorkspaceAdapter,
  mpath: string,
): Promise<Finding[]> {
  const out: Finding[] = [];
  const assembly = await ws.readFile(`${mpath}/article.qmd`);
  if (assembly === null) return out;
  const files = (await ws.listFiles(`${mpath}/blocks`)).filter((f) => f.endsWith('.qmd'));
  const blockFiles: Record<string, string> = {};
  for (const f of files) {
    const text = await ws.readFile(`${mpath}/blocks/${f}`);
    if (text !== null) blockFiles[`blocks/${f}`] = text;
  }
  const result = validateAssembly({ assembly, blockFiles, files });
  const push = (level: 'error' | 'warning', e: { path: string; message: string }): void => {
    out.push({ level, location: `${mpath}/article.qmd`, path: e.path, message: e.message });
  };
  for (const e of result.errors) push('error', e);
  for (const e of result.warnings) push('warning', e);
  for (const c of await checkCitekeys(ws, mpath, assembly, blockFiles)) {
    out.push({ level: 'error', location: c.location, path: 'citekeys', message: c.message });
  }
  return out;
}

async function manuscriptEntries(ws: WorkspaceAdapter): Promise<Array<{ id: string; path: string }>> {
  const raw = await ws.readFile('opendraft.yml');
  if (raw === null) return [];
  let cfg: unknown;
  try {
    cfg = parse(raw);
  } catch {
    return [];
  }
  const list = (cfg as { manuscripts?: unknown } | null)?.manuscripts;
  if (!Array.isArray(list)) return [];
  const out: Array<{ id: string; path: string }> = [];
  for (const m of list as Array<{ id?: unknown; path?: unknown }>) {
    if (typeof m?.id === 'string' && typeof m?.path === 'string') {
      out.push({ id: m.id, path: m.path.replace(/\/+$/, '') });
    }
  }
  return out;
}

/**
 * Validate every manuscript listed in opendraft.yml.
 *
 * @param ws - Workspace to read from.
 * @param release - Escalate publish-level metadata issues to errors.
 * @returns Findings for the manuscript stage.
 */
export async function validateManuscriptStage(
  ws: WorkspaceAdapter,
  release = false,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const { id, path } of await manuscriptEntries(ws)) {
    const names = await ws.listFiles(path);
    for (const e of validateManuscript(id, names).errors) {
      findings.push({ level: 'error', location: path, path: e.path, message: e.message });
    }
    const docs: Record<string, unknown> = {};
    const parseErrors: Partial<Record<PublishFileKey, string>> = {};
    for (const [key, file] of META_FILES) {
      const text = await ws.readFile(`${path}/${file}`);
      if (text === null) continue;
      try {
        docs[key] = parse(text);
      } catch (e) {
        parseErrors[key] = e instanceof Error ? e.message : String(e);
        findings.push({
          level: 'error',
          location: `${path}/${file}`,
          path: key,
          message: `invalid YAML: ${parseErrors[key]}`,
        });
      }
    }
    for (const issue of checkMetadata({ ...docs, manuscriptId: id, parseErrors })) {
      const level =
        issue.level === 'commit'
          ? 'error'
          : issue.level === 'publish'
            ? release
              ? 'error'
              : 'warning'
            : 'warning';
      const file = META_FILES.find(([k]) => issue.path.startsWith(k))?.[1] ?? '_frontmatter.yml';
      findings.push({ level, location: `${path}/${file}`, path: issue.path, message: issue.message });
    }
    findings.push(...(await checkManuscriptAssembly(ws, path)));
  }
  return findings;
}
