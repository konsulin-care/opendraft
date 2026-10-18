import { describe, expect, it } from 'vitest';

import { getFileCapability } from './file-capability';

describe('getFileCapability', () => {
  it('classifies .md and .qmd files as rich regardless of case', () => {
    expect(getFileCapability('a.md', 'x')).toBe('rich');
    expect(getFileCapability('B.QMD', 'x')).toBe('rich');
  });

  it('classifies the container article.qmd at the manuscript root as text', () => {
    const container = '---\nmetadata-files:\n- _author.yml\n\n{{< include blocks/01hx.qmd >}}\n::: {#refs}\n:::\n';
    expect(getFileCapability('manuscripts/2024-01/article.qmd', container)).toBe('text');
    expect(getFileCapability('article.qmd', container)).toBe('text');
  });

  it('keeps block files under blocks/ as rich', () => {
    expect(getFileCapability('manuscripts/2024-01/blocks/01hx00000000.qmd', '# Heading\n')).toBe('rich');
    expect(getFileCapability('manuscripts/2024-01/blocks/01hx00000000.qmd', '')).toBe('rich');
  });

  it('classifies other files with normal text as text', () => {
    expect(getFileCapability('refs.bib', 'normal text')).toBe('text');
    expect(getFileCapability('opendraft.yml', 'manuscripts: []')).toBe('text');
    expect(getFileCapability('notes', 'no extension here')).toBe('text');
  });

  it('classifies content containing a NUL character as binary', () => {
    expect(getFileCapability('data.bin', 'abc\u0000def')).toBe('binary');
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

  it('treats tab, newline and carriage return as normal text characters', () => {
    expect(getFileCapability('notes', 'line1\nline2\tcol\r\nend\n')).toBe('text');
  });
});
