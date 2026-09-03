import { describe, it, expect } from 'vitest';
import { validateAssembly } from '../src/assembly.js';

const ASSEMBLY = [
  '{{< include blocks/intro.qmd >}}',
  '',
  '{{< include blocks/methods.qmd >}}',
].join('\n');

describe('validateAssembly: consistency', () => {
  it('accepts a consistent assembly with matching block files', () => {
    const result = validateAssembly({
      assembly: ASSEMBLY,
      blockFiles: { 'blocks/intro.qmd': '# Intro\n\nbody', 'blocks/methods.qmd': '# Methods\n\nm1' },
      files: ['intro.qmd', 'methods.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects an include without a matching block file', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/ghost.qmd >}}',
      blockFiles: {},
      files: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost.qmd'))).toBe(true);
  });

  it('rejects duplicate includes of the same block', () => {
    const result = validateAssembly({
      assembly: ['{{< include blocks/intro.qmd >}}', '{{< include blocks/intro.qmd >}}'].join('\n'),
      blockFiles: { 'blocks/intro.qmd': '# Intro\n\nbody' },
      files: ['intro.qmd'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('duplicate'))).toBe(true);
  });

  it('rejects empty block files referenced by the assembly', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: { 'blocks/intro.qmd': '   ' },
      files: ['intro.qmd'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('empty'))).toBe(true);
  });
});

describe('validateAssembly: drafts and paths', () => {
  it('warns on orphan block files (drafts) without failing validity', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: { 'blocks/intro.qmd': '# Intro\n\nbody' },
      files: ['intro.qmd', 'scratch.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.some((e) => e.message.includes('scratch.qmd'))).toBe(true);
  });

  it('rejects non-block include paths', () => {
    const result = validateAssembly({
      assembly: '{{< include ../outside/x.qmd >}}',
      blockFiles: {},
      files: [],
    });

    expect(result.valid).toBe(false);
  });
});