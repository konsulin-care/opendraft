/**
 * Manuscript registration tests: the direct pull request flow, the compare
 * URL fallback and the config-only commit.
 */
import { describe, expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';
import { PROTOCOL } from '../project/scaffold';
import type { BffSession } from '../github/bff-client';
import type { ClonedRepo, ConvertCommitOptions, ConvertDeps } from './convert';
import {
  REGISTER_BRANCH,
  REGISTER_COMMIT_MESSAGE,
  registerManuscripts,
} from './register';

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

/** Build registration dependencies with inert defaults and spy hooks. */
function makeDeps(overrides: Partial<ConvertDeps> = {}): ConvertDeps {
  return {
    getRepoPermissions: vi.fn(async () => ({
      push: true,
      installed: true,
      defaultBranch: 'main',
    })),
    forkRepo: vi.fn(async () => ({ owner: 'octocat', repo: 'draft', defaultBranch: 'main' })),
    createPullRequest: vi.fn(async () => ({
      number: 9,
      url: 'https://github.com/octocat/draft/pull/9',
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
 * Build working files of a valid project with one unlisted manuscript.
 *
 * @returns Repo-relative file map.
 */
function projectFiles(): Map<string, string> {
  return new Map([
    [
      'opendraft.yml',
      stringify({
        protocol: PROTOCOL,
        manuscripts: [{ id: 'intro', path: 'manuscripts/intro' }],
      }),
    ],
    [
      'manuscripts/case-series-review/article.qmd',
      ARTICLE,
    ],
    ['manuscripts/case-series-review/_author.yml', 'authors: []\n'],
    ['manuscripts/case-series-review/_abstract.yml', 'abstract: ""\n'],
    ['manuscripts/case-series-review/_frontmatter.yml', 'title: "Case"\n'],
    ['manuscripts/references.bib', '@misc{keep,}\n'],
  ]);
}

/**
 * Assert the registration commit metadata and its config-only file set.
 *
 * @param opts - Commit options captured from `commitFilesOnBranch`.
 */
function expectConfigCommit(opts: ConvertCommitOptions): void {
  expect([...opts.files.keys()]).toEqual(['opendraft.yml']);
  expect(opts.branch).toBe(REGISTER_BRANCH);
  expect(opts.message).toBe(REGISTER_COMMIT_MESSAGE);
  expect(opts.author).toEqual({
    name: 'Mona Lisa',
    email: '42+octocat@users.noreply.github.com',
  });

  const config = parse(opts.files.get('opendraft.yml') ?? '');
  expect(config.protocol).toEqual(PROTOCOL);
  expect(config.manuscripts).toEqual([
    { id: 'intro', path: 'manuscripts/intro' },
    { id: 'case-series-review', path: 'manuscripts/case-series-review' },
  ]);
}

describe('registerManuscripts direct flow', () => {
  it('commits only opendraft.yml with the appended id and the preserved protocol', async () => {
    const deps = makeDeps({ readWorkingFiles: vi.fn(async () => projectFiles()) });

    await registerManuscripts(
      {
        owner: 'octocat',
        repo: 'draft',
        session: SESSION,
        ids: ['case-series-review'],
      },
      deps,
    );

    const opts = vi.mocked(deps.commitFilesOnBranch).mock.calls[0][2];
    expectConfigCommit(opts);
    expect(deps.push).toHaveBeenCalledWith(
      CLONED.fs,
      CLONED.dir,
      'octocat/draft.git',
      REGISTER_BRANCH,
    );
  });

  it('opens a pull request titled Register OpenDraft manuscripts', async () => {
    const deps = makeDeps({ readWorkingFiles: vi.fn(async () => projectFiles()) });

    const result = await registerManuscripts(
      { owner: 'octocat', repo: 'draft', session: SESSION, ids: ['case-series-review'] },
      deps,
    );

    expect(deps.createPullRequest).toHaveBeenCalledWith(
      'octocat',
      'draft',
      expect.objectContaining({
        title: 'Register OpenDraft manuscripts',
        head: REGISTER_BRANCH,
        base: 'main',
      }),
    );
    expect(result).toEqual({
      kind: 'pr',
      url: 'https://github.com/octocat/draft/pull/9',
    });
  });
});

describe('registerManuscripts fork flow', () => {
  it('returns a compare url against the fork when the app is not installed', async () => {
    const deps = makeDeps({
      getRepoPermissions: vi.fn(async () => ({
        push: false,
        installed: false,
        defaultBranch: 'main',
      })),
      readWorkingFiles: vi.fn(async () => projectFiles()),
    });

    const result = await registerManuscripts(
      {
        owner: 'konsulin-care',
        repo: 'citizen-science',
        session: SESSION,
        ids: ['case-series-review'],
      },
      deps,
    );

    expect(deps.forkRepo).toHaveBeenCalledWith('konsulin-care', 'citizen-science');
    expect(deps.createPullRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'compare',
      url: 'https://github.com/konsulin-care/citizen-science/compare/main...octocat:opendraft/register-manuscripts?expand=1',
    });
  });
});
