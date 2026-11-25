// @vitest-environment jsdom
/**
 * Suggest-edit controller tests: busy state, double-trigger guard, reset after
 * a successful start and reset on a bfcache restore.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import type { StartSuggestionInput, StartSuggestionResult } from '../suggest/start';
import type { ReaderRoute } from './route';
import type { UseSuggestEditInput } from './use-suggest-edit';
import { useSuggestEdit } from './use-suggest-edit';

const ROUTE: ReaderRoute = { owner: 'konsulin-care', repo: 'citizen-science' };

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2030-01-01T00:00:00Z',
};

type Overrides = Partial<
  Pick<UseSuggestEditInput, 'getAccess' | 'start' | 'navigate'>
>;

/** Build repository permissions with fork-friendly defaults. */
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

/** Build a successful start result for the given project. */
function startResult(projectId: string): StartSuggestionResult {
  return { projectId, resumed: 'fresh' };
}

/** Render the hook with route/session defaults and overridable dependencies. */
function setup(overrides: Overrides = {}) {
  return renderHook(() =>
    useSuggestEdit({
      route: ROUTE,
      session: SESSION,
      loginEnabled: true,
      getAccess: overrides.getAccess ?? vi.fn(async () => access()),
      start: overrides.start ?? vi.fn(async () => startResult('project-1')),
      navigate: overrides.navigate ?? vi.fn(),
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('useSuggestEdit busy state', () => {
  it('sets checking before getAccess resolves and ignores a second trigger', async () => {
    let resolveAccess: (value: RepoPermissions) => void = () => undefined;
    const getAccess = vi.fn(
      () =>
        new Promise<RepoPermissions>((resolve) => {
          resolveAccess = resolve;
        }),
    );
    const start = vi.fn(async (_input: StartSuggestionInput) => startResult('project-1'));
    const { result } = setup({ getAccess, start });

    expect(result.current.status).toBe('idle');

    act(() => {
      void result.current.trigger();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('checking');
    });
    expect(getAccess).toHaveBeenCalledTimes(1);

    act(() => {
      void result.current.trigger();
    });
    expect(getAccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAccess(access({ installed: false }));
    });

    expect(result.current.status).toBe('idle');
    expect(start).not.toHaveBeenCalled();
  });
});

describe('useSuggestEdit successful start', () => {
  it('returns to idle with no intent after starting and navigating', async () => {
    const start = vi.fn(async (_input: StartSuggestionInput) => startResult('project-7'));
    const navigate = vi.fn();
    const { result } = setup({ start, navigate });

    await act(async () => {
      await result.current.trigger();
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/');
    expect(localStorage.getItem('opendraft:active-project')).toBe('project-7');
    expect(result.current.status).toBe('idle');
    expect(result.current.intent).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('useSuggestEdit bfcache restore', () => {
  it('resets to idle with no intent and no error on a persisted pageshow', async () => {
    const start = vi.fn(async (): Promise<StartSuggestionResult> => {
      throw new Error('boom');
    });
    const { result } = setup({
      start,
      getAccess: vi.fn(async () => access({ push: true })),
    });

    await act(async () => {
      await result.current.trigger();
    });

    expect(result.current.intent).toEqual({ kind: 'branch' });
    expect(result.current.error).toBe('boom');

    await act(async () => {
      const event = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(event, 'persisted', { value: true });
      window.dispatchEvent(event);
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.intent).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
