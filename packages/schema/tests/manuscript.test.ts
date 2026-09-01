import { describe, it, expect } from 'vitest';
import { validateManuscript } from '../src/manuscript.js';

const REQUIRED_FILES = [
  'article.qmd',
  '_author.yml',
  '_abstract.yml',
  '_frontmatter.yml',
  'references.bib',
];

describe('validateManuscript — valid input', () => {
  it('accepts a valid manuscript with all required files', () => {
    const result = validateManuscript('my-article', REQUIRED_FILES);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts extra files beyond required', () => {
    const files = [...REQUIRED_FILES, 'data.csv', 'figure.png'];
    const result = validateManuscript('my-article', files);
    expect(result.valid).toBe(true);
  });
});

describe('validateManuscript — identifier validation', () => {
  it('accepts simple lowercase identifier', () => {
    const result = validateManuscript('article', REQUIRED_FILES);
    expect(result.valid).toBe(true);
  });

  it('accepts identifier with hyphens', () => {
    const result = validateManuscript('my-article-2024', REQUIRED_FILES);
    expect(result.valid).toBe(true);
  });

  it('accepts identifier with numbers', () => {
    const result = validateManuscript('article1', REQUIRED_FILES);
    expect(result.valid).toBe(true);
  });

  it('rejects uppercase letters', () => {
    const result = validateManuscript('My-Article', REQUIRED_FILES);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'id')).toBe(true);
  });

  it('rejects underscores', () => {
    const result = validateManuscript('my_article', REQUIRED_FILES);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'id')).toBe(true);
  });

  it('rejects leading hyphen', () => {
    const result = validateManuscript('-my-article', REQUIRED_FILES);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'id')).toBe(true);
  });

  it('rejects trailing hyphen', () => {
    const result = validateManuscript('my-article-', REQUIRED_FILES);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'id')).toBe(true);
  });

  it('rejects empty identifier', () => {
    const result = validateManuscript('', REQUIRED_FILES);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'id')).toBe(true);
  });
});

describe('validateManuscript — required files', () => {
  it('rejects missing article.qmd', () => {
    const files = REQUIRED_FILES.filter((f) => f !== 'article.qmd');
    const result = validateManuscript('my-article', files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('article.qmd'))).toBe(true);
  });

  it('rejects missing _author.yml', () => {
    const files = REQUIRED_FILES.filter((f) => f !== '_author.yml');
    const result = validateManuscript('my-article', files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('_author.yml'))).toBe(true);
  });

  it('rejects missing _abstract.yml', () => {
    const files = REQUIRED_FILES.filter((f) => f !== '_abstract.yml');
    const result = validateManuscript('my-article', files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('_abstract.yml'))).toBe(true);
  });

  it('rejects missing _frontmatter.yml', () => {
    const files = REQUIRED_FILES.filter((f) => f !== '_frontmatter.yml');
    const result = validateManuscript('my-article', files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('_frontmatter.yml'))).toBe(true);
  });

  it('rejects missing references.bib', () => {
    const files = REQUIRED_FILES.filter((f) => f !== 'references.bib');
    const result = validateManuscript('my-article', files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('references.bib'))).toBe(true);
  });

  it('reports all missing files at once', () => {
    const result = validateManuscript('my-article', []);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(5); // 5 missing file errors
  });

  it('reports id and file errors together', () => {
    const result = validateManuscript('Bad_ID!', []);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(6); // 1 id error + 5 file errors
  });
});
