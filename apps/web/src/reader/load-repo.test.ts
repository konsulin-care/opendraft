import { describe, expect, it, vi } from 'vitest';
import type { ReaderRoute } from './route';
import { NotFoundError } from './github-public';
import { cloneViaRelay, loadRepo } from './load-repo';
import type { LoadRepoDeps } from './load-repo';

const ROUTE: ReaderRoute = { owner: 'konsulin-care', repo: 'citizen-science' };

/** Build a file map with an opendraft.yml listing the given manuscripts. */
function filesWithManuscripts(entries: { id: string; path: string }[]): Map<string, string> {
  const yml = ['protocol:', '  name: opendraft', 'manuscripts:', ...entries.flatMap((e) => [
    `  - id: ${e.id}`,
    `    path: ${e.path}`,
  ]), ''].join('\n');
  return new Map([
    ['opendraft.yml', yml],
    ['manuscripts/demo/article.qmd', '---\ntitle: Demo\n---\n'],
  ]);
}

/** Build loadRepo dependencies with inert defaults and spy hooks. */
function makeDeps(overrides: Partial<LoadRepoDeps> = {}): LoadRepoDeps {
  return {
    resolveCommit: vi.fn(async () => ({ sha: 'sha1', treeSha: 'tree1' })),
    loadPublicSnapshot: vi.fn(async () => ({ sha: 'sha1', files: new Map<string, string>() })),
    cache: {
      loadSnapshot: vi.fn(async () => null),
      saveSnapshot: vi.fn(async () => undefined),
      loadLatest: vi.fn(async () => null),
      saveLatest: vi.fn(async () => undefined),
    },
    getSession: vi.fn(async () => null),
    cloneViaRelay: vi.fn(async () => ({ sha: 'sha1', files: new Map<string, string>() })),
    ...overrides,
  };
}

/** Build dependencies with a latest pointer and cached snapshot at `sha`. */
function latestDeps(
  cached: Map<string, string>,
  sha: string,
  overrides: Partial<LoadRepoDeps> = {},
): LoadRepoDeps {
  return makeDeps({
    cache: {
      loadSnapshot: vi.fn(async () => cached),
      saveSnapshot: vi.fn(async () => undefined),
      loadLatest: vi.fn(async () => sha),
      saveLatest: vi.fn(async () => undefined),
    },
    ...overrides,
  });
}

describe('loadRepo phases', () => {
  it('reports checking, downloading, saving and preparing on a public cache miss', async () => {
    const files = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = makeDeps({ loadPublicSnapshot: vi.fn(async () => ({ sha: 'sha1', files })) });
    const onPhase = vi.fn();

    await loadRepo(ROUTE, deps, onPhase);

    expect(deps.resolveCommit).toHaveBeenCalledTimes(1);
    expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'checking',
      'downloading',
      'saving',
      'preparing',
    ]);
    expect(deps.loadPublicSnapshot).toHaveBeenCalledWith(
      'konsulin-care',
      'citizen-science',
      undefined,
      { sha: 'sha1', treeSha: 'tree1' },
    );
  });

  it('reports checking then opening on a cache hit without downloading', async () => {
    const cached = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = makeDeps({
      cache: {
        loadSnapshot: vi.fn(async () => cached),
        saveSnapshot: vi.fn(async () => undefined),
      },
    });
    const onPhase = vi.fn();

    await loadRepo(ROUTE, deps, onPhase);

    expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual(['checking', 'opening']);
    expect(deps.loadPublicSnapshot).not.toHaveBeenCalled();
  });
});

describe('loadRepo relay phases', () => {
  it('reports downloading, saving and preparing for the private relay fallback', async () => {
    const files = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = makeDeps({
      resolveCommit: vi.fn(async () => {
        throw new NotFoundError();
      }),
      getSession: vi.fn(async () => ({ login: 'octocat' })),
      cloneViaRelay: vi.fn(async () => ({ sha: 'private-sha', files })),
    });
    const onPhase = vi.fn();

    const result = await loadRepo(ROUTE, deps, onPhase);

    expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'downloading',
      'saving',
      'preparing',
    ]);
    expect(deps.cache.saveSnapshot).toHaveBeenCalledWith(
      'konsulin-care',
      'citizen-science',
      'private-sha',
      files,
      { private: true },
    );
    expect(result.sha).toBe('private-sha');
  });
});

describe('loadRepo cache', () => {
  it('returns cached files for the resolved SHA without loading a public snapshot', async () => {
    const cached = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const cache = {
      loadSnapshot: vi.fn(async () => cached),
      saveSnapshot: vi.fn(async () => undefined),
    };
    const deps = makeDeps({ cache });

    const result = await loadRepo(ROUTE, deps);

    expect(cache.loadSnapshot).toHaveBeenCalledWith('konsulin-care', 'citizen-science', 'sha1');
    expect(deps.loadPublicSnapshot).not.toHaveBeenCalled();
    expect(deps.cache.saveSnapshot).not.toHaveBeenCalled();
    expect(result.sha).toBe('sha1');
    expect(await result.workspace.readFile('manuscripts/demo/article.qmd')).toContain('title: Demo');
    expect(result.isOpenDraft).toBe(true);
  });

  it('loads a public snapshot and saves it on a cache miss', async () => {
    const files = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = makeDeps({
      loadPublicSnapshot: vi.fn(async () => ({ sha: 'sha1', files })),
    });

    const result = await loadRepo(ROUTE, deps);

    expect(deps.loadPublicSnapshot).toHaveBeenCalled();
    expect(deps.cache.saveSnapshot).toHaveBeenCalledWith(
      'konsulin-care',
      'citizen-science',
      'sha1',
      files,
    );
    expect(result.isOpenDraft).toBe(true);
  });
});

