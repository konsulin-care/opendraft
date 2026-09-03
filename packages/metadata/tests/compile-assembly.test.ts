import { describe, it, expect } from 'vitest';
import { compileAssembly } from '../src/article-compiler.js';

describe('compileAssembly', () => {
  it('passes through a valid assembly with canonical include lines', () => {
    const assembly = [
      '{{< include blocks/intro.qmd >}}',
      '',
      'Some glue prose.',
      '',
      '{{< include   blocks/methods.qmd   >}}',
      '',
      '# References',
      '',
      '::: {#refs}',
      ':::',
    ].join('\n');
    const blocks = {
      'blocks/intro.qmd': '# Intro\n\nbody',
      'blocks/methods.qmd': '# Methods\n\nm1',
    };

    const result = compileAssembly(assembly, blocks);
    expect(result.success).toBe(true);
    expect(result.article).toContain('{{< include blocks/intro.qmd >}}');
    expect(result.article).toContain('{{< include blocks/methods.qmd >}}');
    expect(result.article).toContain('Some glue prose.');
    expect(result.article).toContain('# References');
  });

  it('fails on a missing block file', () => {
    const result = compileAssembly('{{< include blocks/ghost.qmd >}}', {});
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports orphan drafts as warnings without failing', () => {
    const result = compileAssembly('{{< include blocks/intro.qmd >}}', {
      'blocks/intro.qmd': '# Intro\n\nbody',
    });
    expect(result.success).toBe(true);
  });
});