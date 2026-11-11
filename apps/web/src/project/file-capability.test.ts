import { describe, expect, it } from 'vitest';

import {
  getFileCapability,
  isManuscriptArticlePath,
  isManuscriptBlockPath,
} from './file-capability';

/** A manuscript block path with a plain slug stem: manuscripts/<id>/blocks/<slug>.qmd. */
const BLOCK_PATH = 'manuscripts/2024-01/blocks/intro.qmd';

/** The assembly file of a manuscript: rich (block-editor entry point). */
const ARTICLE_PATH = 'manuscripts/2024-01/article.qmd';

describe('getFileCapability', () => {
  it('classifies manuscripts/<id>/blocks/<slug>.qmd as rich for any valid slug stem', () => {
    expect(getFileCapability(BLOCK_PATH, '# Heading\n')).toBe('rich');
    expect(getFileCapability(BLOCK_PATH, '')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/sec-2.qmd', 'x')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/a.qmd', 'x')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/readme.qmd', 'x')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/2024-summary.qmd', 'x')).toBe('rich');
    // Legacy ULID-named blocks stay valid: a ULID stem is also a valid slug.
    expect(getFileCapability('manuscripts/p/blocks/01hxyz00000000000000000000.qmd', 'x')).toBe('rich');
  });

  it('classifies manuscripts/<id>/article.qmd as rich', () => {
    const container = '---\nmetadata-files:\n- _author.yml\n\n{{< include blocks/intro.qmd >}}\n::: {#refs}\n:::\n';
    expect(getFileCapability(ARTICLE_PATH, container)).toBe('rich');
    expect(getFileCapability('manuscripts/untitled-project/article.qmd', '')).toBe('rich');
  });

  it('classifies files outside a manuscript blocks/ directory as text', () => {
    const container = '---\nmetadata-files:\n- _author.yml\n\n{{< include blocks/intro.qmd >}}\n::: {#refs}\n:::\n';
    // The root-level article.qmd is not a manuscript assembly: text.
    expect(getFileCapability('article.qmd', container)).toBe('text');
    expect(getFileCapability('manuscript.md', '# Heading\n')).toBe('text');
    expect(getFileCapability('notes.qmd', '# Heading\n')).toBe('text');
    expect(getFileCapability('a/x.qmd', '# Heading\n')).toBe('text');
    expect(getFileCapability('blocks/intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/sections/intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/blocks/nested/intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/references.bib', 'x')).toBe('text');
    expect(getFileCapability('refs.bib', 'normal text')).toBe('text');
    expect(getFileCapability('opendraft.yml', 'manuscripts: []')).toBe('text');
    expect(getFileCapability('notes', 'no extension here')).toBe('text');
  });

  it('rejects invalid slug stems in the blocks/ segment', () => {
    expect(getFileCapability('manuscripts/p/blocks/-intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/intro-.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/Intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/sec_1.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/intro.mdown', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/intro.txt', 'x')).toBe('text');
  });

  it('treats tab, newline and carriage return as normal text characters', () => {
    expect(getFileCapability('notes', 'line1\nline2\tcol\r\nend\n')).toBe('text');
  });
});

describe('getFileCapability — binary detection', () => {
  it('classifies content containing a NUL character as binary', () => {
    expect(getFileCapability('data.bin', 'abc\u0000def')).toBe('binary');
  });

  it('classifies content with dense control characters as binary', () => {
    expect(getFileCapability('data.bin', 'ab\u0001\u0002\u0003\u0004')).toBe('binary');
  });

  it('keeps sparse control characters as text', () => {
    expect(getFileCapability('notes', 'a\u0001bcdefghijkl')).toBe('text');
  });
});

describe('path helpers', () => {
  it('isManuscriptBlockPath matches only manuscript blocks/ files with a valid slug', () => {
    expect(isManuscriptBlockPath('manuscripts/p/blocks/intro.qmd')).toBe(true);
    expect(isManuscriptBlockPath('manuscripts/p/article.qmd')).toBe(false);
    expect(isManuscriptBlockPath('manuscripts/p/blocks/nested/intro.qmd')).toBe(false);
    expect(isManuscriptBlockPath('blocks/intro.qmd')).toBe(false);
  });

  it('isManuscriptArticlePath matches only manuscripts/<id>/article.qmd', () => {
    expect(isManuscriptArticlePath('manuscripts/2024-01/article.qmd')).toBe(true);
    expect(isManuscriptArticlePath('article.qmd')).toBe(false);
    expect(isManuscriptArticlePath('manuscripts/p/blocks/intro.qmd')).toBe(false);
    expect(isManuscriptArticlePath('manuscripts/p/sections/article.qmd')).toBe(false);
  });
});
