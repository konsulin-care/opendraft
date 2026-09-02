import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { compileManuscript } from '../src/compiler.js';

const TEST_DIR = join(import.meta.dirname, '../test-fixtures-bibtex');

function setupFixtures(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, '_author.yml'), `authors:\n  - name: Test Author\n`);
  writeFileSync(join(TEST_DIR, '_abstract.yml'), `abstract: Test abstract\n`);
  writeFileSync(join(TEST_DIR, '_frontmatter.yml'), `title: Test Title\n`);
}

describe('compileManuscript — BibTeX integration', () => {
  beforeEach(setupFixtures);
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('parses references.bib when present', () => {
    writeFileSync(join(TEST_DIR, 'references.bib'), `@article{doe2024,
  title = {Example},
  author = {Doe, Jane},
  year = {2024}
}
`);
    const metadata = compileManuscript(TEST_DIR);
    expect(metadata.references).toHaveLength(1);
    expect(metadata.references![0].citeKey).toBe('doe2024');
  });

  it('validates BibTeX against schema', () => {
    writeFileSync(join(TEST_DIR, 'references.bib'), `invalid bibtex content\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow();
  });
});

describe('compileManuscript — validation errors', () => {
  beforeEach(setupFixtures);
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('throws error for invalid YAML', () => {
    writeFileSync(join(TEST_DIR, '_author.yml'), `invalid: [yaml: content\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow();
  });

  it('throws error for missing required fields', () => {
    writeFileSync(join(TEST_DIR, '_author.yml'), `authors: []\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow();
  });
});
