import { describe, it, expect } from 'vitest';
import type { ProjectSourceGitHub, ProjectSourceLocal } from '@opendraft/workspace';
import type { SuggestionState } from '../suggest/status';
import { headerStatus } from './draft-header-status';

const github: ProjectSourceGitHub = {
  kind: 'github',
  owner: 'octocat',
  repo: 'opendraft',
  branch: 'suggest/fix-typo',
  upstream: { owner: 'octocat', repo: 'opendraft', defaultBranch: 'main' },
  private: false,
  pushed: true,
  syncedSha: 'abc123',
  digest: {},
  pullNumber: 7,
};

const local: ProjectSourceLocal = { kind: 'local' };

describe('headerStatus', () => {
  it('carries the draft label, branch and pull request url for GitHub projects', () => {
    const status = headerStatus({
      source: github,
      draftLabel: 'Revision needed · 2 saves waiting to upload',
      status: { state: 'revision-needed', url: 'https://github.com/octocat/opendraft/pull/7' },
      error: null,
      notice: null,
    });

    expect(status.draftLabel).toBe('Revision needed · 2 saves waiting to upload');
    expect(status.branch).toBe('suggest/fix-typo');
    expect(status.pullRequestUrl).toBe('https://github.com/octocat/opendraft/pull/7');
  });

  it('prefers the error over the notice', () => {
    const status = headerStatus({
      source: github,
      draftLabel: 'Draft',
      status: { state: 'draft' },
      error: 'Could not reach GitHub',
      notice: 'Saved locally',
    });

    expect(status.notice).toBe('Could not reach GitHub');
  });

  it('falls back to the notice when there is no error', () => {
    const status = headerStatus({
      source: github,
      draftLabel: 'Draft',
      status: null,
      error: null,
      notice: 'Saved locally',
    });

    expect(status.notice).toBe('Saved locally');
  });
});

describe('headerStatus local and attention', () => {
  it('has no branch or pull request url for local projects', () => {
    const status = headerStatus({
      source: local,
      draftLabel: 'Draft · 1 save waiting to upload',
      status: null,
      error: null,
      notice: null,
    });

    expect(status.draftLabel).toBe('Draft · 1 save waiting to upload');
    expect(status.branch).toBeUndefined();
    expect(status.pullRequestUrl).toBeUndefined();
  });

  it.each([
    ['revision-needed', true],
    ['remote-moved', true],
    ['local-only', false],
    ['draft', false],
    ['open', false],
    ['merged', false],
    ['closed', false],
    ['branch-deleted', false],
  ] as const)('reports attention %s as %s', (state: SuggestionState, expected) => {
    const status = headerStatus({
      source: github,
      draftLabel: 'Draft',
      status: { state },
      error: null,
      notice: null,
    });

    expect(status.attention).toBe(expected);
  });
});
