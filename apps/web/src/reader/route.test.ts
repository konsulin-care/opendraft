import { describe, expect, it } from 'vitest';
import { parseReaderRoute } from './route';

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
