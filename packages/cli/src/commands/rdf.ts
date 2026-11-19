import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { compileManuscriptGraph, loadManuscriptSnapshot } from '@opendraft/metadata';
import { checkMetadata } from '@opendraft/schema';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { resolveManuscript } from '../resolve-manuscript.js';
import { sourceRevision } from '../source-revision.js';

const RDF_USAGE = 'usage: opendraft rdf [dir] [-m <id>]';

/** Read and parse a YAML file; undefined when absent, throws when invalid. */
function readYaml(path: string): unknown {
  try {
    return parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Parse args into dir and manuscript id; null on usage error. */
function parseArgs(args: string[]): { dir: string | null; id: string | null } | null {
  let dir: string | null = null;
  let id: string | null = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-m' || arg === '--manuscript') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('-')) return null;
      id = value;
      i += 1;
    } else if (arg.startsWith('-') || dir !== null) {
      return null;
    } else {
      dir = arg;
    }
  }
  return { dir, id };
}

/** Collect commit-level metadata errors for a manuscript. */
function metadataErrors(root: string, entry: { id: string; path: string }): string[] {
  const errors: string[] = [];
  const docs: Record<string, unknown> = {};
  const parseErrors: Record<string, string> = {};
  for (const [key, file] of [
    ['frontmatter', '_frontmatter.yml'],
    ['author', '_author.yml'],
    ['abstract', '_abstract.yml'],
  ] as const) {
    try {
      const doc = readYaml(join(root, entry.path, file));
      if (doc !== undefined) docs[key] = doc;
    } catch (error) {
      parseErrors[key] = error instanceof Error ? error.message : String(error);
      errors.push(`${entry.path}/${file}: invalid YAML: ${parseErrors[key]}`);
    }
  }
  for (const issue of checkMetadata({ ...docs, manuscriptId: entry.id, parseErrors })) {
    if (issue.level === 'commit') errors.push(`${issue.path}: ${issue.message}`);
  }
  return errors;
}

/**
 * Print the manuscript's RDF graph as Turtle to stdout.
 *
 * @param args - Arguments after `rdf`: optional dir and `-m <id>`.
 * @returns 0 on success, 1 on invalid metadata, 2 on usage errors.
 */
export async function rdfCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  if (parsed === null) {
    console.error(RDF_USAGE);
    return 2;
  }
  const root = resolve(parsed.dir ?? '.');
  const resolved = resolveManuscript(root, parsed.id);
  if (!resolved.ok) {
    console.error(resolved.message);
    return 1;
  }
  const { entry } = resolved;
  const errors = metadataErrors(root, entry);
  if (errors.length > 0) {
    for (const line of errors) console.error(line);
    return 1;
  }
  const snapshot = await loadManuscriptSnapshot(new NodeFsWorkspace(root), entry, {
    sourceRevision: await sourceRevision(root),
  });
  console.log(compileManuscriptGraph(snapshot).trimEnd());
  return 0;
}
