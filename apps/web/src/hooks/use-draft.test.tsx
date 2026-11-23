// @vitest-environment jsdom
/**
 * Draft hook tests: state loads on mount and focus (never on an interval),
 * actions set busy and refresh afterwards, conflicts wait for the dialog
 * resolver, and success notices clear themselves after four seconds.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ProjectRecord } from '@opendraft/workspace';
import type { SaveConflictChoice, SaveGitHubResult } from '../suggest/save';
import type { SendSuggestionResult } from '../suggest/submit';
import type { UseDraftDeps } from './use-draft';
import { DRAFT_NOTICE_TIMEOUT_MS, useDraft } from './use-draft';

const PROJECT: ProjectRecord = {
  id: 'project-1',
  name: 'Draft',
  source: {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: 'od-octocat/paper',
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: false,
    syncedSha: 'sync-sha',
    digest: {},
    pullNumber: null,
  },
  createdAt: 1,
  lastOpenedAt: 1,
};

/**
 * Build hook dependencies with inert defaults and spy hooks.
 *
 * @param overrides - Dependency overrides for the scenario under test.
 * @returns Complete hook dependencies.
 */
function makeDeps(overrides: Partial<UseDraftDeps> = {}): UseDraftDeps {
  return {
    load: vi.fn(async () => ({
      status: { state: 'draft' as const },
      pendingSaves: 1,
    })),
    save: vi.fn(async (): Promise<SaveGitHubResult> => ({ kind: 'unchanged' })),
    send: vi.fn(async (): Promise<SendSuggestionResult> => ({
      kind: 'closed',
      state: 'closed',
    })),
    update: vi.fn(async (): Promise<SaveGitHubResult> => ({ kind: 'unchanged' })),
    startNew: vi.fn(async () => ({ projectId: 'project-1' })),
    publish: vi.fn(async () => ({ repo: 'draft' })),
    ...overrides,
  };
}

/**
 * Render the hook and wait until the initial load has finished.
 *
 * @param deps - Hook dependencies.
 * @returns The rendered hook result.
 */
async function renderReady(deps: UseDraftDeps) {
  const rendered = renderHook(() => useDraft(PROJECT, deps));
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
}

/**
 * Render the hook under fake timers and flush the initial load promise.
 *
 * @param deps - Hook dependencies.
 * @returns The rendered hook result.
 */
async function renderWithFakeTimers(deps: UseDraftDeps) {
  const rendered = renderHook(() => useDraft(PROJECT, deps));
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

/** Advance fake timers and flush the resulting React updates. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useDraft loading', () => {
  it('loads the draft state on mount and derives the draft view', async () => {
    const deps = makeDeps();
    const { result } = await renderReady(deps);

    expect(deps.load).toHaveBeenCalledTimes(1);
    expect(deps.load).toHaveBeenCalledWith(PROJECT);
    expect(result.current.status).toEqual({ state: 'draft' });
    expect(result.current.pendingSaves).toBe(1);
    expect(result.current.view.primary).toBe('Send for review');
    expect(result.current.view.chip).toBe('Draft · 1 save waiting to upload');
  });

  it('reloads the draft state on window focus', async () => {
    const deps = makeDeps();
    const { result } = await renderReady(deps);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(deps.load).toHaveBeenCalledTimes(2));
    expect(result.current.loading).toBe(false);
  });

  it('does not poll the draft state on an interval', async () => {
    vi.useFakeTimers();
    try {
      const deps = makeDeps();
      renderHook(() => useDraft(PROJECT, deps));
      await act(async () => {
        await Promise.resolve();
      });
      expect(deps.load).toHaveBeenCalledTimes(1);

      await advance(60_000);

      expect(deps.load).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useDraft actions', () => {
  it('sets busy while saving and refreshes the state afterwards', async () => {
    let release!: (result: SaveGitHubResult) => void;
    const deps = makeDeps({
      save: vi.fn(
        () =>
          new Promise<SaveGitHubResult>((resolve) => {
            release = resolve;
          }),
      ),
    });
    const { result } = await renderReady(deps);
    expect(deps.load).toHaveBeenCalledTimes(1);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.save();
    });

    await waitFor(() => expect(result.current.busy).toBe(true));
    expect(deps.load).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ kind: 'saved', sha: 'next-sha' });
      await pending;
    });

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(deps.load).toHaveBeenCalledTimes(2);
  });
});

describe('useDraft startNew and publish', () => {
  it('runs startNew and publish with busy tracking and a refresh', async () => {
    const deps = makeDeps();
    const { result } = await renderReady(deps);

    await act(async () => {
      await result.current.startNew();
    });
    expect(deps.startNew).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);

    await act(async () => {
      await result.current.publish({ owner: 'octocat', repo: 'draft' });
    });
    expect(deps.publish).toHaveBeenCalledWith(
      expect.objectContaining({ project: PROJECT }),
      { owner: 'octocat', repo: 'draft' },
    );
    expect(deps.load).toHaveBeenCalledTimes(3);
  });
});

describe('useDraft conflicts', () => {
  it('waits for the conflict dialog resolver before the save completes', async () => {
    let choices: Record<string, SaveConflictChoice> | null = null;
    const deps = makeDeps({
      save: vi.fn(async (context) => {
        choices = await context.resolveConflicts(['manuscripts/paper/index.qmd']);
        return { kind: 'saved' as const, sha: 'next-sha' };
      }),
    });
    const { result } = await renderReady(deps);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.save();
    });

    await waitFor(() =>
      expect(result.current.conflicts).toEqual(['manuscripts/paper/index.qmd']),
    );
    expect(result.current.busy).toBe(true);

    act(() => {
      result.current.resolveConflicts({ 'manuscripts/paper/index.qmd': 'mine' });
    });
    await act(async () => {
      await pending;
    });

    expect(choices).toEqual({ 'manuscripts/paper/index.qmd': 'mine' });
    expect(result.current.conflicts).toBeNull();
    expect(result.current.busy).toBe(false);
  });
});

describe('useDraft notices', () => {
  it('clears the saved notice after four seconds', async () => {
    vi.useFakeTimers();
    try {
      const deps = makeDeps({
        save: vi.fn(async (): Promise<SaveGitHubResult> => ({
          kind: 'saved',
          sha: 'next-sha',
        })),
      });
      const { result } = await renderWithFakeTimers(deps);

      await act(async () => {
        await result.current.save();
      });
      expect(result.current.notice).toBe('Saved to GitHub');

      await advance(DRAFT_NOTICE_TIMEOUT_MS - 1);
      expect(result.current.notice).toBe('Saved to GitHub');

      await advance(1);
      expect(result.current.notice).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useDraft sent notices', () => {
  it('shows the pull request number in the sent notice and clears it', async () => {
    vi.useFakeTimers();
    try {
      const deps = makeDeps({
        send: vi.fn(async (): Promise<SendSuggestionResult> => ({
          kind: 'created',
          number: 7,
          url: 'https://github.com/konsulin-care/draft/pull/7',
        })),
      });
      const { result } = await renderWithFakeTimers(deps);

      await act(async () => {
        await result.current.send({ name: 'Paper' });
      });
      expect(result.current.notice).toBe('Suggestion #7 sent');

      await advance(DRAFT_NOTICE_TIMEOUT_MS);
      expect(result.current.notice).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
