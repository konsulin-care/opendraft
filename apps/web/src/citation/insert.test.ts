import { describe, it, expect } from 'vitest';
import { insertCitation } from './insert';
import type { CitationTrigger } from './types';

describe('insertCitation — non-bracketed', () => {
  it('replaces @query with @citekey (non-bracketed)', () => {
    const trigger: CitationTrigger = { from: 6, bracketed: false };
    const result = insertCitation('hello @world', 'doe2024', trigger, 12);

    expect(result).toBe('hello @doe2024');
  });

  it('replaces @query after whitespace in non-bracketed mode', () => {
    const trigger: CitationTrigger = { from: 0, bracketed: false };
    const result = insertCitation('@hello world', 'doe2024', trigger, 6);

    expect(result).toBe('@doe2024 world');
  });
});

describe('insertCitation — bracketed', () => {
  it('replaces only @query, keeping the [ in bracketed mode', () => {
    const trigger: CitationTrigger = { from: 1, bracketed: true };
    const result = insertCitation('[@world]', 'doe2024', trigger, 7);

    expect(result).toBe('[@doe2024]');
  });

  it('adds closing ] when the group has none after the cursor', () => {
    const trigger: CitationTrigger = { from: 1, bracketed: true };
    const result = insertCitation('[@', 'doe2024', trigger, 2);

    expect(result).toBe('[@doe2024]');
  });

  it('does not duplicate ] when one follows the cursor', () => {
    const trigger: CitationTrigger = { from: 5, bracketed: true };
    const result = insertCitation('[@a; @]', 'b', trigger, 6);

    expect(result).toBe('[@a; @b]');
  });

  it('keeps an existing ] separated by a space', () => {
    const trigger: CitationTrigger = { from: 5, bracketed: true };
    const result = insertCitation('[@a; @ ]', 'b', trigger, 6);

    expect(result).toBe('[@a; @b ]');
  });

  it('does not duplicate ] inside a larger sentence', () => {
    const trigger: CitationTrigger = { from: 9, bracketed: true };
    const result = insertCitation('See [@a; @] here', 'b', trigger, 10);

    expect(result).toBe('See [@a; @b] here');
  });

  it('adds ] when only a later group [ follows before any ]', () => {
    const trigger: CitationTrigger = { from: 5, bracketed: true };
    const result = insertCitation('[@a; @[x]', 'b', trigger, 6);

    expect(result).toBe('[@a; @b][x]');
  });

  it('never removes the [', () => {
    const trigger: CitationTrigger = { from: 1, bracketed: true };
    const result = insertCitation('[@', 'k', trigger, 2);

    expect(result.startsWith('[')).toBe(true);
  });
});
