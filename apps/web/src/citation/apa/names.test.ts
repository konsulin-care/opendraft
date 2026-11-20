import { describe, expect, it } from 'vitest';
import {
  apaAuthorList,
  apaName,
  displayName,
  parseName,
  splitNames,
} from './names';

describe('splitNames', () => {
  it('splits on "and" at brace depth 0 only', () => {
    expect(splitNames('{Bill and Melinda Gates Foundation} and Doe, Jane')).toEqual([
      '{Bill and Melinda Gates Foundation}',
      'Doe, Jane',
    ]);
  });

  it('splits case-insensitively', () => {
    expect(splitNames('Doe, Jane AND Roe, John')).toEqual(['Doe, Jane', 'Roe, John']);
  });
});

describe('parseName', () => {
  it('parses "First von Last"', () => {
    expect(parseName('Vincent van Gogh')).toEqual({
      given: 'Vincent',
      particle: 'van',
      family: 'Gogh',
    });
  });

  it('parses "von Last, First"', () => {
    expect(parseName('van Gogh, Vincent')).toEqual({
      given: 'Vincent',
      particle: 'van',
      family: 'Gogh',
    });
  });

  it('parses "von Last, Jr, First"', () => {
    expect(parseName('King, Jr, Martin Luther')).toEqual({
      given: 'Martin Luther',
      family: 'King',
      suffix: 'Jr',
    });
  });

  it('parses a brace-wrapped name as a literal', () => {
    expect(parseName('{MindKind Consortium}')).toEqual({ literal: 'MindKind Consortium' });
  });

  it('cleans LaTeX in every part', () => {
    expect(parseName('M{\\"u}ller, J{\\"o}rg')).toEqual({
      given: 'Jörg',
      family: 'Müller',
    });
  });
});

describe('apaName', () => {
  it('formats family and initials', () => {
    expect(apaName(parseName('Doe, Jane'))).toBe('Doe, J.');
  });

  it('keeps hyphens in initials', () => {
    expect(apaName(parseName('Sartre, Jean-Paul'))).toBe('Sartre, J.-P.');
  });

  it('prefixes the particle and appends the suffix', () => {
    expect(apaName(parseName('van Gogh, Vincent'))).toBe('van Gogh, V.');
    expect(apaName(parseName('King, Jr, Martin Luther'))).toBe('King, M. L., Jr.');
  });

  it('returns literal names as written', () => {
    expect(apaName(parseName('{MindKind Consortium}'))).toBe('MindKind Consortium');
  });
});

describe('apaAuthorList', () => {
  it('formats two authors', () => {
    expect(apaAuthorList('Sartre, Jean-Paul and Doe, Jane')).toBe(
      'Sartre, J.-P., & Doe, J.',
    );
  });

  it('formats three to twenty authors', () => {
    expect(apaAuthorList('Doe, Jane and Roe, John and Poe, Ann')).toBe(
      'Doe, J., Roe, J., & Poe, A.',
    );
  });

  it('formats twenty-one or more authors with an ellipsis', () => {
    const authors = Array.from({ length: 21 }, (_value, index) => `Author${index + 1}, First`);
    const expected = `${authors
      .slice(0, 19)
      .map((author) => apaName(parseName(author)))
      .join(', ')}, . . . ${apaName(parseName(authors[20]))}`;
    expect(apaAuthorList(authors.join(' and '))).toBe(expected);
  });
});

describe('displayName', () => {
  it('renders given, particle and family', () => {
    expect(displayName(parseName('van Gogh, Vincent'))).toBe('Vincent van Gogh');
  });

  it('renders a literal name', () => {
    expect(displayName(parseName('{MindKind Consortium}'))).toBe('MindKind Consortium');
  });
});
