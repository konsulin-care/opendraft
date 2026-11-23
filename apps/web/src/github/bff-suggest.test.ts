/**
 * Suggestion client tests: branch listing, pull request lookup and fork sync
 * against an injectable fetch double.
 */
import { describe, expect, it, vi } from 'vitest';
import { BffError } from './bff-client';
import { findSuggestionPull, listSuggestionBranches, syncFork } from './bff-suggest';

/** Build a minimal fetch Response double. */
function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('listSuggestionBranches', () => {
  it('requests the encoded prefix and returns the name and sha list', async () => {
    const branches = [
      { name: 'opendraft/ada/20260101-120000', sha: 'aaa111' },
      { name: 'opendraft/ada/20260102-130000', sha: 'bbb222' },
    ];
    const fetchFn = vi.fn(async () => response(branches));

    await expect(
      listSuggestionBranches('octocat', 'draft', 'opendraft/ada/', fetchFn as unknown as typeof fetch),
    ).resolves.toEqual(branches);

    expect(fetchFn).toHaveBeenCalledWith('/@api/repos/octocat/draft/branches?prefix=opendraft%2Fada%2F', {
      credentials: 'same-origin',
    });
  });
});

describe('findSuggestionPull', () => {
  it('returns null for a 404 answer', async () => {
    const fetchFn = vi.fn(async () => response({ error: 'not_found' }, 404));

    await expect(
      findSuggestionPull(
        'octocat',
        'draft',
        'octocat:opendraft/ada/20260101-120000',
        fetchFn as unknown as typeof fetch,
      ),
    ).resolves.toBeNull();

    expect(fetchFn).toHaveBeenCalledWith(
      '/@api/repos/octocat/draft/pulls?head=octocat%3Aopendraft%2Fada%2F20260101-120000',
      { credentials: 'same-origin' },
    );
  });

  it('returns the number, url and state otherwise', async () => {
    const pull = { number: 12, url: 'https://github.example/octocat/draft/pull/12', state: 'open' as const };
    const fetchFn = vi.fn(async () => response(pull));

    await expect(
      findSuggestionPull(
        'octocat',
        'draft',
        'octocat:opendraft/ada/20260101-120000',
        fetchFn as unknown as typeof fetch,
      ),
    ).resolves.toEqual(pull);
  });
});

describe('findSuggestionPull review state', () => {
  it('returns the review state when the BFF reports one', async () => {
    const pull = {
      number: 12,
      url: 'https://github.example/octocat/draft/pull/12',
      state: 'open' as const,
      reviewState: 'changes_requested' as const,
    };
    const fetchFn = vi.fn(async () => response(pull));

    await expect(
      findSuggestionPull(
        'octocat',
        'draft',
        'octocat:opendraft/ada/20260101-120000',
        fetchFn as unknown as typeof fetch,
      ),
    ).resolves.toEqual(pull);
  });
});

describe('syncFork', () => {
  it('posts the branch to merge-upstream', async () => {
    const fetchFn = vi.fn(async () => response({ merged: true }));

    await syncFork('octocat', 'draft', 'opendraft/ada/20260101-120000', fetchFn as unknown as typeof fetch);

    expect(fetchFn).toHaveBeenCalledWith('/@api/repos/octocat/draft/merge-upstream', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: 'opendraft/ada/20260101-120000' }),
    });
  });

  it('raises BffError with code conflict on a 409', async () => {
    const fetchFn = vi.fn(async () => response({ error: 'conflict' }, 409));

    await expect(
      syncFork('octocat', 'draft', 'opendraft/ada/20260101-120000', fetchFn as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(BffError);
    await expect(
      syncFork('octocat', 'draft', 'opendraft/ada/20260101-120000', fetchFn as unknown as typeof fetch),
    ).rejects.toMatchObject({ name: 'BffError', code: 'conflict', status: 409 });
  });
});
