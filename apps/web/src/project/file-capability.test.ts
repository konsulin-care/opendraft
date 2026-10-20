import { describe, expect, it } from 'vitest';

import { getFileCapability, isManuscriptBlockPath } from './file-capability';

/** A valid manuscript block path: manuscripts/<id>/blocks/<26-char lowercase ULID>.qmd. */
const BLOCK_PATH = 'manuscripts/2024-01/blocks/01hxyz00000000000000000000.qmd';

describe('getFileCapability', () => {
  it('classifies manuscript block files as rich', () => {
    expect(getFileCapability(BLOCK_PATH, '# Heading\n')).toBe('rich');
    expect(getFileCapability(BLOCK_PATH, '')).toBe('rich');
  });

  it('classifies root .md and .qmd files as text, not rich', () => {
    expect(getFileCapability('manuscript.md', '# Heading\n')).toBe('text');
    expect(getFileCapability('notes.qmd', '# Heading\n')).toBe('text');
    expect(getFileCapability('a/x.qmd', '# Heading\n')).toBe('text');
  });

  it('classifies the container article.qmd as text', () => {
    const container = '---\nmetadata-files:\n- _author.yml\n\n{{< include blocks/01hx.qmd >}}\n::: {#refs}\n:::\n';
    expect(getFileCapability('manuscripts/2024-01/article.qmd', container)).toBe('text');
    expect(getFileCapability('article.qmd', container)).toBe('text');
  });

  it('requires exactly 26 ULID characters in the blocks/ segment', () => {
    expect(getFileCapability('manuscripts/2024-01/blocks/01hx.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/blocks/01hxyz000000000000000000000.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/blocks/readme.qmd', 'x')).toBe('text');
  });

  it('requires the lowercase ULID alphabet in the blocks/ segment', () => {
    expect(getFileCapability('manuscripts/2024-01/blocks/01HXYZ00000000000000000000.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/blocks/01hxy-z0000000000000000000.qmd', 'x')).toBe('text');
  });

  it('requires the manuscripts/<id>/blocks/ prefix for rich files', () => {
    expect(getFileCapability('blocks/01hxyz00000000000000000000.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/sections/01hxyz00000000000000000000.qmd', 'x')).toBe('text');
    expect(getFileCapability('manuscripts/2024-01/blocks/nested/01hxyz00000000000000000000.qmd', 'x')).toBe('text');
  });

  it('classifies other files with normal text as text', () => {
    expect(getFileCapability('refs.bib', 'normal text')).toBe('text');
    expect(getFileCapability('opendraft.yml', 'manuscripts: []')).toBe('text');
    expect(getFileCapability('notes', 'no extension here')).toBe('text');
  });

  it('treats tab, newline and carriage return as normal text characters', () => {
    expect(getFileCapability('notes', 'line1\nline2\tcol\r\nend\n')).toBe('text');
  });
});

describe('getFileCapability — binary detection', () => {
  it('classifies content containing a NUL character as binary', () => {
    expect(getFileCapability('data.bin', 'abc\u0000def')).toBe('binary');
    expect(getFileCapability(BLOCK_PATH, 'abc\u0000def')).toBe('binary');
  });

  it('classifies content with more than 10% control characters as binary', () => {
    // 11 control characters out of 100 total => 11% > 10%.
    const content = '\u0001'.repeat(11) + 'a'.repeat(89);
    expect(getFileCapability('data.bin', content)).toBe('binary');
  });

  it('keeps content at or under 10% control characters as text', () => {
    // 10 control characters out of 100 total => exactly 10%, not more.
    const content = '\u0001'.repeat(10) + 'a'.repeat(90);
    expect(getFileCapability('data.bin', content)).toBe('text');
  });
});

describe('isManuscriptBlockPath', () => {
  it('accepts manuscripts/<id>/blocks/<26-char lowercase ULID>.qmd', () => {
    expect(isManuscriptBlockPath(BLOCK_PATH)).toBe(true);
    expect(isManuscriptBlockPath('manuscripts/untitled-project/blocks/01jx8v2k4m5n6p7q8r9s0t1w2x.qmd')).toBe(true);
  });

  it('rejects every other path shape', () => {
    expect(isManuscriptBlockPath('manuscript.md')).toBe(false);
    expect(isManuscriptBlockPath('article.qmd')).toBe(false);
    expect(isManuscriptBlockPath('manuscripts/p/article.qmd')).toBe(false);
    expect(isManuscriptBlockPath('manuscripts/p/blocks/short.qmd')).toBe(false);
    expect(isManuscriptBlockPath('manuscripts/p/blocks/01HXYZ00000000000000000000.qmd')).toBe(false);
    expect(isManuscriptBlockPath('manuscripts/p/blocks/01hxyz00000000000000000000.txt')).toBe(false);
    expect(isManuscriptBlockPath('opendraft.yml')).toBe(false);
    expect(isManuscriptBlockPath('refs.bib')).toBe(false);
  });
});
