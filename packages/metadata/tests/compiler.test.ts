import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { compileManuscript } from '../src/compiler.js';

const TEST_DIR = join(import.meta.dirname, '../test-fixtures');

function setupFixtures(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, '_author.yml'), `authors:\n  - name: Test Author\n`);
  writeFileSync(join(TEST_DIR, '_abstract.yml'), `abstract: Test abstract\n`);
  writeFileSync(join(TEST_DIR, '_frontmatter.yml'), `title: Test Title\n`);
}

describe('compileManuscript — full manuscript', () => {
  beforeEach(setupFixtures);
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('compiles complete manuscript metadata', () => {
    writeFileSync(join(TEST_DIR, '_author.yml'), `authors:
  - name: Jane Doe
    orcid: "0000-0001-2345-6789"
    affiliations:
      - name: University Example
`);
    writeFileSync(join(TEST_DIR, '_abstract.yml'), `abstract: |
  This paper presents a comprehensive study of resilience.
`);
    writeFileSync(join(TEST_DIR, '_frontmatter.yml'), `title: "Resilience in Modern Systems"
date: "2024-01-15"
keywords:
  - resilience
  - disaster recovery
`);

    const metadata = compileManuscript(TEST_DIR);
    expect(metadata.title).toBe('Resilience in Modern Systems');
    expect(metadata.abstract).toContain('This paper presents');
    expect(metadata.authors).toHaveLength(1);
    expect(metadata.authors[0].name).toBe('Jane Doe');
    expect(metadata.keywords).toEqual(['resilience', 'disaster recovery']);
  });
});

describe('compileManuscript — deterministic output', () => {
  beforeEach(setupFixtures);
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('produces same output for same input', () => {
    const metadata1 = compileManuscript(TEST_DIR);
    const metadata2 = compileManuscript(TEST_DIR);
    expect(JSON.stringify(metadata1)).toBe(JSON.stringify(metadata2));
  });
});
