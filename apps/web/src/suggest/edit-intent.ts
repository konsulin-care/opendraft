/**
 * Edit plan for the "Suggest edits" action in the reader.
 *
 * The plan decides what the viewer must do before they can edit: sign in,
 * install the GitHub App, fork, or work on a branch. It is pure so the reader
 * can render the plan without touching the network.
 */

import type { BffSession, RepoPermissions } from '../github/bff-client';

/** Reason a viewer cannot edit a repository right now. */
export type BlockedReason =
  | 'login_disabled'
  | 'upstream_not_installed'
  | 'fork_disabled';

/** Where the viewer must install the GitHub App. */
export type InstallScope = 'personal' | 'upstream';

/** Next step the reader must take so the viewer can suggest edits. */
export type EditIntent =
  | { kind: 'sign-in' }
  | { kind: 'blocked'; reason: BlockedReason }
  | { kind: 'install'; scope: InstallScope }
  | { kind: 'branch' }
  | { kind: 'fork' };

/** Input of {@link planEditIntent}. */
export interface EditIntentInput {
  /** Whether the BFF allows signing in at all. */
  loginEnabled: boolean;
  /** Current BFF session, or null for anonymous viewers. */
  session: BffSession | null;
  /** Repository permissions and installation state, or null when unknown. */
  access: RepoPermissions | null;
}

/**
 * Decide the next step for a viewer who wants to suggest edits.
 *
 * Order matters: login availability, authentication, write access,
 * installation state, fork policy and the viewer's all-repositories install.
 *
 * @param input - Login availability, session and repository access.
 * @returns The edit plan.
 */
export function planEditIntent(input: EditIntentInput): EditIntent {
  const { loginEnabled, session, access } = input;

  if (!loginEnabled) {
    return { kind: 'blocked', reason: 'login_disabled' };
  }

  if (!session) {
    return { kind: 'sign-in' };
  }

  const push = access?.push === true;
  const installed = access?.installed === true;

  if (push && installed) {
    return { kind: 'branch' };
  }

  if (push && !installed) {
    return { kind: 'install', scope: 'upstream' };
  }

  if (!installed) {
    return { kind: 'blocked', reason: 'upstream_not_installed' };
  }

  if (access?.private === true && access.allowForking === false) {
    return { kind: 'blocked', reason: 'fork_disabled' };
  }

  if (access?.viewerInstalledAll !== true) {
    return { kind: 'install', scope: 'personal' };
  }

  return { kind: 'fork' };
}
