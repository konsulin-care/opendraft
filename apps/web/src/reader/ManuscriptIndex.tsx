/**
 * Manuscript index of the reader.
 *
 * Lists every manuscript of a repository as a linked card with its title,
 * author byline and a truncated abstract. Each card keeps the current reader
 * path (including a `/tree/<ref>` suffix) and selects its manuscript through
 * `?manuscript=<id>`.
 */

import { useEffect, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { authorDisplayName } from '../components/metadata-panel/byline-model';
import type { MetadataAuthor } from '../components/metadata-panel/use-manuscript-metadata';
import type { ManuscriptEntry } from './load-repo';
import type { ReaderRoute } from './route';

/** Maximum number of abstract characters shown on a card. */
const ABSTRACT_LIMIT = 180;

/** Props for {@link ManuscriptIndex}. */
export interface ManuscriptIndexProps {
  /** Read-only workspace of the loaded repository. */
  workspace: WorkspaceAdapter;
  /** Manuscripts declared by the repository, in display order. */
  manuscripts: readonly ManuscriptEntry[];
  /** Current reader route; supplies the path and `/tree/<ref>` suffix. */
  route: ReaderRoute;
}

/** One card summary derived from a manuscript's metadata files. */
interface ManuscriptSummary {
  /** Manuscript id from `opendraft.yml`. */
  id: string;
  /** Title from `_frontmatter.yml`; '' when missing. */
  title: string;
  /** Author display names in file order. */
  authors: string[];
  /** Abstract text from `_abstract.yml`, truncated for the card. */
  abstract: string;
}

/** Coerce a parsed YAML value to a plain record. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Parse one YAML file; null when missing or unparsable. */
async function readYaml(
  workspace: WorkspaceAdapter,
  path: string,
): Promise<Record<string, unknown> | null> {
  let text: string | null;
  try {
    text = await workspace.readFile(path);
  } catch {
    return null;
  }
  if (text === null) return null;
  try {
    return asRecord(parse(text));
  } catch {
    return null;
  }
}

/**
 * Shorten an abstract to the card limit.
 *
 * @param value - Full abstract text.
 * @returns The trimmed abstract, with an ellipsis when it was shortened.
 */
function truncateAbstract(value: string): string {
  const text = value.trim();
  return text.length <= ABSTRACT_LIMIT ? text : `${text.slice(0, ABSTRACT_LIMIT).trimEnd()}…`;
}

/**
 * Load the card summary of one manuscript.
 *
 * @param workspace - Read-only workspace of the repository.
 * @param id - Manuscript id declared in `opendraft.yml`.
 * @param root - Repository-relative manuscript directory.
 * @returns The title, author names and truncated abstract.
 */
async function loadSummary(
  workspace: WorkspaceAdapter,
  id: string,
  root: string,
): Promise<ManuscriptSummary> {
  const [frontmatter, author, abstract] = await Promise.all([
    readYaml(workspace, `${root}/_frontmatter.yml`),
    readYaml(workspace, `${root}/_author.yml`),
    readYaml(workspace, `${root}/_abstract.yml`),
  ]);

  const rawTitle = frontmatter?.['title'];
  const rawAuthors = author?.['authors'];
  const rawAbstract = abstract?.['abstract'];
  const authors = Array.isArray(rawAuthors)
    ? (rawAuthors as MetadataAuthor[])
        .map((entry) => authorDisplayName(entry))
        .filter((name) => name.length > 0)
    : [];

  return {
    id,
    title: typeof rawTitle === 'string' ? rawTitle : rawTitle == null ? '' : String(rawTitle),
    authors,
    abstract: typeof rawAbstract === 'string' ? truncateAbstract(rawAbstract) : '',
  };
}

/**
 * Build the current reader path for a route.
 *
 * @param route - Parsed reader route with owner, repo and optional ref.
 * @returns `/{owner}/{repo}` with a `/tree/<ref>` suffix when a ref is set.
 */
function readerPath(route: ReaderRoute): string {
  const base = `/${route.owner}/${route.repo}`;
  return route.ref === undefined ? base : `${base}/tree/${route.ref}`;
}

/**
 * Build the index link of one manuscript, keeping the current tree ref.
 *
 * @param route - Current reader route.
 * @param id - Manuscript id to select.
 * @returns The reader path with `?manuscript=<id>`.
 */
export function manuscriptHref(route: ReaderRoute, id: string): string {
  return `${readerPath(route)}?manuscript=${encodeURIComponent(id)}`;
}

/** Render one linked manuscript card. */
function ManuscriptCard({
  summary,
  href,
}: {
  summary: ManuscriptSummary;
  href: string;
}) {
  return (
    <a
      data-testid="manuscript-card"
      data-id={summary.id}
      href={href}
      className="flex h-full flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-600-18 hover:shadow"
    >
      <span data-testid="manuscript-card-title" className="text-base font-semibold text-gray-900">
        {summary.title || summary.id}
      </span>
      {summary.authors.length > 0 ? (
        <span data-testid="manuscript-card-authors" className="text-sm text-gray-600">
          {summary.authors.join(', ')}
        </span>
      ) : null}
      {summary.abstract ? (
        <span data-testid="manuscript-card-abstract" className="text-sm text-gray-700">
          {summary.abstract}
        </span>
      ) : null}
    </a>
  );
}

/**
 * Render the reader manuscript index.
 *
 * Loads each manuscript's metadata through the workspace adapter and renders
 * one linked card per manuscript. Cards appear only after the first load
 * settles, so no half-filled card is ever shown.
 *
 * @param props - See {@link ManuscriptIndexProps}.
 * @returns The responsive grid of manuscript cards.
 */
export function ManuscriptIndex({ workspace, manuscripts, route }: ManuscriptIndexProps) {
  const [summaries, setSummaries] = useState<ManuscriptSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSummaries(null);

    void Promise.all(
      manuscripts.map((manuscript) => loadSummary(workspace, manuscript.id, manuscript.path)),
    ).then((next) => {
      if (!cancelled) setSummaries(next);
    });

    return () => {
      cancelled = true;
    };
  }, [workspace, manuscripts]);

  return (
    <div data-testid="manuscript-index">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries?.map((summary) => (
          <ManuscriptCard
            key={summary.id}
            summary={summary}
            href={manuscriptHref(route, summary.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default ManuscriptIndex;
