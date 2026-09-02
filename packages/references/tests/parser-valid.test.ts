import { describe, it, expect } from 'vitest';
import { parseBibTeX } from '../src/parser.js';

describe('parseBibTeX — simple article', () => {
  it('parses a simple article entry', () => {
    const bib = `@article{doe2024,
  title = {Example Article},
  author = {Doe, Jane},
  journal = {Journal of Examples},
  year = {2024},
  volume = {1},
  pages = {1--10}
}`;
    const refs = parseBibTeX(bib);
    expect(refs).toHaveLength(1);
    expect(refs[0].citeKey).toBe('doe2024');
    expect(refs[0].entryType).toBe('article');
    expect(refs[0].fields.title).toBe('Example Article');
    expect(refs[0].fields.author).toBe('Doe, Jane');
    expect(refs[0].fields.journal).toBe('Journal of Examples');
    expect(refs[0].fields.year).toBe('2024');
    expect(refs[0].fields.volume).toBe('1');
    expect(refs[0].fields.pages).toBe('1--10');
  });
});

describe('parseBibTeX — multiple entries', () => {
  it('parses multiple entries', () => {
    const bib = `@article{doe2024,\n  title = {First},\n  author = {Doe, Jane},\n  year = {2024}\n}\n\n@book{smith2023,\n  title = {Second},\n  author = {Smith, John},\n  publisher = {Publisher},\n  year = {2023}\n}`;
    const refs = parseBibTeX(bib);
    expect(refs).toHaveLength(2);
    expect(refs[0].citeKey).toBe('doe2024');
    expect(refs[1].citeKey).toBe('smith2023');
  });
});

describe('parseBibTeX — DOI field', () => {
  it('parses DOI field', () => {
    const bib = `@article{doe2024,\n  title = {Article},\n  author = {Doe, Jane},\n  year = {2024},\n  doi = {10.1234/example}\n}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.doi).toBe('10.1234/example');
  });
});

describe('parseBibTeX — URL field', () => {
  it('parses URL field', () => {
    const bib = `@misc{web2024,\n  title = {Website},\n  howpublished = {\\\\url{https://example.com}},\n  year = {2024}\n}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.howpublished).toBe('\\\\url{https://example.com}');
  });
});

describe('parseBibTeX — quoted values', () => {
  it('handles quoted values', () => {
    const bib = `@article{test2024,\n  title = "Quoted Title",\n  author = {Doe, Jane},\n  year = {2024}\n}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.title).toBe('Quoted Title');
  });
});

describe('parseBibTeX — numeric values', () => {
  it('handles numeric values as strings', () => {
    const bib = `@article{test2024,\n  title = {Title},\n  year = 2024,\n  volume = 10\n}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].fields.year).toBe('2024');
    expect(refs[0].fields.volume).toBe('10');
  });
});
