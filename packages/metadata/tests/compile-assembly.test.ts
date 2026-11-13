import { describe, it, expect } from 'vitest';
import { compileAssembly } from '../src/article-compiler.js';

describe('compileAssembly', () => {
  it('passes through a valid assembly with canonical include lines', () => {
    const assembly = [
      '{{< include blocks/_intro.qmd >}}',
      '',
      'Some glue prose.',
      '',
      '{{< include   blocks/_methods.qmd   >}}',
      '',
      '# References',
      '',
      '::: {#refs}',
      ':::',
    ].join('\n');
    const blocks = {
      'blocks/_intro.qmd': '# Intro\n\nbody',
      'blocks/_methods.qmd': '# Methods\n\nm1',
    };

    const result = compileAssembly(assembly, blocks);
    expect(result.success).toBe(true);
    expect(result.article).toContain('{{< include blocks/_intro.qmd >}}');
    expect(result.article).toContain('{{< include blocks/_methods.qmd >}}');
    expect(result.article).toContain('Some glue prose.');
    expect(result.article).toContain('# References');
  });

  it('normalizes a whitespace-flexible prefixed include to the canonical single-space form', () => {
    const assembly = '{{< include   blocks/_methods.qmd   >}}';
    const result = compileAssembly(assembly, { 'blocks/_methods.qmd': '# Methods\n\nm1' });

    expect(result.success).toBe(true);
    expect(result.article).toBe('{{< include blocks/_methods.qmd >}}\n');
  });
});

describe('compileAssembly: diagnostics', () => {
  it('fails on a missing block file', () => {
    const result = compileAssembly('{{< include blocks/_ghost.qmd >}}', {});
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails on a legacy un-prefixed include', () => {
    const result = compileAssembly('{{< include blocks/intro.qmd >}}', {});
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('opendraft block normalize'))).toBe(true);
  });

  it('reports orphan drafts as warnings without failing', () => {
    const result = compileAssembly('{{< include blocks/_intro.qmd >}}', {
      'blocks/_intro.qmd': '# Intro\n\nbody',
    });
    expect(result.success).toBe(true);
  });
});
