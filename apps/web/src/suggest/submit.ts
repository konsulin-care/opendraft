/**
 * Submit and update suggestions as pull requests on the upstream repository.
 *
 * Sending a draft names it while unpushed, saves it with the viewer's title
 * (or the fixed "What did you change?" message), then opens a pull request (or
 * reuses the one a failed retry already created). Sending an update only saves
 * with the viewer's message, or the automatic message when none is given. The
 * legacy `submitSuggestion` export lives in `./submit-legacy` and is re-exported
 * here to keep the old banner flow working.
 */

import type { ProjectSourceGitHub } from '@opendraft/workspace';
import type { PullRequestInput, PullRequestResult } from '../github/bff-client';
import type { SuggestionPull } from '../github/bff-suggest';
import { saveDraft } from './save';
import type {
  SaveGitHubDeps,
  SaveGitHubResult,
  SaveRegistry,
} from './save';
import type { SubmitClosedState } from './submit-legacy';

/** Commit message and pull request title used when a draft is sent. */
export const SEND_MESSAGE = 'What did you change?';

/** Input of {@link sendSuggestion}. */
export interface SendSuggestionInput {
  /** Human-readable draft name; applied only while the draft is unpushed. */
  name?: string;
  /** Alias of {@link SendSuggestionInput.name}. */
  draftName?: string;
  /** Title used for both the pull request and the send commit message. */
  title?: string;
  /** Note stored as the pull request body. */
  note?: string;
}

/** Input of {@link sendUpdate}. */
export interface SendUpdateInput {
  /** Commit message; the automatic message is used when empty. */
  message?: string;
  /** Alias of {@link SendUpdateInput.message}. */
  note?: string;
}

/** Injected dependencies of {@link sendSuggestion} and {@link sendUpdate}. */
export interface SendSuggestionDeps extends SaveGitHubDeps {
  /** Rename the local draft branch and store its name. */
  applyName: (projectId: string, name: string) => Promise<string>;
  /** Find the pull request whose head matches a suggestion branch. */
  findSuggestionPull: (
    owner: string,
    repo: string,
    head: string,
  ) => Promise<SuggestionPull | null>;
  /** Open a pull request between a head and a base branch. */
  createPullRequest: (
    owner: string,
    repo: string,
    input: PullRequestInput,
  ) => Promise<PullRequestResult>;
}

/** Result of {@link sendSuggestion}. */
export type SendSuggestionResult =
  | { kind: 'created' | 'updated'; number: number; url: string }
  | { kind: 'closed'; state: SubmitClosedState }
  | { kind: 'pending'; pendingSaves: number };
/** Registry subset needed to load a project source. */
interface SourceDeps {
  /** Read a project record. */
  registry: SaveRegistry;
}

/**
 * Load the GitHub source of a suggestion project.
 *
 * @param projectId - Project id to load.
 * @param deps - Injected registry.
 * @returns The stored GitHub source.
 * @throws Error when the project is missing or is not backed by GitHub.
 */
async function loadSource(
  projectId: string,
  deps: SourceDeps,
): Promise<ProjectSourceGitHub> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.source.kind !== 'github') {
    throw new Error(`Project is not a GitHub suggestion: ${projectId}`);
  }
  return project.source;
}

/**
 * Build the pull request head ref of a suggestion.
 *
 * The head is always qualified as `owner:branch`; GitHub ignores an unqualified
 * head filter, so a bare branch name would select the newest pull request of the
 * whole repository.
 *
 * @param source - Stored GitHub source of the suggestion.
 * @returns Head ref accepted by the pull request API.
 */
function headRef(source: ProjectSourceGitHub): string {
  return `${source.owner}:${source.branch}`;
}

/**
 * Store the created pull request number on the project source.
 *
 * @param projectId - Project id to update.
 * @param number - Pull request number.
 * @param deps - Injected registry.
 */
async function storePullNumber(
  projectId: string,
  number: number,
  deps: SourceDeps,
): Promise<void> {
  const source = await loadSource(projectId, deps);
  await deps.registry.setSource(projectId, { ...source, pullNumber: number });
}

/**
 * Force a commit message on the next save.
 *
 * @param deps - Save dependencies to wrap.
 * @param message - Message to use, or null to keep the automatic message.
 * @returns Dependencies whose commits use the requested message.
 */
function withCommitMessage(
  deps: SaveGitHubDeps,
  message: string | null,
): SaveGitHubDeps {
  if (message === null) return deps;
  return {
    ...deps,
    commitWorkspace: (projectId) => deps.commitWorkspace(projectId, message),
  };
}

/**
 * Read the requested draft name from a send input.
 *
 * @param input - Send input.
 * @returns The trimmed draft name, or an empty string when absent.
 */
function draftName(input: SendSuggestionInput): string {
  return (input.draftName ?? input.name ?? '').trim();
}

/**
 * Send a draft for review: name it, save it and open a pull request.
 *
 * Only an open pull request counts as existing: the branch push already updated
 * it. A merged or closed pull request is not reopened, so a new one is created
 * for the current head. Creation errors (for example "no commits between") are
 * left to the caller so the UI can show GitHub's message.
 *
 * @param projectId - Project id of the draft.
 * @param input - Draft name and pull request note.
 * @param deps - Injected save, naming and GitHub dependencies.
 * @returns The created or reused pull request, or a pending save.
 */
export async function sendSuggestion(
  projectId: string,
  input: SendSuggestionInput,
  deps: SendSuggestionDeps,
): Promise<SendSuggestionResult> {
  const source = await loadSource(projectId, deps);
  if (!source.pushed) {
    const name = draftName(input);
    if (name !== '') await deps.applyName(projectId, name);
  }

  const title = input.title?.trim() || SEND_MESSAGE;
  const saved = await saveDraft(
    projectId,
    withCommitMessage(deps, title),
  );
  if (saved.kind === 'pending') {
    return { kind: 'pending', pendingSaves: saved.pendingSaves };
  }

  const stored = await loadSource(projectId, deps);
  const head = headRef(stored);
  const { owner, repo, defaultBranch } = stored.upstream;
  const existing = await deps.findSuggestionPull(owner, repo, head);
  if (existing !== null && existing.state === 'open') {
    if (stored.pullNumber !== existing.number) {
      await storePullNumber(projectId, existing.number, deps);
    }
    return { kind: 'updated', number: existing.number, url: existing.url };
  }

  const created = await deps.createPullRequest(owner, repo, {
    title,
    head,
    base: defaultBranch,
    body: input.note ?? '',
  });
  await storePullNumber(projectId, created.number, deps);
  return { kind: 'created', number: created.number, url: created.url };
}

/**
 * Send an update to an existing draft without opening another pull request.
 *
 * @param projectId - Project id of the draft.
 * @param input - Optional commit message ("What's new?" in the UI).
 * @param deps - Injected save dependencies.
 * @returns The save outcome.
 */
export async function sendUpdate(
  projectId: string,
  input: SendUpdateInput,
  deps: SendSuggestionDeps,
): Promise<SaveGitHubResult> {
  const message = (input.message ?? input.note ?? '').trim();
  return saveDraft(
    projectId,
    withCommitMessage(deps, message === '' ? null : message),
  );
}

/** Alias of {@link sendUpdate} for callers that prefer the longer name. */
export const updateSuggestion = sendUpdate;

export {
  submitSuggestion,
  submitSuggestion as default,
} from './submit-legacy';
export type {
  SubmitClosedState,
  SubmitDeps,
  SubmitResult,
  SubmitSuggestionInput,
} from './submit-legacy';
