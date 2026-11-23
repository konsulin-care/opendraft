/**
 * Submit and update suggestions as pull requests on the upstream repository.
 *
 * Sending a draft names it while unpushed, saves it with the fixed "What did
 * you change?" message, then opens a pull request (or reuses the one a failed
 * retry already created). Sending an update only saves with the viewer's
 * message, or the automatic message when none is given. The legacy
 * `submitSuggestion` export keeps the old banner flow working.
 */

import type { ProjectSourceGitHub } from '@opendraft/workspace';
import type { PullRequestInput, PullRequestResult } from '../github/bff-client';
import type { SuggestionPull } from '../github/bff-suggest';
import { saveDraft, saveToCopy } from './save';
import type {
  SaveDeps,
  SaveGitHubDeps,
  SaveGitHubResult,
  SaveRegistry,
  SaveResult,
} from './save';

/** Commit message and pull request title used when a draft is sent. */
export const SEND_MESSAGE = 'What did you change?';
/** Input of the legacy {@link submitSuggestion}. */
export interface SubmitSuggestionInput {
  /** Pull request title. */
  title: string;
  /** Pull request body. */
  body: string;
}

/** Closed state of a suggestion's pull request. */
export type SubmitClosedState = 'merged' | 'closed';

/** Result of the legacy {@link submitSuggestion}. */
export type SubmitResult =
  | { kind: 'created' | 'updated'; number: number; url: string }
  | { kind: 'closed'; state: SubmitClosedState }
  | { kind: 'remote-moved' };

/** Injected dependencies of the legacy {@link submitSuggestion}. */
export interface SubmitDeps extends SaveDeps {
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

/** Input of {@link sendSuggestion}. */
export interface SendSuggestionInput {
  /** Human-readable draft name; applied only while the draft is unpushed. */
  name?: string;
  /** Alias of {@link SendSuggestionInput.name}. */
  draftName?: string;
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
 * @param source - Stored GitHub source of the suggestion.
 * @returns Head ref, prefixed with the fork owner when needed.
 */
function headRef(source: ProjectSourceGitHub): string {
  const onUpstream =
    source.owner.toLowerCase() === source.upstream.owner.toLowerCase();
  return onUpstream ? source.branch : `${source.owner}:${source.branch}`;
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
 * The pull request is looked up after the save, so a retry after a failed
 * creation reuses the existing pull request instead of opening a duplicate.
 *
 * @param projectId - Project id of the draft.
 * @param input - Draft name and pull request note.
 * @param deps - Injected save, naming and GitHub dependencies.
 * @returns The created or reused pull request, a closed state, or a pending save.
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

  const saved = await saveDraft(
    projectId,
    withCommitMessage(deps, SEND_MESSAGE),
  );
  if (saved.kind === 'pending') {
    return { kind: 'pending', pendingSaves: saved.pendingSaves };
  }

  const stored = await loadSource(projectId, deps);
  const head = headRef(stored);
  const { owner, repo, defaultBranch } = stored.upstream;
  const existing = await deps.findSuggestionPull(owner, repo, head);
  if (existing !== null) {
    if (existing.state !== 'open') {
      return { kind: 'closed', state: existing.state };
    }
    if (stored.pullNumber !== existing.number) {
      await storePullNumber(projectId, existing.number, deps);
    }
    return { kind: 'updated', number: existing.number, url: existing.url };
  }

  const created = await deps.createPullRequest(owner, repo, {
    title: SEND_MESSAGE,
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

/**
 * Submit the local edits of a legacy suggestion as a pull request.
 *
 * @param projectId - Project id of the suggestion.
 * @param input - Pull request title and body.
 * @param deps - Injected GitHub, git, registry and workspace dependencies.
 * @returns The created or updated pull request, a closed state, or a moved remote.
 */
export async function submitSuggestion(
  projectId: string,
  input: SubmitSuggestionInput,
  deps: SubmitDeps,
): Promise<SubmitResult> {
  const source = await loadSource(projectId, deps);
  const head = headRef(source);
  const { owner, repo, defaultBranch } = source.upstream;

  let open: SuggestionPull | null = null;
  if (source.pullNumber !== null) {
    const pull = await deps.findSuggestionPull(owner, repo, head);
    if (pull !== null && pull.state !== 'open') {
      return { kind: 'closed', state: pull.state };
    }
    open = pull;
  }

  const saved: SaveResult = await saveToCopy(projectId, {}, deps);
  if (saved.kind === 'remote-moved') return { kind: 'remote-moved' };
  if (open !== null) {
    return { kind: 'updated', number: open.number, url: open.url };
  }

  const created = await deps.createPullRequest(owner, repo, {
    title: input.title,
    head,
    base: defaultBranch,
    body: input.body,
  });
  await storePullNumber(projectId, created.number, deps);
  return { kind: 'created', number: created.number, url: created.url };
}

export default submitSuggestion;
