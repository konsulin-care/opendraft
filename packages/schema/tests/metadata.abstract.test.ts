import { describe, it, expect } from 'vitest';
import { validateMetadata } from '../src/metadata.js';

describe('validateMetadata — abstract', () => {
  it('accepts valid abstract', () => {
    const result = validateMetadata({ abstract: 'This paper presents...' }, 'abstract');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing abstract', () => {
    const result = validateMetadata({}, 'abstract');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('abstract'))).toBe(true);
  });

  it('rejects non-string abstract', () => {
    const result = validateMetadata({ abstract: 123 }, 'abstract');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('abstract'))).toBe(true);
  });

  it('tolerates extra fields', () => {
    const result = validateMetadata({ abstract: 'text', extra: true }, 'abstract');
    expect(result.valid).toBe(true);
  });
});
