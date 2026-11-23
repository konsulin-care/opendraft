/**
 * Browser wiring for the editor's draft section.
 *
 * Keeps the lazy git and BFF imports out of `App.tsx`, which sits at the file
 * size limit. Every action resolves its dependencies on demand so ordinary
 * editor pages never pay for git until a draft action runs.
 */

import type { ProjectRecord, WorkspaceAdapter } from '@opendraft/workspace';
import type { FsClient } from '../../../../packages/git/node_modules/isomorphic-git/index.js';
import type { HttpClient } from '../../../../packages/git/node_modules/isomorphic-git/http/web/index.js';
import type { BffSession } from '../github/bff-client';
import type { DraftSectionDeps } from '../hooks/use-draft-section';
import type { DraftActionContext, DraftSnapshot } from '../hooks/use-draft';
import type { SendSuggestionInput } from './submit';
import type { SendUpdateInput } from './submit';
import type { PublishProjectDeps, PublishTarget } from './publish';

/** Optional injection points for tests and alternate shells. */
export interface DraftSectionDepsOptions {
  /** Publish dependencies; the browser builds them lazily when omitted. */
  publishDeps?: PublishProjectDeps;
}

/** Draft input captured by the publish dialog. */
interface PublishInputLike {
  owner?: string;
  repo?: string;
  private?: boolean;
}

/** Signed-in viewer accessor that rejects anonymous callers. */
type RequireSession = () => BffSession;

/**
 * Build the publish target of a draft publish request.
 *
 * @param session - Signed-in viewer publishing the project.
 * @param input - Owner, repository name and visibility chosen in the dialog.
 * @returns Target naming the receiving account and repository.
 * @throws Error when the dialog did not supply an owner or repository name.
 */
function publishTarget(session: BffSession, input: PublishInputLike): PublishTarget {
  if (input.owner === undefined || input.repo === undefined) {
    throw new Error('Choose an account and a repository name to publish.');
  }
  return {
    owner: input.owner,
    ownerIsUser: input.owner.toLowerCase() === session.login.toLowerCase(),
    name: input.repo,
    private: input.private === true,
  };
}

/**
 * Open the project's persistent repository, initializing it on first use.
 *
 * @param projectId - Project whose repository receives the first commit.
 * @param branch - Branch the first commit lands on.
 * @returns Filesystem client and working directory of the repository.
 */
async function initPublishRepo(
  projectId: string,
  branch: string,
): Promise<{ fs: unknown; dir: string }> {
  await import('../github/buffer-polyfill');
  const git = await import('@opendraft/git');
  const iso = (
    await import('../../../../packages/git/node_modules/isomorphic-git/index.js')
  ).default;
  const fs = git.openProjectFs(projectId);
  const dir = '/';

  try {
    await iso.resolveRef({ fs: fs as FsClient, dir, ref: 'HEAD' });
  } catch {
    await iso.init({ fs: fs as FsClient, dir });
  }
  if (branch !== (await iso.currentBranch({ fs: fs as FsClient, dir }))) {
    await iso.branch({ fs: fs as FsClient, dir, ref: branch, checkout: true });
  }
  return { fs, dir };
}

/**
 * Build the browser publish dependencies for {@link publishProject}.
 *
 * @param session - Signed-in viewer used as the commit author.
 * @returns Registry, workspace, repository, remote and BFF dependencies.
 */
async function createBrowserPublishDeps(
  session: BffSession,
): Promise<PublishProjectDeps> {
  const [{ workspaceManager }, { projectRegistry }, { createRepo }, git] = await Promise.all([
    import('@opendraft/workspace'),
    import('../hooks/useProjects'),
    import('../github/bff-client'),
    import('@opendraft/git'),
  ]);
  const http = (
    await import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js')
  ).default as HttpClient;

  return {
    registry: {
      get: (id) => projectRegistry.get(id),
      setSource: async (id, source) => projectRegistry.setSource(id, source),
    },
    getWorkspace: (id): Promise<WorkspaceAdapter> => workspaceManager.get(id),
    createRepo: (input) => createRepo(input),
    initRepo: (projectId, branch) => initPublishRepo(projectId, branch),
    commitFiles: (fs, dir, opts) =>
      git.commitFilesOnBranch(fs as FsClient, dir, opts),
    push: async (fs, dir, url, branch) => {
      const local = new git.LocalRepo(fs as FsClient, dir, http);
      await local.push({ url, ref: branch });
    },
    relayUrl: (owner, repo) => git.relayUrl(window.location.origin, owner, repo),
    session,
  };
}

