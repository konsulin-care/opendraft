import { describe, it, expect } from 'vitest';
import { compileArticle } from '../src/article-compiler.js';

describe('compileArticle — full assembly', () => {
  it('assembles article.qmd from manifest and block files', () => {
    const blocks: Record<string, string> = {
      'a1b2c3d4.qmd': '# Introduction\n\nSome intro text.',
      'e5f6a7b8.qmd': '# Methods\n\nSome methods text.',
    };
    const manifest = {
      version: '1.0.0',
      blocks: [
        { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Introduction' },
        { id: 'e5f6a7b8', file: 'e5f6a7b8.qmd', title: 'Methods' },
      ],
    };
    const metadataFiles = '_author.yml\n  - _abstract.yml\n  - _frontmatter.yml';

    const result = compileArticle(manifest, metadataFiles, blocks);

    expect(result).toContain('{{< include blocks/a1b2c3d4.qmd >}}');
    expect(result).toContain('{{< include blocks/e5f6a7b8.qmd >}}');
    expect(result).toContain('metadata-files:');
    expect(result).toContain('# References');
    expect(result).toContain('::: {#refs}');
  });

  it('preserves manifest order in output', () => {
    const blocks: Record<string, string> = {
      'aaa11111.qmd': '# First',
      'bbb22222.qmd': '# Second',
      'ccc33333.qmd': '# Third',
    };
    const manifest = {
      version: '1.0.0',
      blocks: [
        { id: 'ccc33333', file: 'ccc33333.qmd', title: 'Third' },
        { id: 'aaa11111', file: 'aaa11111.qmd', title: 'First' },
        { id: 'bbb22222', file: 'bbb22222.qmd', title: 'Second' },
      ],
    };

    const result = compileArticle(manifest, '', blocks);
    const thirdPos = result.indexOf('ccc33333');
    const firstPos = result.indexOf('aaa11111');
    const secondPos = result.indexOf('bbb22222');

    expect(thirdPos).toBeLessThan(firstPos);
    expect(firstPos).toBeLessThan(secondPos);
  });
});

describe('compileArticle — error paths', () => {
  it('throws on missing block file', () => {
    const blocks: Record<string, string> = {};
    const manifest = {
      version: '1.0.0',
      blocks: [
        { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
      ],
    };

    expect(() => compileArticle(manifest, '', blocks)).toThrow('a1b2c3d4.qmd');
  });

  it('throws on invalid manifest', () => {
    const blocks: Record<string, string> = {};
    const manifest = { version: '1.0.0' }; // missing blocks

    expect(() => compileArticle(manifest, '', blocks)).toThrow();
  });
});

describe('compileArticle — single block', () => {
  it('assembles with a single block', () => {
    const blocks: Record<string, string> = {
      'a1b2c3d4.qmd': '# Only Section\n\nContent.',
    };
    const manifest = {
      version: '1.0.0',
      blocks: [
        { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Only Section' },
      ],
    };

    const result = compileArticle(manifest, '', blocks);
    expect(result).toContain('{{< include blocks/a1b2c3d4.qmd >}}');
    expect(result).toContain('# References');
  });
});
