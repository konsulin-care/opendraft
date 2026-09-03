import { describe, expect, it } from 'vitest';
import { ParserState, SerializerState } from '@milkdown/kit/transformer';
import { remark } from 'remark';
import { buildMinimalSchema } from '../src/milkdown/minimal-schema.js';

/**
 * Headless smoke test for the Milkdown transformer pipeline.
 *
 * Verifies that a minimal markdown schema (doc/paragraph/heading/text)
 * round-trips through ParserState/SerializerState without any DOM editor.
 */
describe('milkdown transformer smoke', () => {
  it('round-trips heading + paragraph through parse and serialize', () => {
    const schema = buildMinimalSchema();
    const parse = ParserState.create(schema, remark());
    const serialize = SerializerState.create(schema, remark());

    const doc = parse('# Title\n\nHello');

    expect(doc.type.name).toBe('doc');
    expect(doc.firstChild?.type.name).toBe('heading');
    expect(doc.lastChild?.type.name).toBe('paragraph');

    const markdown = serialize(doc);
    expect(markdown.trim()).toBe('# Title\n\nHello');
  });

  it('preserves heading levels', () => {
    const schema = buildMinimalSchema();
    const parse = ParserState.create(schema, remark());
    const serialize = SerializerState.create(schema, remark());

    const doc = parse('## Sub\n\nBody');
    const heading = doc.firstChild;
    expect(heading?.attrs.level).toBe(2);
    expect(serialize(doc).trim()).toBe('## Sub\n\nBody');
  });
});