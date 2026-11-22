/**
 * Edit plan tests for the "Suggest edits" action.
 */
import { describe, expect, it } from 'vitest';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { planEditIntent } from './edit-intent';

const session: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'Octo Cat',
  expiresAt: '2025-01-01T00:00:00Z',
};

/**
 * Build repository permissions with sensible defaults.
 *
 * @param overrides - Fields to override.
 * @returns Repository permissions for a plan test.
 */
function access(overrides: Partial<RepoPermissions> = {}): RepoPermissions {
  return {
    push: false,
    installed: true,
    defaultBranch: 'main',
    private: false,
    allowForking: true,
    viewerInstalledAll: true,
    ...overrides,
  };
}

describe('planEditIntent access checks', () => {
  it('blocks editing when login is disabled', () => {
    expect(
      planEditIntent({ loginEnabled: false, session, access: access() }),
    ).toEqual({ kind: 'blocked', reason: 'login_disabled' });
  });

  it('asks anonymous viewers to sign in', () => {
    expect(
      planEditIntent({ loginEnabled: true, session: null, access: access() }),
    ).toEqual({ kind: 'sign-in' });
  });

  it('uses a branch when the viewer can push and the app is installed', () => {
    expect(
      planEditIntent({
        loginEnabled: true,
        session,
        access: access({ push: true, installed: true }),
      }),
    ).toEqual({ kind: 'branch' });
  });

  it('installs on the upstream when a writer cannot push yet', () => {
    expect(
      planEditIntent({
        loginEnabled: true,
        session,
        access: access({ push: true, installed: false }),
      }),
    ).toEqual({ kind: 'install', scope: 'upstream' });
  });

  it('blocks non-writers when the app is not installed upstream', () => {
    expect(
      planEditIntent({
        loginEnabled: true,
        session,
        access: access({ push: false, installed: false }),
      }),
    ).toEqual({ kind: 'blocked', reason: 'upstream_not_installed' });
  });
});

describe('planEditIntent fork checks', () => {
  it('blocks forking when a private repository disallows forks', () => {
    expect(
      planEditIntent({
        loginEnabled: true,
        session,
        access: access({ private: true, allowForking: false }),
      }),
    ).toEqual({ kind: 'blocked', reason: 'fork_disabled' });
  });

  it('installs on the personal account without an all-repositories install', () => {
    expect(
      planEditIntent({
        loginEnabled: true,
        session,
        access: access({ viewerInstalledAll: false }),
      }),
    ).toEqual({ kind: 'install', scope: 'personal' });
  });

  it('forks when the viewer is fully set up', () => {
    expect(
      planEditIntent({
        loginEnabled: true,
        session,
        access: access({
          private: true,
          allowForking: true,
          viewerInstalledAll: true,
        }),
      }),
    ).toEqual({ kind: 'fork' });
  });

  it('treats missing permissions as not installed upstream', () => {
    expect(
      planEditIntent({ loginEnabled: true, session, access: null }),
    ).toEqual({ kind: 'blocked', reason: 'upstream_not_installed' });
  });
});
