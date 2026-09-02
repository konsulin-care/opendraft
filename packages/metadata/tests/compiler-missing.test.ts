import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { compileManuscript } from '../src/compiler.js';

const TEST_DIR = join(import.meta.dirname, '../test-fixtures-missing');

function cleanup(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
}

describe('compileManuscript — missing files', () => {
  it('throws error for missing _author.yml', () => {
    cleanup();
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, '_abstract.yml'), `abstract: Test\n`);
    writeFileSync(join(TEST_DIR, '_frontmatter.yml'), `title: Test\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow('_author.yml');
    cleanup();
  });

  it('throws error for missing _abstract.yml', () => {
    cleanup();
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, '_author.yml'), `authors:\n  - name: Test\n`);
    writeFileSync(join(TEST_DIR, '_frontmatter.yml'), `title: Test\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow('_abstract.yml');
    cleanup();
  });

  it('throws error for missing _frontmatter.yml', () => {
    cleanup();
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, '_author.yml'), `authors:\n  - name: Test\n`);
    writeFileSync(join(TEST_DIR, '_abstract.yml'), `abstract: Test\n`);
    expect(() => compileManuscript(TEST_DIR)).toThrow('_frontmatter.yml');
    cleanup();
  });
});
