import { parse } from 'yaml';
import { validateOpendraft } from '@opendraft/schema';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { Finding } from './types.js';

const LOCATION = 'project';

function idMismatches(config: unknown): string[] {
  const list = (config as { manuscripts?: unknown })?.manuscripts;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const m of list as Array<{ id?: unknown; path?: unknown }>) {
    if (typeof m?.id !== 'string' || typeof m?.path !== 'string') continue;
    const dir = m.path.replace(/\/+$/, '').split('/').pop();
    if (dir !== m.id) out.push(`manuscript id "${m.id}" differs from directory name "${dir}"`);
  }
  return out;
}

/**
 * Validate project-level files: opendraft.yml, manuscript ids, references.bib.
 *
 * @param ws - Workspace to read from.
 * @returns Findings for the project stage.
 */
export async function validateProjectStage(ws: WorkspaceAdapter): Promise<Finding[]> {
  const findings: Finding[] = [];
  const err = (path: string, message: string): void => {
    findings.push({ level: 'error', location: LOCATION, path, message });
  };
  const raw = await ws.readFile('opendraft.yml');
  if (raw === null) {
    err('opendraft.yml', 'opendraft.yml is missing');
  } else {
    let config: unknown;
    try {
      config = parse(raw);
    } catch (e) {
      err('opendraft.yml', `invalid YAML: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (config !== undefined) {
      const result = validateOpendraft(config);
      for (const e of result.errors) err('opendraft.yml', `${e.path}: ${e.message}`);
      for (const msg of idMismatches(config)) err('opendraft.yml', msg);
    }
  }
  if ((await ws.readFile('manuscripts/references.bib')) === null) {
    findings.push({
      level: 'warning',
      location: LOCATION,
      path: 'manuscripts/references.bib',
      message: 'manuscripts/references.bib is missing',
    });
  }
  return findings;
}
