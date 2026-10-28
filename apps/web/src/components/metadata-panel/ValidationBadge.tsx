/**
 * Validation badge of the manuscript metadata panel.
 *
 * Driven by the publish profile (@opendraft/schema): the badge shows
 * "{n} to publish · {m} to commit" (a warning-only badge falls back to
 * "{w} warnings"), hides when there are no issues, and clicking it
 * expands the panel and lists the issues. Selecting an issue resolves
 * the field it belongs to so the panel can focus it.
 */
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Circle } from 'lucide-react';
import { checkPublishReadiness, type PublishIssue } from '@opendraft/schema';
import type { ManuscriptMetadata } from './use-manuscript-metadata';

/** Issue counts per publish-profile level. */
export interface IssueCounts {
  /** Publish-blocking issues. */
  publish: number;
  /** Commit-blocking issues. */
  commit: number;
  /** Warnings (missing license, missing abstract). */
  warnings: number;
}

/** Where selecting one issue moves the focus. */
export interface IssueFocusTarget {
  /** Author index to open in the authors dialog; null for non-author paths. */
  index: number | null;
  /** data-testid of the field to focus; null when the path has no field. */
  focus: string | null;
}

/**
 * Compute the publish-profile issues of one manuscript's metadata.
 *
 * @param meta - Loaded metadata snapshot of the manuscript root.
 * @returns Issues ordered commit, publish, warning; [] when ready.
 */
export function publishIssues(meta: ManuscriptMetadata): PublishIssue[] {
  return checkPublishReadiness({
    frontmatter: meta.frontmatter,
    author: { authors: meta.authors, affiliations: meta.affiliations },
    abstract: typeof meta.abstract === 'string' ? { abstract: meta.abstract } : {},
  });
}

/**
 * Count issues per level.
 *
 * @param issues - Publish-profile issues.
 * @returns The publish, commit and warning counts.
 */
export function countIssues(issues: PublishIssue[]): IssueCounts {
  const counts: IssueCounts = { publish: 0, commit: 0, warnings: 0 };
  for (const issue of issues) counts[issue.level === 'publish' ? 'publish' : issue.level === 'commit' ? 'commit' : 'warnings'] += 1;
  return counts;
}

/**
 * Badge label for a set of issues.
 *
 * @param issues - Publish-profile issues.
 * @returns "{n} to publish · {m} to commit"; warnings only surface when
 * nothing blocks; '' when there are no issues.
 */
export function badgeLabel(issues: PublishIssue[]): string {
  const { publish, commit, warnings } = countIssues(issues);
  const parts: string[] = [];
  if (publish > 0) parts.push(`${publish} to publish`);
  if (commit > 0) parts.push(`${commit} to commit`);
  if (parts.length === 0 && warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/**
 * Resolve the focus target of an issue path.
 *
 * Author paths (authors.N.affiliations/email/orcid) open the authors
 * dialog focused on that author and target the affiliation picker or
 * the email/ORCID field; title and abstract target their inputs.
 *
 * @param path - Dotted field path of the issue, e.g. 'authors.1.affiliations'.
 * @returns The dialog author index and the field testid to focus.
 */
export function issueFocusTarget(path: string): IssueFocusTarget {
  if (path === 'title') return { index: null, focus: 'metadata-panel-title-input' };
  if (path === 'abstract') return { index: null, focus: 'metadata-abstract' };
  const match = /^authors\.(\d+)\.(affiliations|email|orcid)$/.exec(path);
  if (!match) return { index: null, focus: null };
  const fields: Record<string, string> = {
    affiliations: 'affiliation-search',
    email: 'author-email',
    orcid: 'author-orcid',
  };
  return { index: Number(match[1]), focus: fields[match[2]] };
}

/** Props for {@link ValidationBadge}. */
export interface ValidationBadgeProps {
  /** Publish-profile issues of the manuscript. */
  issues: PublishIssue[];
  /** Called when an issue is selected from the list. */
  onSelect?: (issue: PublishIssue) => void;
  /** Called when the list opens (the panel should expand). */
  onOpen?: () => void;
}

/**
 * Collapsed-bar validation badge with its expandable issue list.
 *
 * @param props - See {@link ValidationBadgeProps}.
 * @returns The badge with the issue list, or null when there are no issues.
 */
export function ValidationBadge({ issues, onSelect, onOpen }: ValidationBadgeProps): ReactNode {
  const [open, setOpen] = useState(false);
  if (issues.length === 0) return null;
  const toggle = (): void => {
    setOpen(!open);
    if (!open) onOpen?.();
  };
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        data-testid="validation-badge"
        aria-expanded={open}
        aria-label="Validation issues"
        onClick={toggle}
        className="min-h-11 rounded border border-secondary px-2 text-sm hover:bg-hover"
      >
        {badgeLabel(issues)}
      </button>
      {open && (
        <ul
          data-testid="validation-issue-list"
          role="list"
          className="absolute right-0 top-full z-20 mt-1 w-72 rounded border border-secondary bg-white p-1 text-sm shadow"
        >
          {issues.map((issue, index) => (
            <li key={`${issue.level}-${issue.path}-${index}`}>
              <button
                type="button"
                data-testid="validation-issue"
                data-path={issue.path}
                title={issue.level}
                onClick={() => {
                  setOpen(false);
                  onSelect?.(issue);
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded px-2 text-left hover:bg-hover"
              >
                {issue.level === 'warning'
                  ? <AlertTriangle aria-hidden className="inline size-4 shrink-0 text-amber-800" />
                  : <Circle aria-hidden className="inline size-4 shrink-0" />}
                <span>{issue.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
