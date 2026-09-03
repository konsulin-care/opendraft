import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src/commit.ts');

describe('packages/git browser boundary', () => {
  it('imports compileArticle from the browser-safe leaf module', () => {
    const content = readFileSync(COMMIT_SRC, 'utf-8');
    expect(content).toContain(
      "import { compileArticle } from '@opendraft/metadata/src/article-compiler.js'",
    );
  });

  it('does not import the aggregate @opendraft/metadata entry', () => {
    const content = readFileSync(COMMIT_SRC, 'utf-8');
    expect(content).not.toMatch(/from\s+['"]@opendraft\/metadata['"]/);
  });
});