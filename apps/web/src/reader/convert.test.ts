/**
 * Conversion tests: direct PR flow, fork compare flow and the guarantee that
 * only newly scaffolded paths are committed.
 */
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { scaffoldProject } from '../project/scaffold';
import type { BffSession } from '../github/bff-client';
import {
  CONVERT_BRANCH,
  CONVERT_COMMIT_MESSAGE,
  convertRepository,
  slug,
} from './convert';
import type { ClonedRepo, ConvertDeps } from './convert';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const CLONED: ClonedRepo = { fs: {}, dir: '/' };

/** Build conversion dependencies with inert defaults and spy hooks. */
function makeDeps(overrides: Partial<ConvertDeps> = {}): ConvertDeps {
  return {
    getRepoPermissions: vi.fn(async () => ({
      push: true,
      installed: true,
      defaultBranch: 'main',
    })),
    forkRepo: vi.fn(async () => ({ owner: 'octocat', repo: 'draft', defaultBranch: 'main' })),
    createPullRequest: vi.fn(async () => ({
      number: 7,
      url: 'https://github.com/octocat/draft/pull/7',
    })),
    cloneRepo: vi.fn(async () => CLONED),
    relayUrl: vi.fn((owner: string, repo: string) => `${owner}/${repo}.git`),
    push: vi.fn(async () => undefined),
    scaffold: vi.fn(async () => undefined),
    commitFilesOnBranch: vi.fn(async () => 'sha'),
    readWorkingFiles: vi.fn(async () => new Map<string, string>()),
    sleep: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('slug', () => {
  it('lowercases, replaces separators and trims dashes', () => {
    expect(slug('My Draft!')).toBe('my-draft');
    expect(slug('--Hello--World--')).toBe('hello--world');
    expect(slug('!!!')).toBe('manuscript');
  });
});

describe('convertRepository direct flow', () => {
  it('pushes opendraft/init upstream and returns the pull request url', async () => {
    const deps = makeDeps();

    const result = await convertRepository(
      { owner: 'octocat', repo: 'draft', session: SESSION },
      deps,
    );

    expect(deps.getRepoPermissions).toHaveBeenCalledWith('octocat', 'draft');
    expect(deps.forkRepo).not.toHaveBeenCalled();
    expect(deps.relayUrl).toHaveBeenCalledWith('octocat', 'draft');
    expect(deps.push).toHaveBeenCalledWith(CLONED.fs, CLONED.dir, 'octocat/draft.git', CONVERT_BRANCH);
    expect(deps.createPullRequest).toHaveBeenCalledWith('octocat', 'draft', {
      title: 'Initialize OpenDraft project',
      head: CONVERT_BRANCH,
      base: 'main',
      body: expect.any(String),
    });
    expect(result).toEqual({
      kind: 'pr',
      url: 'https://github.com/octocat/draft/pull/7',
    });
  });

  it('commits the scaffold commit message and session author', async () => {
    const deps = makeDeps();

    await convertRepository({ owner: 'octocat', repo: 'draft', session: SESSION }, deps);

    expect(deps.commitFilesOnBranch).toHaveBeenCalledWith(
      CLONED.fs,
      CLONED.dir,
      expect.objectContaining({
        branch: CONVERT_BRANCH,
        message: CONVERT_COMMIT_MESSAGE,
        author: {
          name: 'Mona Lisa',
          email: '42+octocat@users.noreply.github.com',
        },
      }),
    );
  });
});

describe('convertRepository fork flow', () => {
  it('forks, retries the clone, pushes to the fork and returns the compare url', async () => {
    const cloneRepo = vi
      .fn<ConvertDeps['cloneRepo']>()
      .mockRejectedValueOnce(new Error('fork not ready'))
      .mockRejectedValueOnce(new Error('fork not ready'))
      .mockResolvedValue(CLONED);
    const deps = makeDeps({
      getRepoPermissions: vi.fn(async () => ({
        push: false,
        installed: false,
        defaultBranch: 'main',
      })),
      cloneRepo,
    });

    const result = await convertRepository(
      { owner: 'konsulin-care', repo: 'citizen-science', session: SESSION },
      deps,
    );

    expect(deps.forkRepo).toHaveBeenCalledWith('konsulin-care', 'citizen-science');
    expect(cloneRepo).toHaveBeenCalledTimes(3);
    expect(deps.sleep).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledWith(2000);
    expect(deps.relayUrl).toHaveBeenCalledWith('octocat', 'draft');
    expect(deps.push).toHaveBeenCalledWith(CLONED.fs, CLONED.dir, 'octocat/draft.git', CONVERT_BRANCH);
    expect(deps.createPullRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'compare',
      url: 'https://github.com/konsulin-care/citizen-science/compare/main...octocat:opendraft/init?expand=1',
    });
  });
});

describe('convertRepository file selection', () => {
  it('commits only newly scaffolded paths from the real scaffold', async () => {
    const working = new Map([
      ['README.md', '# Draft\n'],
      ['manuscripts/existing/article.qmd', 'existing\n'],
    ]);
    const deps = makeDeps({
      readWorkingFiles: vi.fn(async () => working),
      scaffold: (ws, manuscriptId) => scaffoldProject(ws, { manuscriptId }),
    });

    await convertRepository({ owner: 'octocat', repo: 'Draft', session: SESSION }, deps);

    const opts = vi.mocked(deps.commitFilesOnBranch).mock.calls[0][2];
    const paths = [...opts.files.keys()].sort();

    expect(paths).toContain('opendraft.yml');
    expect(paths).toContain('manuscripts/draft/article.qmd');
    expect(paths).not.toContain('README.md');
    expect(paths).not.toContain('manuscripts/existing/article.qmd');
    expect(opts.files.get('README.md')).toBeUndefined();
  });

  it('never commits a path that already existed even when scaffold rewrites it', async () => {
    const working = new Map([
      ['README.md', '# Draft\n'],
      ['opendraft.yml', 'old: true\n'],
    ]);
    const deps = makeDeps({
      readWorkingFiles: vi.fn(async () => working),
      scaffold: vi.fn(async (ws: WorkspaceAdapter) => {
        await ws.writeFile('README.md', 'overwritten\n');
        await ws.writeFile('opendraft.yml', 'new: true\n');
        await ws.writeFile('manuscripts/draft/article.qmd', 'fresh\n');
      }),
    });

    await convertRepository({ owner: 'octocat', repo: 'draft', session: SESSION }, deps);

    const opts = vi.mocked(deps.commitFilesOnBranch).mock.calls[0][2];
    expect([...opts.files.keys()]).toEqual(['manuscripts/draft/article.qmd']);
    expect(opts.files.get('manuscripts/draft/article.qmd')).toBe('fresh\n');
  });
});
