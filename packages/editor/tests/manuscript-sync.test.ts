import { describe, expect, it } from 'vitest';
import { ParserState } from '@milkdown/kit/transformer';
import type { Node } from '@milkdown/kit/prose/model';
import { buildManuscriptSchema } from '../src/milkdown/manuscript-schema.js';
import { createManuscriptRemark } from '../src/milkdown/manuscript-remark.js';
import { ensureSectionIds } from '../src/milkdown/identity.js';
import { parseManuscript, serializeManuscript, wholeDocMarkdown, applyDraftFlags } from '../src/milkdown/manuscript-sync.js';

/**
 * Sync layer: serializeManuscript splits the doc into block files and an
 * include assembly; parseManuscript rebuilds the doc from both, flagging
 * orphan files as drafts and warning on missing includes.
 */
const schema = buildManuscriptSchema();
const remark = createManuscriptRemark();
const parse = ParserState.create(schema, remark);

const EXPANDED = '# Intro {#intro}\n\npara\n\n# Methods {#methods}\n\nbody';

/** Structural snapshot of a doc for identity comparisons. */
function structure(doc: Node): unknown {
  return doc.toJSON();
}

/** Assert that a composition serializes and reconstructs identically. */
function expectComposition(source: Node, assembly: string, blocks: Map<string, string>): void {
  expect(assembly).toContain('{{< include blocks/intro.qmd >}}');
  expect(assembly).toContain('{{< include blocks/methods.qmd >}}');
  expect(assembly.trimEnd()).toMatch(/# References\n\n::: \{#refs\}/);
  expect(blocks.get('intro')).toContain('# Intro {#intro}');
  expect(blocks.get('methods')).toContain('# Methods {#methods}');

  const { doc } = parseManuscript({ assembly, blockFiles: Object.fromEntries(blocks) });
  expect(structure(doc)).toEqual(structure(source));
}



describe('manuscript sync layer', () => {
  it('serializeManuscript -> parseManuscript reconstructs the doc', () => {
    const source = ensureSectionIds(parse(EXPANDED));
    const { assembly, blocks } = serializeManuscript(source);
    expectComposition(source, assembly, blocks);
  });

  it('flags orphan block files as draft sections kept out of the assembly', () => {
    const { assembly, blocks } = serializeManuscript(ensureSectionIds(parse(EXPANDED)));
    blocks.set('scratch', '# Scratch {#scratch}\n\ndraft text');

    const { doc, warnings } = parseManuscript({
      assembly,
      blockFiles: Object.fromEntries(blocks),
    });

    expect(warnings).toEqual([]);
    const draft = doc.child(2);
    expect(draft.type.name).toBe('section');
    expect([draft.attrs.id, draft.attrs.draft]).toEqual(['scratch', true]);

    const reserialized = serializeManuscript(doc);
    expect(reserialized.blocks.has('scratch')).toBe(true);
    expect(reserialized.assembly).not.toContain('blocks/scratch.qmd');
  });

  it('warns and keeps a literal marker for includes without a block file', () => {
    const { doc, warnings } = parseManuscript({
      assembly: '{{< include blocks/ghost.qmd >}}',
      blockFiles: {},
    });

    expect(warnings.length).toBe(1);
    const marker = doc.child(0);
    expect(marker.type.name).toBe('quartoBlock');
    expect(marker.attrs.value).toBe('{{< include blocks/ghost.qmd >}}');
  });
});

describe('manuscript sync helpers', () => {
  it('wholeDocMarkdown serializes sections inline for the editor', () => {
    const doc = ensureSectionIds(parse(EXPANDED));
    expect(wholeDocMarkdown(doc)).toBe(EXPANDED);
  });

  it('applyDraftFlags keeps draft sections out of the assembly', () => {
    const doc = ensureSectionIds(parse(EXPANDED));
    const flagged = applyDraftFlags(doc, new Set(['intro']));

    const { assembly, blocks } = serializeManuscript(flagged);
    expect(assembly).not.toContain('blocks/intro.qmd');
    expect(blocks.has('intro')).toBe(true);
    expect(assembly).toContain('blocks/methods.qmd');
  });
});