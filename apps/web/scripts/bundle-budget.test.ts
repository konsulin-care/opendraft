// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { ManifestChunk } from 'vite';
import { checkBudget, routeClosure } from './bundle-budget';

const manifest: Record<string, ManifestChunk> = {
  'index.html': {
    file: '@assets/index-entry.js',
    isEntry: true,
    imports: ['src/main.tsx'],
  },
  'src/main.tsx': {
    file: '@assets/main.js',
    imports: ['src/App.tsx'],
  },
  'src/App.tsx': {
    file: '@assets/app.js',
    imports: ['src/shared.ts', 'src/vendor.ts'],
  },
  'src/vendor.ts': {
    file: '@assets/vendor.js',
    imports: ['src/shared.ts'],
    dynamicImports: ['src/lazy.ts'],
  },
  'src/shared.ts': {
    file: '@assets/shared.js',
  },
  'src/lazy.ts': {
    file: '@assets/lazy.js',
  },
};

describe('routeClosure', () => {
  it("returns an entry's file plus its transitive static imports and excludes dynamicImports", () => {
    expect(routeClosure(manifest, ['index.html'])).toEqual([
      '@assets/index-entry.js',
      '@assets/main.js',
      '@assets/app.js',
      '@assets/shared.js',
      '@assets/vendor.js',
    ]);
  });

  it('dedupes files reachable through more than one import path', () => {
    expect(routeClosure(manifest, ['src/App.tsx', 'index.html'])).toEqual([
      '@assets/app.js',
      '@assets/shared.js',
      '@assets/vendor.js',
      '@assets/index-entry.js',
      '@assets/main.js',
    ]);
  });
});

const sizeOf = (file: string): number => {
  const sizes: Record<string, number> = {
    '@assets/index-entry.js': 1 * 1024,
    '@assets/main.js': 2 * 1024,
    '@assets/app.js': 3 * 1024,
    '@assets/shared.js': 4 * 1024,
    '@assets/vendor.js': 8 * 1024,
    '@assets/lazy.js': 100 * 1024,
  };
  return sizes[file] ?? 0;
};

const readerBudget = (maxGzipKb: number) => ({
  routes: {
    reader: { entries: ['index.html'], maxGzipKb },
  },
});

describe('checkBudget', () => {
  it('marks a route over its maxGzipKb as not ok and lists its five largest files by gzip size', () => {
    const results = checkBudget(manifest, readerBudget(10), sizeOf);

    expect(results).toHaveLength(1);
    const [result] = results;
    expect(result.route).toBe('reader');
    expect(result.gzipKb).toBe(18);
    expect(result.maxGzipKb).toBe(10);
    expect(result.ok).toBe(false);
    expect(result.largest).toEqual([
      { file: '@assets/vendor.js', gzipKb: 8 },
      { file: '@assets/shared.js', gzipKb: 4 },
      { file: '@assets/app.js', gzipKb: 3 },
      { file: '@assets/main.js', gzipKb: 2 },
      { file: '@assets/index-entry.js', gzipKb: 1 },
    ]);
  });

  it('marks a route within its maxGzipKb as ok with its summed gzip size', () => {
    const [result] = checkBudget(manifest, readerBudget(18), sizeOf);

    expect(result.route).toBe('reader');
    expect(result.gzipKb).toBe(18);
    expect(result.maxGzipKb).toBe(18);
    expect(result.ok).toBe(true);
    expect(result.largest.map((entry) => entry.file)).not.toContain(
      '@assets/lazy.js',
    );
  });
});
