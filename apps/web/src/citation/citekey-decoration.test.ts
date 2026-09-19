import { describe, it, expect } from 'vitest';
import { buildCitekeyDecorations, CITEKEY_PATTERN } from './citekey-decoration';
import type { Reference } from '@opendraft/references';
import { Schema } from '@milkdown/kit/prose/model';

function createTestSchema(): Schema {
  return new Schema({
    nodes: { doc: { content: 'block+' }, paragraph: { group: 'block', content: 'inline*' }, text: { group: 'inline' } },
    marks: { bold: {}, italic: {} },
  });
}

function createDoc(schema: Schema, text: string) {
  return doc(schema, paragraph(schema, schema.text(text)));
}

function createDocWithParagraphs(schema: Schema, texts: string[]) {
  return doc(schema, ...texts.map((t) => paragraph(schema, schema.text(t))));
}

function doc(schema: Schema, ...children: ReturnType<Schema['nodes']['paragraph']['create']>[]) {
  return schema.nodes.doc.create(null, children);
}

function paragraph(schema: Schema, ...children: ReturnType<Schema['text']['create']>[]) {
  return schema.nodes.paragraph.create(null, children);
}

const refs: Reference[] = [
  { citeKey: 'smith2024', entryType: 'article', fields: { author: 'Smith', year: '2024', title: 'Test' } },
  { citeKey: 'doe2023', entryType: 'book', fields: { author: 'Doe', year: '2023', title: 'Book' } },
];

describe('CITEKEY_PATTERN', () => {
  it('matches @citekey at start', () => {
    expect('@smith2024'.matchAll(CITEKEY_PATTERN).next().value?.[1]).toBe('smith2024');
  });

  it('matches after whitespace', () => {
    expect('See @smith2024'.matchAll(CITEKEY_PATTERN).next().value?.[1]).toBe('smith2024');
  });

  it('matches inside brackets', () => {
    expect('[@smith2024]'.matchAll(CITEKEY_PATTERN).next().value?.[1]).toBe('smith2024');
  });

  it('matches negative citation', () => {
    expect('[-@smith2024]'.matchAll(CITEKEY_PATTERN).next().value?.[1]).toBe('smith2024');
  });

  it('matches multiple', () => {
    const keys = Array.from('[@smith2024; @doe2023]'.matchAll(CITEKEY_PATTERN)).map((m) => m[1]);
    expect(keys).toContain('smith2024');
    expect(keys).toContain('doe2023');
  });

  it('rejects emails', () => {
    expect(Array.from('email@example.com'.matchAll(CITEKEY_PATTERN))).toHaveLength(0);
  });

  it('rejects word-internal @', () => {
    expect(Array.from('word@smith2024'.matchAll(CITEKEY_PATTERN))).toHaveLength(0);
  });
});

describe('buildCitekeyDecorations', () => {
  it('creates decorations for known citekeys', () => {
    const schema = createTestSchema();
    const decoSet = buildCitekeyDecorations(createDoc(schema, '@smith2024 text'), refs);
    expect(decoSet.find(0, 20).length).toBeGreaterThan(0);
  });

  it('skips unknown citekeys', () => {
    const schema = createTestSchema();
    const decoSet = buildCitekeyDecorations(createDoc(schema, '@unknown'), refs);
    expect(decoSet.find(0, 10).length).toBe(0);
  });

  it('decorates only citekey part', () => {
    const schema = createTestSchema();
    const citekeyMap = new Map<number, string>();
    const decoSet = buildCitekeyDecorations(createDoc(schema, '[@smith2024]'), refs, citekeyMap);
    const found = decoSet.find(0, 20);
    expect(found.length).toBe(1);
    expect(found[0].from).toBe(2);
    expect(citekeyMap.get(2)).toBe('smith2024');
  });

  it('decorates multiple citekeys', () => {
    const schema = createTestSchema();
    const decoSet = buildCitekeyDecorations(createDoc(schema, '[@smith2024; @doe2023]'), refs);
    expect(decoSet.find(0, 30).length).toBe(2);
  });

  it('decorates across paragraphs', () => {
    const schema = createTestSchema();
    const decoSet = buildCitekeyDecorations(createDocWithParagraphs(schema, ['@smith2024', '@doe2023']), refs);
    expect(decoSet.find(0, 30).length).toBe(2);
  });
});
