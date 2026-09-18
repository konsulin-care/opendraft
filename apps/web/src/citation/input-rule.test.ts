import { describe, it, expect } from 'vitest';
import { matchCitationTrigger } from './input-rule';

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
