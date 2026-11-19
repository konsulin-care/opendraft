import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileManuscript, migrateToBlockLayout } from '../src/node.js';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('packages/metadata node entry', () => {
  it('exposes compileManuscript and migrateToBlockLayout as functions', () => {
    expect(typeof compileManuscript).toBe('function');
    expect(typeof migrateToBlockLayout).toBe('function');
  });

  it('is exported from package.json as ./node -> ./src/node.ts', () => {
    const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf-8')) as {
      exports: Record<string, string>;
    };
    expect(pkg.exports['./node']).toBe('./src/node.ts');
    expect(pkg.exports['.' as string]).toBe('./src/index.ts');
    expect(pkg.exports['./src/*']).toBe('./src/*');
  });
});
