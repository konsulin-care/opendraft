import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { compileManuscript } from '../src/compiler.js';

const ROOT_DIR = join(import.meta.dirname, '../test-fixtures-bibtex');
const PARENT_DIR = join(ROOT_DIR, 'manuscripts');
const TEST_DIR = join(PARENT_DIR, 'ms-1');

function setupFixtures(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, '_author.yml'), `authors:\n  - name: Test Author\n`);
  writeFileSync(join(TEST_DIR, '_abstract.yml'), `abstract: Test abstract\n`);
  writeFileSync(join(TEST_DIR, '_frontmatter.yml'), `title: Test Title\n`);
}

function cleanup(): void {
  if (existsSync(ROOT_DIR)) rmSync(ROOT_DIR, { recursive: true });
}

describe('compileManuscript — BibTeX integration', () => {
  beforeEach(setupFixtures);
  afterEach(cleanup);

  it('parses references.bib from the parent directory', () => {
    writeFileSync(join(PARENT_DIR, 'references.bib'), `@article{doe2024,
  title = {Example},
  author = {Doe, Jane},
  year = {2024}
}
`);
    const metadata = compileManuscript(TEST_DIR);
    expect(metadata.references).toHaveLength(1);
    expect(metadata.references![0].citeKey).toBe('doe2024');
  });

  it('returns no references when parent has no references.bib', () => {
    writeFileSync(join(TEST_DIR, 'references.bib'), `@article{x2024,\n  title = {X}\n}\n`);
    const metadata = compileManuscript(TEST_DIR);
    expect(metadata.references).toBeUndefined();
  });

  it('validates BibTeX against schema', () => {
    writeFileSync(join(PARENT_DIR, 'references.bib'), `invalid bibtex content\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow();
  });
});

describe('compileManuscript — validation errors', () => {
  beforeEach(setupFixtures);
  afterEach(cleanup);

  it('throws error for invalid YAML', () => {
    writeFileSync(join(TEST_DIR, '_author.yml'), `invalid: [yaml: content\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow();
  });

  it('throws error for missing required fields', () => {
    writeFileSync(join(TEST_DIR, '_author.yml'), `authors: []\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow();
  });
});
