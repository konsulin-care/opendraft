import { describe, it, expect } from 'vitest';
import { matchCitationTrigger } from './input-rule';
import { insertCitation } from './insert';

/** Count occurrences of a character in a string. */
function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

describe('matchCitationTrigger - positive cases', () => {
  it('matches @ at start of line', () => {
    const result = matchCitationTrigger('@');
    expect(result).toEqual({ from: 0, bracketed: false });
  });

  it('matches @ after whitespace', () => {
    const result = matchCitationTrigger('text @');
    expect(result).toEqual({ from: 5, bracketed: false });
  });

  it('matches @ after tab', () => {
    const result = matchCitationTrigger('text\t@');
    expect(result).toEqual({ from: 5, bracketed: false });
  });

  it('matches [@ for bracketed mode', () => {
    const result = matchCitationTrigger('[@');
    expect(result).toEqual({ from: 1, bracketed: true });
  });

  it('matches [@ after whitespace', () => {
    const result = matchCitationTrigger('text [@');
    expect(result).toEqual({ from: 6, bracketed: true });
  });

  it('matches @ after closing bracket', () => {
    const result = matchCitationTrigger(']@');
    expect(result).toEqual({ from: 1, bracketed: false });
  });

  it('matches @ after punctuation', () => {
    const result = matchCitationTrigger('.@');
    expect(result).toEqual({ from: 1, bracketed: false });
  });
});

describe('matchCitationTrigger - multiple citations in one bracket group', () => {
  it('treats the second @ in "[@a; @" as bracketed', () => {
    const result = matchCitationTrigger('[@a; @');
    expect(result).toEqual({ from: 5, bracketed: true });
  });

  it('treats @ in "[@a;  @" (extra space) as bracketed', () => {
    const result = matchCitationTrigger('[@a;  @');
    expect(result).toEqual({ from: 6, bracketed: true });
  });

  it('does NOT treat @ as bracketed after the group is closed', () => {
    const result = matchCitationTrigger('[@a] @');
    expect(result).toEqual({ from: 5, bracketed: false });
  });

  it('picking b in "[@a; @b]" (] after cursor) yields exactly one ]', () => {
    const trigger = matchCitationTrigger('[@a; @');
    expect(trigger).not.toBeNull();
    const result = insertCitation('[@a; @]', 'b', trigger!, 6);

    expect(result).toBe('[@a; @b]');
    expect(countChar(result, ']')).toBe(1);
    expect(countChar(result, '[')).toBe(1);
  });

  it('picking b in unclosed "[@a; @" adds exactly one ]', () => {
    const trigger = matchCitationTrigger('[@a; @');
    expect(trigger).not.toBeNull();
    const result = insertCitation('[@a; @', 'b', trigger!, 6);

    expect(result).toBe('[@a; @b]');
    expect(countChar(result, ']')).toBe(1);
  });

  it('picking b in "[@a; @ ]" keeps the existing ] without duplicating', () => {
    const trigger = matchCitationTrigger('[@a; @');
    expect(trigger).not.toBeNull();
    const result = insertCitation('[@a; @ ]', 'b', trigger!, 6);

    expect(result).toBe('[@a; @b ]');
    expect(countChar(result, ']')).toBe(1);
    expect(countChar(result, '[')).toBe(1);
  });
});

describe('matchCitationTrigger - negative cases', () => {
  it('does NOT match @ inside word', () => {
    const result = matchCitationTrigger('email@');
    expect(result).toBeNull();
  });

  it('does NOT match @ after letter', () => {
    const result = matchCitationTrigger('test@');
    expect(result).toBeNull();
  });

  it('does NOT match @ after digit', () => {
    const result = matchCitationTrigger('123@');
    expect(result).toBeNull();
  });

  it('does NOT match @ after underscore', () => {
    const result = matchCitationTrigger('test_@');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = matchCitationTrigger('');
    expect(result).toBeNull();
  });

  it('returns null for string without @', () => {
    const result = matchCitationTrigger('hello world');
    expect(result).toBeNull();
  });
});
