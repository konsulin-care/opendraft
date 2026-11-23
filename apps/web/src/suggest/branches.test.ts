/**
 * Suggestion branch naming tests.
 */
import { describe, expect, it } from 'vitest';
import {
  draftBranch,
  draftNameStatus,
  draftPrefix,
  draftSlug,
  findOwnDraft,
  latestBranch,
  suggestionBranch,
  suggestionPrefix,
} from './branches';

describe('suggestionPrefix', () => {
  it('uses the viewer login under opendraft', () => {
    expect(suggestionPrefix('octocat')).toBe('opendraft/octocat/');
  });
});

describe('suggestionBranch', () => {
  it('formats the UTC timestamp with zero padding', () => {
    const date = new Date(Date.UTC(2025, 0, 2, 3, 4, 5));
    expect(suggestionBranch('octocat', date)).toBe(
      'opendraft/octocat/20250102-030405',
    );
  });

  it('does not follow the local timezone', () => {
    const date = new Date(Date.UTC(2025, 11, 31, 23, 59, 59));
    expect(suggestionBranch('octocat', date)).toBe(
      'opendraft/octocat/20251231-235959',
    );
  });
});

describe('latestBranch', () => {
  it('returns the greatest branch under the login prefix', () => {
    const names = [
      'opendraft/octocat/20250101-120000',
      'opendraft/octocat/20250103-120000',
      'opendraft/octocat/20250102-120000',
      'opendraft/other/20250104-120000',
      'main',
    ];

    expect(latestBranch(names, 'octocat')).toBe(
      'opendraft/octocat/20250103-120000',
    );
  });

  it('returns null when the viewer has no suggestion branch', () => {
    const names = ['opendraft/other/20250101-120000', 'main'];
    expect(latestBranch(names, 'octocat')).toBeNull();
  });
});

describe('draftPrefix', () => {
  it('lowercases the login under the od- prefix', () => {
    expect(draftPrefix('OctoCat')).toBe('od-octocat/');
  });
});

describe('draftSlug', () => {
  it('lowercases and replaces unsafe characters with hyphens', () => {
    expect(draftSlug('Fix methods typos')).toBe('fix-methods-typos');
  });

  it('drops slashes and trims stray hyphens', () => {
    expect(draftSlug('  Foo/Bar!!  ')).toBe('foo-bar');
  });
});

describe('draftBranch', () => {
  it('combines the lowercased login and slug', () => {
    expect(draftBranch('OctoCat', 'Fix methods typos')).toBe(
      'od-octocat/fix-methods-typos',
    );
  });
});

describe('draftNameStatus', () => {
  it('reports free when no branch uses the slug', () => {
    const refs = ['main', 'od-other/fix-methods-typos'];
    expect(draftNameStatus(refs, 'OctoCat', 'fix-methods-typos')).toEqual({
      kind: 'free',
    });
  });

  it('reports the next free numbered alternative when taken', () => {
    const refs = [
      'od-octocat/fix-methods-typos',
      'od-octocat/fix-methods-typos-2',
      'od-octocat/fix-methods-typos-3',
    ];
    expect(draftNameStatus(refs, 'OctoCat', 'fix-methods-typos')).toEqual({
      kind: 'taken',
      alternative: 'fix-methods-typos-4',
    });
  });

  it('reports taken with slug-2 when only the base slug is used', () => {
    const refs = ['od-octocat/fix-methods-typos'];
    expect(draftNameStatus(refs, 'octocat', 'fix-methods-typos')).toEqual({
      kind: 'taken',
      alternative: 'fix-methods-typos-2',
    });
  });

  it('blocks when a branch is named exactly od-<login>', () => {
    const refs = ['main', 'od-octocat'];
    expect(draftNameStatus(refs, 'OctoCat', 'fix-methods-typos')).toEqual({
      kind: 'blocked',
    });
  });
});

describe('findOwnDraft', () => {
  it('finds the viewer draft under od-<login>/', () => {
    const refs = ['main', 'od-octocat/my-draft', 'od-other/their-draft'];
    expect(findOwnDraft(refs, 'OctoCat')).toBe('od-octocat/my-draft');
  });

  it('finds a legacy opendraft/<login>/ branch', () => {
    const refs = ['main', 'opendraft/octocat/20250102-030405'];
    expect(findOwnDraft(refs, 'octocat')).toBe(
      'opendraft/octocat/20250102-030405',
    );
  });

  it('never matches another login od-* branch', () => {
    const refs = ['main', 'od-octocat2/my-draft', 'od-other/their-draft'];
    expect(findOwnDraft(refs, 'octocat')).toBeNull();
  });
});
