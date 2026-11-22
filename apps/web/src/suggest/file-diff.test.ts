/**
 * Suggestion file scoping and local change detection tests.
 */
import { describe, expect, it } from 'vitest';
import {
  fileDigest,
  isDirty,
  isSuggestionPath,
  localChanges,
} from './file-diff';

describe('isSuggestionPath', () => {
  it('accepts the project config and manuscript sources', () => {
    expect(isSuggestionPath('opendraft.yml')).toBe(true);
    expect(isSuggestionPath('manuscripts/article/index.md')).toBe(true);
  });

  it('rejects files outside the suggestion scope', () => {
    expect(isSuggestionPath('README.md')).toBe(false);
    expect(isSuggestionPath('manuscripts.md')).toBe(false);
    expect(isSuggestionPath('src/article.md')).toBe(false);
  });
});

describe('fileDigest', () => {
  it('hashes only scoped files deterministically', () => {
    const files = new Map([
      ['opendraft.yml', 'project: demo'],
      ['manuscripts/article/index.md', '# Article'],
      ['README.md', 'ignored'],
    ]);

    const digest = fileDigest(files);

    expect(Object.keys(digest).sort()).toEqual([
      'manuscripts/article/index.md',
      'opendraft.yml',
    ]);
    expect(fileDigest(files)).toEqual(digest);
    expect(digest['opendraft.yml']).not.toBe(digest['manuscripts/article/index.md']);
  });

  it('produces a different digest when content changes', () => {
    const before = fileDigest(new Map([['opendraft.yml', 'a']]));
    const after = fileDigest(new Map([['opendraft.yml', 'b']]));

    expect(before['opendraft.yml']).not.toBe(after['opendraft.yml']);
  });
});

describe('localChanges', () => {
  it('reports new and modified scoped files with their content', () => {
    const digest = fileDigest(
      new Map([
        ['opendraft.yml', 'old'],
        ['manuscripts/article/index.md', '# Article'],
      ]),
    );
    const local = new Map([
      ['opendraft.yml', 'new'],
      ['manuscripts/article/index.md', '# Article'],
      ['manuscripts/article/new.md', '# New'],
      ['README.md', 'outside scope'],
    ]);

    const { changed, removed } = localChanges(local, digest);

    expect([...changed.keys()].sort()).toEqual([
      'manuscripts/article/new.md',
      'opendraft.yml',
    ]);
    expect(changed.get('opendraft.yml')).toBe('new');
    expect(removed).toEqual([]);
  });

  it('reports digest paths missing locally as removed', () => {
    const digest = fileDigest(
      new Map([
        ['opendraft.yml', 'project: demo'],
        ['manuscripts/article/index.md', '# Article'],
      ]),
    );
    const local = new Map([['opendraft.yml', 'project: demo']]);

    const { changed, removed } = localChanges(local, digest);

    expect(changed.size).toBe(0);
    expect(removed).toEqual(['manuscripts/article/index.md']);
  });

  it('ignores out-of-scope paths in the digest', () => {
    const digest = { 'README.md': 'abcd1234' };
    const local = new Map([['README.md', 'changed']]);

    expect(localChanges(local, digest).removed).toEqual([]);
  });
});

describe('isDirty', () => {
  const digest = fileDigest(new Map([['opendraft.yml', 'project: demo']]));

  it('is false when local files match the digest', () => {
    expect(isDirty(new Map([['opendraft.yml', 'project: demo']]), digest)).toBe(
      false,
    );
  });

  it('is true when a file changed', () => {
    expect(isDirty(new Map([['opendraft.yml', 'project: other']]), digest)).toBe(
      true,
    );
  });

  it('is true when a file was removed', () => {
    expect(isDirty(new Map(), digest)).toBe(true);
  });

  it('is false when only out-of-scope files changed', () => {
    const local = new Map([
      ['opendraft.yml', 'project: demo'],
      ['README.md', 'changed'],
    ]);
    expect(isDirty(local, digest)).toBe(false);
  });
});
