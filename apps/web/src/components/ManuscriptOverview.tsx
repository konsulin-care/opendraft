import { useEffect, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { authorDisplayName } from './metadata-panel/byline-model';
import { ManuscriptCard } from './ManuscriptCard';

/** Summary of one manuscript shown on its overview card. */
interface ManuscriptSummary {
  /** Folder id, e.g. `alpha`. */
  id: string;
  /** Title from `_frontmatter.yml`; '' when missing or empty. */
  title: string;
  /** Author byline, '' when there are no named authors. */
  byline: string;
  /** Keyword pills in file order. */
  keywords: string[];
}

/**
 * Parse one YAML metadata file into a record; missing or unparsable
 * files yield an empty record instead of throwing.
 *
 * @param workspace - Workspace holding the manuscript files.
 * @param path - Repo-relative path of the metadata file.
 * @returns The parsed top-level map, or an empty record.
 */
async function parseFile(
  workspace: WorkspaceAdapter,
  path: string,
): Promise<Record<string, unknown>> {
  const text = await workspace.readFile(path);
  if (text === null) return {};
  try {
    const data: unknown = parse(text);
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/**
 * Derive the manuscript folder ids from a full workspace listing.
 *
 * A folder exists when some stored path lives at least one level below
 * `manuscripts/<id>/`; root-level files such as `references.bib` are
 * not folders.
 *
 * @param paths - Every repo-relative path in the workspace.
 * @returns Sorted unique folder ids under `manuscripts/`.
 */
function manuscriptIds(paths: string[]): string[] {
  const ids = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/').filter((segment) => segment !== '');
    if (segments[0] === 'manuscripts' && segments.length >= 3) ids.add(segments[1]);
  }
  return [...ids].sort();
}

/**
 * Load the card summary of every `manuscripts/<id>` folder.
 *
 * @param workspace - Workspace of the active project.
 * @returns One summary per folder, sorted by folder id.
 */
async function loadSummaries(workspace: WorkspaceAdapter): Promise<ManuscriptSummary[]> {
  const ids = manuscriptIds(await workspace.listAll());
  return Promise.all(ids.map(async (id) => {
    const root = `manuscripts/${id}`;
    const [frontmatter, authorFile] = await Promise.all([
      parseFile(workspace, `${root}/_frontmatter.yml`),
      parseFile(workspace, `${root}/_author.yml`),
    ]);
    const title = frontmatter['title'];
    const rawKeywords = frontmatter['keywords'];
    const keywords = Array.isArray(rawKeywords)
      ? rawKeywords.filter((word): word is string => typeof word === 'string')
      : [];
    const rawAuthors = authorFile['authors'];
    const authors = Array.isArray(rawAuthors) ? rawAuthors : [];
    const byline = authors
      .map((entry) => authorDisplayName(
        typeof entry === 'object' && entry !== null && !Array.isArray(entry)
          ? entry as Parameters<typeof authorDisplayName>[0]
          : {},
      ))
      .filter(Boolean)
      .join(', ');
    return {
      id,
      title: typeof title === 'string' ? title : title == null ? '' : String(title),
      byline,
      keywords,
    };
  }));
}

/** Props for {@link ManuscriptOverview}. */
export interface ManuscriptOverviewProps {
  /** Workspace of the active project. */
  workspace: WorkspaceAdapter;
  /** Open a path; cards open `manuscripts/<id>`. */
  openFile: (path: string) => void;
}

/**
 * Overview of the `manuscripts` folder: one {@link ManuscriptCard} per
 * `manuscripts/<id>` folder with its title, author byline and keyword
 * pills, loaded from the manuscript metadata files. Cards open their
 * manuscript directory through `openFile`.
 *
 * @param props - See {@link ManuscriptOverviewProps}.
 * @returns The overview grid, empty while the listing has not settled.
 */
export function ManuscriptOverview({ workspace, openFile }: ManuscriptOverviewProps) {
  const [summaries, setSummaries] = useState<ManuscriptSummary[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadSummaries(workspace)
      .then((next) => {
        if (!cancelled) setSummaries(next);
      })
      .catch((err: unknown) => {
        console.error('manuscript overview load failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace]);
  return (
    <div data-testid="manuscript-overview" className="h-full overflow-auto p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((summary) => (
          <ManuscriptCard
            key={summary.id}
            id={summary.id}
            title={summary.title}
            byline={summary.byline}
            keywords={summary.keywords}
            onOpen={() => openFile(`manuscripts/${summary.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
