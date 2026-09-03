import { describe, expect, it } from 'vitest';
import type { Node } from '@milkdown/kit/prose/model';
import { createManuscriptDoc } from '../src/milkdown/manuscript-sync.js';
import { ensureSectionIds } from '../src/milkdown/identity.js';
import {
  extractBlocks,
  mergeSection,
  reorderBlock,
  setDraft,
  splitSection,
} from '../src/milkdown/block-ops.js';

/** Build a three-section doc with stable ids and normalize ids. */
function buildDoc(): Node {
  return ensureSectionIds(
    createManuscriptDoc('# Intro {#intro}\n\none\n\ntwo\n\n# Methods {#methods}\n\nm1\n\n# Results {#results}\n\nr1'),
  );
}

describe('block operations: draft and reorder', () => {
  it('setDraft flags and unflags a section', () => {
    const doc = buildDoc();
    const flagged = setDraft(doc, 'intro', true);
    expect(flagged?.ok).toBe(true);

    const section = flagged && flagged.ok ? flagged.doc.child(0) : doc.child(0);
    expect(section.attrs.draft).toBe(true);

    const cleared = flagged && flagged.ok ? setDraft(flagged.doc, 'intro', false) : null;
    expect(cleared && cleared.ok ? cleared.doc.child(0).attrs.draft : null).toBe(false);
  });

  it('reorderBlock moves a section before a target', () => {
    const doc = buildDoc();
    const result = reorderBlock(doc, 'results', 'methods');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.doc.content.content.map((child) => child.attrs.id);
    expect(ids).toEqual(['intro', 'results', 'methods']);
  });

  it('mergeSection merges the next section into the current one', () => {
    const doc = buildDoc();
    const result = mergeSection(doc, 'intro');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.doc.childCount).toBe(2);
    const merged = result.doc.child(0);
    expect(merged.childCount).toBe(4);
    expect(merged.child(3).textContent).toBe('m1');
  });

  it('mergeSection rejects merging the last section', () => {
    const doc = buildDoc();
    const result = mergeSection(doc, 'results');
    expect(result.ok).toBe(false);
  });
});

describe('block operations: split and extract', () => {
  it('splitSection splits a section into two at a block index', () => {
    const doc = buildDoc();
    const result = splitSection(doc, 'intro', 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = ensureSectionIds(result.doc);
    expect(normalized.childCount).toBe(4);
    const first = normalized.child(0);
    const second = normalized.child(1);
    expect(first.attrs.id).toBe('intro');
    expect(second.type.name).toBe('section');
    expect(second.child(0).type.name).toBe('heading');
    expect(second.child(1).textContent).toBe('two');
  });

  it('extractBlocks moves a block range into a new section', () => {
    const doc = buildDoc();
    const result = extractBlocks(doc, 'intro', 1, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const normalized = ensureSectionIds(result.doc);
    expect(normalized.child(0).childCount).toBe(2);
    expect(normalized.child(1).childCount).toBe(2);
    expect(normalized.child(1).child(1).textContent).toBe('one');
  });
});