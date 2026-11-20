import { describe, expect, it, vi } from 'vitest';
import type { CrossrefLabel } from '@opendraft/manuscript';
import { createLabelIndex } from './label-index';

/**
 * Build a label fixture for the given id and file.
 *
 * @param id - The label id, without the leading `@`.
 * @param file - The block file the label belongs to.
 * @returns A cross-reference label for tests.
 */
function label(id: string, file: string): CrossrefLabel {
  return { id, kind: 'fig', caption: id, file };
}

/**
 * Build a scanner that labels each file with its name and current text.
 *
 * @param scan - Optional spy to wrap; defaults to a plain scanner.
 * @returns A scanner producing one deterministic label per file.
 */
function makeScan(scan = (md: string, file: string): CrossrefLabel[] => [label(`${file}-${md}`, file)]) {
  return scan;
}

describe('createLabelIndex caching', () => {
  it('concatenates labels of file a then file b in first-insertion order', () => {
    const index = createLabelIndex(makeScan());
    index.update('a.qmd', 'one');
    index.update('b.qmd', 'two');
    expect(index.labels()).toEqual([label('a.qmd-one', 'a.qmd'), label('b.qmd-two', 'b.qmd')]);
  });

  it('does not rescan unchanged text and returns the same cached array', () => {
    const scan = vi.fn(makeScan());
    const index = createLabelIndex(scan);
    index.update('a.qmd', 'one');
    const first = index.labels();
    index.update('a.qmd', 'one');
    expect(scan).toHaveBeenCalledTimes(1);
    expect(index.labels()).toBe(first);
  });

  it('rescans changed text and drops the cached array', () => {
    const scan = vi.fn(makeScan());
    const index = createLabelIndex(scan);
    index.update('a.qmd', 'one');
    const first = index.labels();
    index.update('a.qmd', 'two');
    expect(scan).toHaveBeenCalledTimes(2);
    expect(index.labels()).not.toBe(first);
    expect(index.labels()).toEqual([label('a.qmd-two', 'a.qmd')]);
  });
});

describe('createLabelIndex file membership', () => {
  it('drops labels of removed files', () => {
    const index = createLabelIndex(makeScan());
    index.update('a.qmd', 'one');
    index.update('b.qmd', 'two');
    index.remove('a.qmd');
    expect(index.labels()).toEqual([label('b.qmd-two', 'b.qmd')]);
  });

  it('retains only the listed files in their existing order', () => {
    const index = createLabelIndex(makeScan());
    index.update('a.qmd', 'one');
    index.update('b.qmd', 'two');
    index.update('c.qmd', 'three');
    index.retain(['c.qmd', 'a.qmd']);
    expect(index.labels()).toEqual([label('a.qmd-one', 'a.qmd'), label('c.qmd-three', 'c.qmd')]);
  });

  it('keeps file order when a retained file is updated', () => {
    const index = createLabelIndex(makeScan());
    index.update('a.qmd', 'one');
    index.update('b.qmd', 'two');
    index.update('a.qmd', 'changed');
    expect(index.labels()).toEqual([label('a.qmd-changed', 'a.qmd'), label('b.qmd-two', 'b.qmd')]);
  });
});
