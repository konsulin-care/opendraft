import { describe, it, expect } from 'vitest';
import { parseBibTeX } from '../src/parser.js';

describe('parseBibTeX — nested braces', () => {
  it('handles nested braces in values', () => {
    const bib = `@article{test2024,
  title = {A {Great} Title with {Nested} Braces},
  author = {Doe, Jane},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.title).toBe('A {Great} Title with {Nested} Braces');
  });

  it('handles deeply nested braces', () => {
    const bib = `@article{test2024,
  title = {Level {1 {2 {3}}}},
  author = {Doe, Jane},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.title).toBe('Level {1 {2 {3}}}');
  });
});

describe('parseBibTeX — string concatenation', () => {
  it('handles string concatenation with #', () => {
    const bib = `@article{test2024,
  title = {Title} # { Part},
  author = {Doe, Jane},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.title).toBe('Title Part');
  });
});

describe('parseBibTeX — line comments', () => {
  it('ignores line comments starting with %', () => {
    const bib = `% This is a comment
@article{test2024,
  title = {Title},
  % inline comment
  author = {Doe, Jane},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs).toHaveLength(1);
    expect(refs[0].fields.title).toBe('Title');
  });
});

describe('parseBibTeX — multiline values', () => {
  it('handles values spanning multiple lines', () => {
    const bib = `@article{test2024,
  title = {A Very Long
    Title That Spans
    Multiple Lines},
  author = {Doe, Jane},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.title).toContain('A Very Long');
    expect(refs[0].fields.title).toContain('Multiple Lines');
  });
});

describe('parseBibTeX — whitespace handling', () => {
  it('trims whitespace from field values', () => {
    const bib = `@article{test2024,
  title = {  Trimmed Title  },
  author = {Doe, Jane},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.title).toBe('Trimmed Title');
  });

  it('handles various whitespace around = sign', () => {
    const bib = `@article{test2024,
  title ={NoSpace},
  author ={Doe},
  year ={2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.title).toBe('NoSpace');
  });
});
