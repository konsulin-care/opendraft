// @vitest-environment jsdom
/**
 * Repository access hook tests: loads permissions for signed-in viewers on
 * mount, skips the lookup when signed out or login is disabled, and stays
 * loading until the lookup settles.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import type { UseRepoAccessInput } from './use-repo-access';
import { useRepoAccess } from './use-repo-access';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2030-01-01T00:00:00Z',
};

/** Build repository permissions with push-friendly defaults. */
function access(overrides: Partial<RepoPermissions> = {}): RepoPermissions {
  return {
    push: true,
    installed: true,
    defaultBranch: 'main',
    private: false,
    allowForking: true,
    viewerInstalledAll: true,
    ...overrides,
  };
}

type Overrides = Partial<Omit<UseRepoAccessInput, 'owner' | 'repo'>>;

/** Render the hook with owner/repo defaults and overridable dependencies. */
function setup(overrides: Overrides = {}) {
  return renderHook(() =>
    useRepoAccess({
      owner: 'konsulin-care',
      repo: 'citizen-science',
      session: SESSION,
      loginEnabled: true,
      getAccess: overrides.getAccess ?? vi.fn(async () => access()),
      ...overrides,
    }),
  );
}

describe('useRepoAccess signed-in viewer', () => {
  it('calls getAccess once per owner/repo and exposes the permissions', async () => {
    const getAccess = vi.fn(async () => access());
    const { result, rerender } = setup({ getAccess });

    await waitFor(() => {
      expect(result.current.access).toEqual(access());
    });
    expect(getAccess).toHaveBeenCalledTimes(1);
    expect(getAccess).toHaveBeenCalledWith('konsulin-care', 'citizen-science');
    expect(result.current.error).toBeNull();

    rerender();
    expect(getAccess).toHaveBeenCalledTimes(1);
  });
});

describe('useRepoAccess without a usable session', () => {
  it('returns access null without calling getAccess when signed out', async () => {
    const getAccess = vi.fn(async () => access());
    const { result } = setup({ session: null, getAccess });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(getAccess).not.toHaveBeenCalled();
    expect(result.current.access).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns access null without calling getAccess when login is disabled', async () => {
    const getAccess = vi.fn(async () => access());
    const { result } = setup({ loginEnabled: false, getAccess });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(getAccess).not.toHaveBeenCalled();
    expect(result.current.access).toBeNull();
  });
});

describe('useRepoAccess loading state', () => {
  it('stays loading until getAccess settles', async () => {
    let resolveAccess: (value: RepoPermissions) => void = () => undefined;
    const getAccess = vi.fn(
      () =>
        new Promise<RepoPermissions>((resolve) => {
          resolveAccess = resolve;
        }),
    );
    const { result } = setup({ getAccess });

    expect(result.current.loading).toBe(true);
    expect(result.current.access).toBeNull();

    await act(async () => {
      resolveAccess(access({ push: false }));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.access).toEqual(access({ push: false }));
  });

  it('exposes the error message when getAccess rejects', async () => {
    const getAccess = vi.fn(async () => {
      throw new Error('permissions unavailable');
    });
    const { result } = setup({ getAccess });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.access).toBeNull();
    expect(result.current.error).toBe('permissions unavailable');
  });
});
