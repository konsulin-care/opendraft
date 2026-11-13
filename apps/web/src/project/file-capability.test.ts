import { describe, expect, it } from 'vitest';

import {
  getFileCapability,
  isManuscriptArticlePath,
  isManuscriptBlockPath,
} from './file-capability';

/** A manuscript block path with the required prefix: manuscripts/<id>/blocks/_<short>.qmd. */
const BLOCK_PATH = 'manuscripts/2024-01/blocks/_intro.qmd';

/** The assembly file of a manuscript: rich (block-editor entry point). */
const ARTICLE_PATH = 'manuscripts/2024-01/article.qmd';

describe('getFileCapability', () => {
  it('classifies manuscripts/<id>/blocks/_<short>.qmd as rich for any valid short name', () => {
    expect(getFileCapability(BLOCK_PATH, '# Heading\n')).toBe('rich');
    expect(getFileCapability(BLOCK_PATH, '')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/_sec-2.qmd', 'x')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/_a.qmd', 'x')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/_readme.qmd', 'x')).toBe('rich');
    expect(getFileCapability('manuscripts/p/blocks/_2024-summary.qmd', 'x')).toBe('rich');
    // A ULID short name stays valid once it carries the required `_` prefix.
    expect(getFileCapability('manuscripts/p/blocks/_01hxyz00000000000000000000.qmd', 'x')).toBe('rich');
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

  it('rejects legacy unprefixed block files and invalid short names', () => {
    // Legacy un-prefixed block files are not rich block files any more.
    expect(getFileCapability('manuscripts/p/blocks/intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/_-intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/_intro-.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/_Intro.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/_sec_1.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/intro.mdown', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/_.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/p/blocks/intro.txt', 'x')).toBe('text');
    // A short name longer than 40 characters is not valid.
    expect(getFileCapability(`manuscripts/p/blocks/_${'a'.repeat(41)}.qmd`, 'x')).toBe('text');
  });
});

describe('getFileCapability — whitespace is plain text', () => {
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
  it('isManuscriptBlockPath matches only prefixed manuscript blocks/ files with a valid short name', () => {
    expect(isManuscriptBlockPath('manuscripts/p/blocks/_intro.qmd')).toBe(true);
    // The 40-character short-name boundary: 40 is valid, 41 is not.
    expect(isManuscriptBlockPath(`manuscripts/p/blocks/_${'a'.repeat(40)}.qmd`)).toBe(true);
    expect(isManuscriptBlockPath('manuscripts/p/blocks/intro.qmd')).toBe(false);
    expect(isManuscriptBlockPath(`manuscripts/p/blocks/_${'a'.repeat(41)}.qmd`)).toBe(false);
    expect(isManuscriptBlockPath('manuscripts/p/article.qmd')).toBe(false);
    expect(isManuscriptBlockPath('manuscripts/p/blocks/nested/_intro.qmd')).toBe(false);
    expect(isManuscriptBlockPath('blocks/_intro.qmd')).toBe(false);
  });

  it('isManuscriptArticlePath matches only manuscripts/<id>/article.qmd', () => {
    expect(isManuscriptArticlePath('manuscripts/2024-01/article.qmd')).toBe(true);
    expect(isManuscriptArticlePath('article.qmd')).toBe(false);
    expect(isManuscriptArticlePath('manuscripts/p/blocks/_intro.qmd')).toBe(false);
    expect(isManuscriptArticlePath('manuscripts/p/sections/article.qmd')).toBe(false);
  });
});
