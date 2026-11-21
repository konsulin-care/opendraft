/**
 * BFF client tests: session reads, same-origin JSON POST helpers, error
 * mapping to BffError and the auth URL builders.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BffError,
  createPullRequest,
  createRepo,
  forkRepo,
  getRepoPermissions,
  getSession,
  installUrl,
  loginUrl,
  logout,
  type BffSession,
} from './bff-client';

/** Build a minimal fetch Response double. */
function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Build a Response double whose JSON body is malformed. */
function brokenResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError('not json');
    },
  } as unknown as Response;
}

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

describe('getSession', () => {
  it('returns the parsed session on 200', async () => {
    const fetchFn = vi.fn(async () => response(SESSION));
    const session = await getSession(fetchFn as unknown as typeof fetch);

    expect(session).toEqual(SESSION);
    expect(fetchFn).toHaveBeenCalledWith('/@api/auth/session', {
      credentials: 'same-origin',
    });
  });

  it('returns null on 401', async () => {
    const fetchFn = vi.fn(async () => response({ error: 'unauthenticated' }, 401));
    await expect(getSession(fetchFn as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('maps other failures to BffError with the server code', async () => {
    const fetchFn = vi.fn(async () => response({ error: 'upstream_error' }, 502));

    await expect(getSession(fetchFn as unknown as typeof fetch)).rejects.toMatchObject({
      name: 'BffError',
      code: 'upstream_error',
      status: 502,
    });
  });
});

describe('POST helpers', () => {
  it('sends a same-origin JSON request for createPullRequest and returns its result', async () => {
    const fetchFn = vi.fn(async () => response({ number: 7, url: 'https://github.com/octocat/draft/pull/7' }, 201));

    const result = await createPullRequest(
      'octocat',
      'draft',
      { title: 'Init', head: 'opendraft/init', base: 'main', body: 'Scaffold' },
      fetchFn as unknown as typeof fetch,
    );

    expect(result).toEqual({ number: 7, url: 'https://github.com/octocat/draft/pull/7' });
    expect(fetchFn).toHaveBeenCalledWith('/@api/repos/octocat/draft/pulls', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Init', head: 'opendraft/init', base: 'main', body: 'Scaffold' }),
    });
  });

  it('sends a same-origin bodyless POST from logout', async () => {
    const fetchFn = vi.fn(async () => response(undefined, 204));
    await logout(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith('/@api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: undefined,
    });
  });

  it('sends a same-origin bodyless POST from forkRepo', async () => {
    const fetchFn = vi.fn(async () => response({ owner: 'octocat', repo: 'draft', defaultBranch: 'main' }, 201));
    await forkRepo('octocat', 'draft', fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith('/@api/repos/octocat/draft/forks', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: undefined,
    });
  });
});

describe('createRepo and permissions', () => {
  it('sends a same-origin JSON POST from createRepo', async () => {
    const fetchFn = vi.fn(async () =>
      response(
        { owner: 'octocat', name: 'paper', htmlUrl: 'https://github.com/octocat/paper', defaultBranch: 'main' },
        201,
      ),
    );
    await createRepo({ owner: 'octocat', name: 'paper', visibility: 'public' }, fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith('/@api/repos', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: 'octocat', name: 'paper', visibility: 'public' }),
    });
  });

  it('reads permissions with a same-origin GET', async () => {
    const fetchFn = vi.fn(async () => response({ push: true, installed: false, defaultBranch: 'main' }));
    await expect(
      getRepoPermissions('octocat', 'draft', fetchFn as unknown as typeof fetch),
    ).resolves.toEqual({ push: true, installed: false, defaultBranch: 'main' });
    expect(fetchFn).toHaveBeenCalledWith('/@api/repos/octocat/draft/permissions', {
      credentials: 'same-origin',
    });
  });
});

describe('POST helper errors', () => {
  it('throws BffError with the server code and status on failure', async () => {
    const cases: Array<{ call: (fetchFn: typeof fetch) => Promise<unknown>; path: string }> = [
      { call: (fetchFn) => logout(fetchFn), path: '/@api/auth/logout' },
      {
        call: (fetchFn) =>
          createPullRequest(
            'octocat',
            'draft',
            { title: 'Init', head: 'opendraft/init', base: 'main', body: '' },
            fetchFn,
          ),
        path: '/@api/repos/octocat/draft/pulls',
      },
      { call: (fetchFn) => forkRepo('octocat', 'draft', fetchFn), path: '/@api/repos/octocat/draft/forks' },
      {
        call: (fetchFn) => createRepo({ owner: 'octocat', name: 'paper', visibility: 'public' }, fetchFn),
        path: '/@api/repos',
      },
    ];

    for (const testCase of cases) {
      const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        response({ error: 'name_taken' }, 409),
      );
      await expect(testCase.call(fetchFn as unknown as typeof fetch)).rejects.toBeInstanceOf(BffError);
      await expect(testCase.call(fetchFn as unknown as typeof fetch)).rejects.toMatchObject({
        code: 'name_taken',
        status: 409,
      });
      expect(fetchFn.mock.calls[0]?.[0]).toBe(testCase.path);
    }
  });
});

describe('POST helper error fallback', () => {
  it('falls back to http_<status> when the error body is malformed', async () => {
    const fetchFn = vi.fn(async () => brokenResponse(500));
    await expect(logout(fetchFn as unknown as typeof fetch)).rejects.toMatchObject({
      name: 'BffError',
      code: 'http_500',
      status: 500,
    });
  });
});

describe('auth URL builders', () => {
  it('encodes return_to for login and install', () => {
    const returnTo = '/octocat/draft?file=a b.md';

    expect(loginUrl(returnTo)).toBe(`/@api/auth/login?return_to=${encodeURIComponent(returnTo)}`);
    expect(installUrl(returnTo)).toBe(`/@api/auth/install?return_to=${encodeURIComponent(returnTo)}`);
  });
});
