import { describe, it, expect } from 'vitest';
import { insertCitation } from './insert';
import type { CitationTrigger } from './types';

describe('insertCitation', () => {
  it('inserts @citekey at start of line', () => {
    const trigger: CitationTrigger = { from: 0, bracketed: false };
    const result = insertCitation('@hello world', 'doe2024', trigger);

    expect(result).toBe('@doe2024hello world');
  });

  it('inserts @citekey after whitespace', () => {
    const trigger: CitationTrigger = { from: 6, bracketed: false };
    const result = insertCitation('hello @world', 'doe2024', trigger);

    expect(result).toBe('hello @doe2024world');
  });

  it('inserts [@citekey] in bracketed mode', () => {
    const trigger: CitationTrigger = { from: 1, bracketed: true };
    const result = insertCitation('[@world]', 'doe2024', trigger);

    expect(result).toBe('[@doe2024world]');
  });

  it('inserts [@citekey] after whitespace in bracketed mode', () => {
    const trigger: CitationTrigger = { from: 6, bracketed: true };
    const result = insertCitation('text [@world]', 'doe2024', trigger);

    expect(result).toBe('text [@doe2024world]');
  });
});
