/**
 * Conversion tests: direct PR flow, fork compare flow, the discovery-driven
 * file selection and the pull request body formatting.
 */
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import type { InitPlan } from '@opendraft/manuscript';
import { PROTOCOL } from '../project/scaffold';
import type { BffSession } from '../github/bff-client';
import {
  CONVERT_BRANCH,
  CONVERT_COMMIT_MESSAGE,
  convertRepository,
} from './convert';
import type { ClonedRepo, ConvertDeps } from './convert';
import { buildPrBody } from './convert-plan';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const CLONED: ClonedRepo = { fs: {}, dir: '/' };

/** Container article with spec-conformant front matter. */
const ARTICLE = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

::: {#refs}
:::
`;

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
    protocol: PROTOCOL,
    commitFilesOnBranch: vi.fn(async () => 'sha'),
    readWorkingFiles: vi.fn(async () => new Map<string, string>()),
    sleep: vi.fn(async () => undefined),
    ...overrides,
  };
}

/**
 * Build the working files of a valid manuscript folder.
 *
 * @param id - Manuscript folder name.
 * @returns Repo-relative file map.
 */
function validManuscript(id: string): Map<string, string> {
  return new Map([
    [`manuscripts/${id}/article.qmd`, ARTICLE],
    [`manuscripts/${id}/_author.yml`, 'authors: []\n'],
    [`manuscripts/${id}/_abstract.yml`, 'abstract: ""\n'],
    [`manuscripts/${id}/_frontmatter.yml`, 'title: "Case"\n'],
  ]);
}

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

  it('commits the initialization commit message and session author', async () => {
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
  it('registers an existing manuscript without committing files under its folder', async () => {
    const deps = makeDeps({
      readWorkingFiles: vi.fn(async () => validManuscript('case-series-review')),
    });

    await convertRepository({ owner: 'octocat', repo: 'Draft', session: SESSION }, deps);

    const opts = vi.mocked(deps.commitFilesOnBranch).mock.calls[0][2];
    const paths = [...opts.files.keys()];

    expect(paths).toContain('opendraft.yml');
    expect(paths.some((path) => path.startsWith('manuscripts/case-series-review/'))).toBe(false);

    const config = parse(opts.files.get('opendraft.yml') ?? '');
    expect(config.manuscripts).toEqual([
      { id: 'case-series-review', path: 'manuscripts/case-series-review' },
    ]);
  });

  it('commits starter files for a requested new manuscript', async () => {
    const deps = makeDeps();

    await convertRepository(
      {
        owner: 'octocat',
        repo: 'draft',
        session: SESSION,
        decisions: { newManuscriptId: 'my-paper' },
      },
      deps,
    );

    const opts = vi.mocked(deps.commitFilesOnBranch).mock.calls[0][2];
    const paths = [...opts.files.keys()];

    expect(paths).toContain('opendraft.yml');
    expect(paths).toContain('manuscripts/references.bib');
    expect(paths).toContain('manuscripts/my-paper/article.qmd');
    expect(paths).toContain('manuscripts/my-paper/_author.yml');
    expect(paths).toContain('manuscripts/my-paper/_abstract.yml');
    expect(paths).toContain('manuscripts/my-paper/_frontmatter.yml');
  });
});

describe('buildPrBody', () => {
  it('lists registered ids, file paths and warnings', () => {
    const plan: InitPlan = {
      files: [
        { path: 'opendraft.yml', content: '', op: 'create', reason: 'config' },
        {
          path: 'manuscripts/my-paper/article.qmd',
          content: '',
          op: 'create',
          reason: 'starter',
        },
      ],
      registered: ['case-series-review', 'my-paper'],
      warnings: [{ id: 'case-series-review', warning: 'bibliography-mismatch' }],
    };

    const body = buildPrBody(plan);

    expect(body).toContain('case-series-review');
    expect(body).toContain('my-paper');
    expect(body).toContain('opendraft.yml');
    expect(body).toContain('manuscripts/my-paper/article.qmd');
    expect(body).toContain('case-series-review: bibliography-mismatch');
  });
});
