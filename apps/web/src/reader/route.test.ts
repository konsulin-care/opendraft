import { describe, expect, it } from 'vitest';
import { parseReaderRoute, readerManuscript } from './route';

describe('parseReaderRoute', () => {
  it('parses a bare owner/repo path with no ref', () => {
    expect(parseReaderRoute('/konsulin-care/citizen-science')).toEqual({
      owner: 'konsulin-care',
      repo: 'citizen-science',
    });
  });

  it('parses a ref that contains slashes', () => {
    expect(parseReaderRoute('/o/r/tree/feature/x')).toEqual({
      owner: 'o',
      repo: 'r',
      ref: 'feature/x',
    });
  });

  it('returns null for reserved, file-like, incomplete and other shapes', () => {
    expect(parseReaderRoute('/')).toBeNull();
    expect(parseReaderRoute('/o')).toBeNull();
    expect(parseReaderRoute('/@api/health')).toBeNull();
    expect(parseReaderRoute('/favicon.ico')).toBeNull();
    expect(parseReaderRoute('/o/r/blob/main/x')).toBeNull();
  });

  it('accepts a trailing slash after the repo', () => {
    expect(parseReaderRoute('/o/r/')).toEqual({ owner: 'o', repo: 'r' });
  });

  it('strips a trailing .git from the repo', () => {
    expect(parseReaderRoute('/o/r.git')).toEqual({ owner: 'o', repo: 'r' });
  });

  it('decodes each path segment', () => {
    expect(parseReaderRoute('/o/r/tree/feature%2Fx')).toEqual({
      owner: 'o',
      repo: 'r',
      ref: 'feature/x',
    });
  });
});

describe('parseReaderRoute manuscript query', () => {
  it('parses a manuscript query alongside owner, repo and the tree ref', () => {
    expect(parseReaderRoute('/o/r/tree/feature/x', '?manuscript=alpha')).toEqual({
      owner: 'o',
      repo: 'r',
      ref: 'feature/x',
      manuscript: 'alpha',
    });
    expect(parseReaderRoute('/o/r', '?intent=edit&manuscript=beta%20one')).toEqual({
      owner: 'o',
      repo: 'r',
      manuscript: 'beta one',
    });
  });

  it('omits the manuscript when the query string has none', () => {
    expect(parseReaderRoute('/o/r/tree/main', '?intent=edit')).toEqual({
      owner: 'o',
      repo: 'r',
      ref: 'main',
    });
  });
});

describe('readerManuscript', () => {
  it('reads the manuscript id from a search string', () => {
    expect(readerManuscript('?manuscript=alpha&intent=edit')).toBe('alpha');
    expect(readerManuscript('manuscript=beta')).toBe('beta');
    expect(readerManuscript('?manuscript=')).toBeUndefined();
    expect(readerManuscript('?intent=edit')).toBeUndefined();
    expect(readerManuscript('')).toBeUndefined();
  });
});
