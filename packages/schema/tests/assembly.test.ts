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

  it('accepts empty block files referenced by the assembly', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: { 'blocks/intro.qmd': '' },
      files: ['intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
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

describe('validateAssembly: heading anchors', () => {
  it("rejects an included block whose heading anchor differs from 'sec-<file stem>'", () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: { 'blocks/intro.qmd': '# Intro {#sec-other .deo-intro}\n\nbody' },
      files: ['intro.qmd'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('anchor'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('sec-intro'))).toBe(true);
  });

  it("accepts an included block whose heading anchor equals 'sec-<file stem>'", () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: { 'blocks/intro.qmd': '# Intro {#sec-intro .deo-intro}\n\nbody' },
      files: ['intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports no anchor error for an included block with no heading line', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: { 'blocks/intro.qmd': 'plain body text\nsecond line' },
      files: ['intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.message.includes('anchor'))).toBe(false);
  });
});

describe('validateAssembly: outcomes unchanged by anchor check', () => {
  it('keeps existing include/orphan/duplicate validation outcomes unchanged', () => {
    const missing = validateAssembly({
      assembly: '{{< include blocks/ghost.qmd >}}',
      blockFiles: {},
      files: [],
    });
    expect(missing.valid).toBe(false);
    expect(missing.errors.some((e) => e.message.includes('ghost.qmd'))).toBe(true);

    const duplicate = validateAssembly({
      assembly: ['{{< include blocks/intro.qmd >}}', '{{< include blocks/intro.qmd >}}'].join('\n'),
      blockFiles: { 'blocks/intro.qmd': '# Intro {#sec-intro}\n\nbody' },
      files: ['intro.qmd'],
    });
    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors.some((e) => e.message.includes('duplicate'))).toBe(true);

    const orphan = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: { 'blocks/intro.qmd': '# Intro {#sec-intro}\n\nbody' },
      files: ['intro.qmd', 'scratch.qmd'],
    });
    expect(orphan.valid).toBe(true);
    expect(orphan.errors).toEqual([]);
    expect(orphan.warnings.some((w) => w.message.includes('scratch.qmd'))).toBe(true);
  });
});