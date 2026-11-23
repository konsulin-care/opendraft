// @vitest-environment jsdom
/**
 * Editor session hook tests: loads the BFF session once and signs out by
 * clearing the BFF session, purging private projects, then dropping the state.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BffSession } from '../github/bff-client';
import type { UseSessionDeps } from './use-session';
import { useSession } from './use-session';

const SESSION: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  expiresAt: '2030-01-01T00:00:00Z',
};

/**
 * Build session dependencies with inert defaults and spy hooks.
 *
 * @param overrides - Dependency overrides for the scenario under test.
 * @returns Complete hook dependencies.
 */
function makeDeps(overrides: Partial<UseSessionDeps> = {}): UseSessionDeps {
  return {
    getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
    logout: vi.fn(async () => undefined),
    purge: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('useSession loading', () => {
  it('returns the loaded session and loginEnabled after getSessionState resolves', async () => {
    const deps = makeDeps({
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: false })),
    });

    const { result } = renderHook(() => useSession(deps));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toEqual(SESSION);
    expect(result.current.loginEnabled).toBe(false);
  });

  it('loads the session only once across rerenders', async () => {
    const deps = makeDeps();
    const { result, rerender } = renderHook(() => useSession(deps));
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender();
    rerender();

    expect(deps.getSessionState).toHaveBeenCalledTimes(1);
  });
});

describe('useSession logout', () => {
  it('logs out through the BFF, purges private projects, then exposes session null', async () => {
    const calls: string[] = [];
    const deps = makeDeps({
      logout: vi.fn(async () => {
        calls.push('logout');
      }),
      purge: vi.fn(async () => {
        calls.push('purge');
      }),
    });
    const { result } = renderHook(() => useSession(deps));
    await waitFor(() => expect(result.current.session).toEqual(SESSION));

    await act(async () => {
      await result.current.logout();
    });

    expect(calls).toEqual(['logout', 'purge']);
    expect(deps.logout).toHaveBeenCalledTimes(1);
    expect(deps.purge).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
  });

  it('drops the session even when the BFF logout fails', async () => {
    const deps = makeDeps({
      logout: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const { result } = renderHook(() => useSession(deps));
    await waitFor(() => expect(result.current.session).toEqual(SESSION));

    await act(async () => {
      await expect(result.current.logout()).rejects.toThrow('offline');
    });

    expect(deps.purge).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
  });
});
