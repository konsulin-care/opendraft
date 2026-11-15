import { parse } from 'yaml';
import { parseTurtle, resolveProtocol, validateWithProfile } from '@opendraft/rdf';
import type { ResolveProtocolOptions } from '@opendraft/rdf';
import { compileManuscriptGraph, loadManuscriptSnapshot } from '@opendraft/metadata';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { Finding, ValidateOptions } from './types.js';

/** Options for the RDF stage: validate options plus protocol resolution inputs. */
export interface RdfStageOptions extends ValidateOptions {
  /** Bundled protocol history; the stage is skipped when absent. */
  history?: ResolveProtocolOptions['history'];
  /** `<owner>/<repo>` used to fetch unknown revisions. */
  repository?: string;
  fetch?: ResolveProtocolOptions['fetch'];
  cache?: ResolveProtocolOptions['cache'];
}

const LEVELS: Record<string, Finding['level']> = {
  Violation: 'error',
  Warning: 'warning',
  Info: 'info',
};

async function entries(ws: WorkspaceAdapter): Promise<Array<{ id: string; path: string }>> {
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

function fileEnding(files: Record<string, string>, suffix: string): string {
  const key = Object.keys(files).find((k) => k.endsWith(suffix));
  return key === undefined ? '' : (files[key] ?? '');
}

/**
 * Validate each manuscript's compiled RDF graph against its pinned protocol.
 *
 * @param ws - Workspace to read from.
 * @param manuscriptFindings - Findings of the manuscript stage (used to detect metadata errors).
 * @param options - Validation and protocol resolution options.
 * @returns RDF-stage findings; skips yield a warning.
 */
export async function validateRdfStage(
  ws: WorkspaceAdapter,
  manuscriptFindings: Finding[],
  options: RdfStageOptions = {},
): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const { id, path } of await entries(ws)) {
    const hasErrors = manuscriptFindings.some(
      (f) => f.level === 'error' && (f.location === path || f.location.startsWith(`${path}/`)),
    );
    if (hasErrors) {
      out.push(skipFinding(path, 'manuscript has metadata errors'));
      continue;
    }
    out.push(...(await validateOne(ws, id, path, options)));
  }
  return out;
}

function skipFinding(path: string, reason: string): Finding {
  return { level: 'warning', location: path, path: 'rdf', message: `RDF skipped: ${reason}` };
}

function resultFinding(
  r: {
    severity: { value: string };
    focusNode: { value: string };
    path?: { value: string } | null;
    message: Array<{ value: string }>;
  },
  location: string,
): Finding {
  const sev = r.severity.value.split(/[#/]/).pop() ?? 'Violation';
  return {
    level: LEVELS[sev] ?? 'error',
    location,
    path: [r.focusNode.value, r.path?.value].filter(Boolean).join(' '),
    message: r.message[0]?.value ?? `SHACL ${sev}`,
  };
}

async function validateOne(
  ws: WorkspaceAdapter,
  id: string,
  path: string,
  options: RdfStageOptions,
): Promise<Finding[]> {
  const out: Finding[] = [];
  const skip = (reason: string): Finding[] => [skipFinding(path, reason)];
  {
    const snapshot = await loadManuscriptSnapshot(ws, { id, path }, { sourceRevision: options.sourceRevision });
    const pin = options.protocol ?? snapshot.protocolCommit;
    if (!pin) return skip('no protocol pin in opendraft.yml');
    if (!options.history) return skip('protocol history unavailable');
    const resolved = await resolveProtocol(pin, {
      history: options.history,
      repository: (options.repository ?? snapshot.protocolRepository ?? 'konsulin-care/opendraft')
        .replace(/^https?:\/\/github\.com\//, '')
        .replace(/\/+$/, ''),
      fetch: options.fetch,
      cache: options.cache,
      offline: options.offline,
    });
    if (resolved.status === 'unavailable') {
      return skip(`protocol ${pin} unavailable (${resolved.reason}); try \`opendraft protocol upgrade\``);
    }
    if (resolved.status === 'incompatible') {
      return skip(`protocol ${pin} is incompatible; run \`opendraft protocol upgrade\``);
    }
    if (resolved.status === 'fetched') {
      out.push({
        level: 'warning',
        location: path,
        path: 'rdf',
        message: `protocol ${pin} is unknown to this opendraft; upgrade opendraft`,
      });
    }
    const data = parseTurtle(compileManuscriptGraph(snapshot));
    const base = parseTurtle(fileEnding(resolved.files, 'article.shacl.ttl'));
    const release = parseTurtle(fileEnding(resolved.files, 'article-release.shacl.ttl'));
    const { report } = await validateWithProfile(data, { base, release });
    out.push(...report.results.map((r) => resultFinding(r, path)));
  }
  return out;
}