/**
 * Load the draft status of a project through the suggestion check.
 *
 * @param project - Project whose draft state is checked.
 * @returns Draft snapshot with its pending save count.
 */
async function loadSnapshot(project: ProjectRecord): Promise<DraftSnapshot> {
  if (project.source.kind !== 'github') {
    return { status: { state: 'local-only' }, pendingSaves: 0 };
  }
  const [{ checkSuggestion }, { createCheckDeps }] = await Promise.all([
    import('./status'),
    import('./browser-deps'),
  ]);
  return { status: await checkSuggestion(project.source, await createCheckDeps()) };
}

/**
 * Build the save and start-new actions for a viewer.
 *
 * @param need - Signed-in viewer accessor.
 * @returns Save and start-new actions of the draft section.
 */
function draftLifecycle(need: RequireSession) {
  return {
    save: async (context: DraftActionContext) => {
      const [{ saveDraft }, { createSaveDeps }] = await Promise.all([
        import('./save'),
        import('./browser-deps'),
      ]);
      return saveDraft(context.project.id, await createSaveDeps(need(), context.resolveConflicts));
    },
    startNew: async (context: DraftActionContext) => {
      const [{ restartSuggestion }, { createRestartDeps }] = await Promise.all([
        import('./restart'),
        import('./browser-deps'),
      ]);
      return restartSuggestion(context.project.id, await createRestartDeps(need()));
    },
  };
}

/**
 * Build the send and update actions for a viewer.
 *
 * @param need - Signed-in viewer accessor.
 * @returns Send and update actions of the draft section.
 */
function submitActions(need: RequireSession) {
  return {
    send: async (context: DraftActionContext, input: SendSuggestionInput) => {
      const [{ sendSuggestion }, { createSubmitDeps }] = await Promise.all([
        import('./submit'),
        import('./browser-deps'),
      ]);
      return sendSuggestion(context.project.id, input, await createSubmitDeps(need()));
    },
    update: async (context: DraftActionContext, input: SendUpdateInput) => {
      const [{ sendUpdate }, { createSubmitDeps }] = await Promise.all([
        import('./submit'),
        import('./browser-deps'),
      ]);
      return sendUpdate(context.project.id, input, await createSubmitDeps(need()));
    },
  };
}

/**
 * Build the publish action for a viewer.
 *
 * @param need - Signed-in viewer accessor.
 * @param options - Optional injected publish dependencies.
 * @returns Publish action of the draft section.
 */
function publishAction(need: RequireSession, options: DraftSectionDepsOptions) {
  return async (context: DraftActionContext, input: PublishInputLike) => {
    const viewer = need();
    const [{ publishProject }, deps] = await Promise.all([
      import('./publish'),
      options.publishDeps ?? createBrowserPublishDeps(viewer),
    ]);
    return publishProject(context.project.id, publishTarget(viewer, input), deps);
  };
}

/**
 * Build the draft section dependencies used by the editor shell.
 *
 * Mirrors the suggestion flow: status, save, send, update and start-new reuse
 * the existing browser factories, while publish runs the real repository
 * creation and first push instead of a placeholder rejection.
 *
 * @param session - Signed-in viewer, or null for an anonymous editor.
 * @param options - Optional injected publish dependencies for tests.
 * @returns Draft section dependencies for {@link useDraftSection}.
 */
export function createDraftSectionDeps(
  session: BffSession | null,
  options: DraftSectionDepsOptions = {},
): DraftSectionDeps {
  const need: RequireSession = () => {
    if (session === null) throw new Error('Sign in to GitHub first.');
    return session;
  };

  return {
    load: loadSnapshot,
    ...draftLifecycle(need),
    ...submitActions(need),
    publish: publishAction(need, options),
  };
}