describe('loadRepo fallback', () => {
  it('rethrows NotFoundError for an anonymous viewer', async () => {
    const deps = makeDeps({
      resolveCommit: vi.fn(async () => {
        throw new NotFoundError();
      }),
      getSession: vi.fn(async () => null),
    });

    await expect(loadRepo(ROUTE, deps)).rejects.toBeInstanceOf(NotFoundError);
    expect(deps.cloneViaRelay).not.toHaveBeenCalled();
  });

  it('falls back to the relay clone for a signed-in viewer', async () => {
    const files = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = makeDeps({
      loadPublicSnapshot: vi.fn(async () => {
        throw new NotFoundError();
      }),
      getSession: vi.fn(async () => ({ login: 'octocat' })),
      cloneViaRelay: vi.fn(async () => ({ sha: 'private-sha', files })),
    });

    const result = await loadRepo(ROUTE, deps);

    expect(deps.cloneViaRelay).toHaveBeenCalledWith('konsulin-care', 'citizen-science', undefined);
    expect(result.sha).toBe('private-sha');
    expect(result.isOpenDraft).toBe(true);
    expect(result.manuscripts).toEqual([{ id: 'demo', path: 'manuscripts/demo' }]);
  });
});

describe('loadRepo metadata', () => {
  it('reports no OpenDraft config and no manuscripts without opendraft.yml', async () => {
    const files = new Map([['manuscripts/demo/article.qmd', 'text']]);
    const deps = makeDeps({ loadPublicSnapshot: vi.fn(async () => ({ sha: 'sha1', files })) });

    const result = await loadRepo(ROUTE, deps);

    expect(result.isOpenDraft).toBe(false);
    expect(result.manuscripts).toEqual([]);
  });

  it('exposes a workspace that rejects writes', async () => {
    const deps = makeDeps({
      loadPublicSnapshot: vi.fn(async () => ({
        sha: 'sha1',
        files: new Map([['opendraft.yml', 'manuscripts: []\n']]),
      })),
    });

    const result = await loadRepo(ROUTE, deps);

    await expect(result.workspace.writeFile('x.md', 'x')).rejects.toThrow();
    await expect(result.workspace.deleteFile('opendraft.yml')).rejects.toThrow();
  });
});

describe('cloneViaRelay', () => {
  it('is exported as a lazy default clone', () => {
    expect(typeof cloneViaRelay).toBe('function');
  });
});

describe('loadRepo latest pointer open', () => {
  it('opens the stored latest snapshot without resolving or downloading', async () => {
    const cached = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = latestDeps(cached, 'cached-sha');
    const onPhase = vi.fn();

    const result = await loadRepo(ROUTE, deps, onPhase);

    expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual(['opening']);
    expect(deps.resolveCommit).not.toHaveBeenCalled();
    expect(deps.loadPublicSnapshot).not.toHaveBeenCalled();
    expect(result.sha).toBe('cached-sha');
  });
});

describe('loadRepo latest pointer update check', () => {
  it('reports the new SHA when the update check sees a different commit', async () => {
    const cached = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = latestDeps(cached, 'cached-sha', {
      resolveCommit: vi.fn(async () => ({ sha: 'new-sha', treeSha: 'tree2' })),
    });

    const result = await loadRepo(ROUTE, deps);

    await expect(result.checkForUpdate?.()).resolves.toBe('new-sha');
  });

  it('reports no update when the update check sees the cached commit', async () => {
    const cached = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const deps = latestDeps(cached, 'cached-sha', {
      resolveCommit: vi.fn(async () => ({ sha: 'cached-sha', treeSha: 'tree1' })),
    });

    const result = await loadRepo(ROUTE, deps);

    await expect(result.checkForUpdate?.()).resolves.toBeNull();
  });
});

describe('loadRepo latest pointer fresh', () => {
  it('ignores the pointer with fresh: true and updates it after loading', async () => {
    const files = filesWithManuscripts([{ id: 'demo', path: 'manuscripts/demo' }]);
    const cache = {
      loadSnapshot: vi.fn(async () => null),
      saveSnapshot: vi.fn(async () => undefined),
      loadLatest: vi.fn(async () => 'cached-sha'),
      saveLatest: vi.fn(async () => undefined),
    };
    const deps = makeDeps({
      resolveCommit: vi.fn(async () => ({ sha: 'new-sha', treeSha: 'tree2' })),
      loadPublicSnapshot: vi.fn(async () => ({ sha: 'new-sha', files })),
      cache,
    });

    const result = await loadRepo(ROUTE, deps, undefined, { fresh: true });

    expect(cache.loadLatest).not.toHaveBeenCalled();
    expect(result.sha).toBe('new-sha');
    expect(cache.saveLatest).toHaveBeenCalledWith(
      'konsulin-care',
      'citizen-science',
      undefined,
      'new-sha',
    );
  });
});
