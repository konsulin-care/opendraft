/** Header status derived from the draft view, project source and remote state. */
import type { ProjectSource } from '@opendraft/workspace';
import type { SuggestionState, SuggestionStatus } from '../suggest/status';

/** Presentation data for the manuscript details header trigger and panel. */
export interface HeaderStatus {
  /** Draft state chip label, including pending saves. */
  draftLabel: string;
  /** Local branch of a GitHub project. */
  branch?: string;
  /** Browser URL of the draft pull request, when one exists. */
  pullRequestUrl?: string;
  /** Transient error or notice shown beside the save glyph. */
  notice?: string | null;
  /** Whether the draft needs attention (revision requested or remote moved). */
  attention: boolean;
}

/** Input of {@link headerStatus}. */
export interface HeaderStatusInput {
  /** Project source: local, or GitHub with its branch state. */
  source: ProjectSource;
  /** Draft view chip label. */
  draftLabel: string;
  /** Remote suggestion state reported by the status check. */
  status: SuggestionStatus | null;
  /** Error of the last draft action, if any. */
  error?: string | null;
  /** Notice of the last draft action, if any. */
  notice?: string | null;
}

const ATTENTION_STATES: readonly SuggestionState[] = ['revision-needed', 'remote-moved'];

/**
 * Build the header status of a local or GitHub-backed draft.
 *
 * GitHub projects expose the branch and pull request URL; local projects have
 * neither. A draft error takes precedence over a notice, and only a requested
 * revision or a moved remote branch asks for attention.
 *
 * @param input - Project source, draft label, remote status, error and notice.
 * @returns The header status used by the manuscript details trigger and panel.
 */
export function headerStatus({
  source,
  draftLabel,
  status,
  error,
  notice,
}: HeaderStatusInput): HeaderStatus {
  const attention = status !== null && ATTENTION_STATES.includes(status.state);
  if (source.kind !== 'github') {
    return { draftLabel, notice: error ?? notice ?? null, attention };
  }
  return {
    draftLabel,
    branch: source.branch,
    pullRequestUrl: status?.url,
    notice: error ?? notice ?? null,
    attention,
  };
}
