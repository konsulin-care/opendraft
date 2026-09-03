import { describe, expect, it } from 'vitest';
import { ParserState, SerializerState } from '@milkdown/kit/transformer';
import { buildManuscriptSchema } from '../src/milkdown/manuscript-schema.js';
import { createManuscriptRemark } from '../src/milkdown/manuscript-remark.js';

/**
 * Common block constructs emitted by the editor (lists, code, quotes,
 * links, images, hr, marks) must round-trip through the manuscript schema.
 */
function roundTrip(markdown: string) {
  const schema = buildManuscriptSchema();
  const remark = createManuscriptRemark();
  const parse = ParserState.create(schema, remark);
  const serialize = SerializerState.create(schema, remark);
  const doc = parse(markdown);
  return { doc, markdown: serialize(doc).trim() };
}

/** Name set of marks applied to any text inside a node. */
function markNames(node: readonly { marks: readonly { type: { name: string } }[] }[]): string[] {
  return node.flatMap((child) => child.marks.map((mark) => mark.type.name));
}

describe('manuscript schema: code and lists', () => {
  it('round-trips a fenced code block with language', () => {
    const input = ['# Code', '', '```python', 'x = 1', '```'].join('\n');
    const { doc, markdown } = roundTrip(input);

    const code = doc.firstChild!.child(1);
    expect(code.type.name).toBe('codeBlock');
    expect(code.attrs.language).toBe('python');
    expect(markdown).toBe(input);
  });

  it('round-trips bullet and ordered lists', () => {
    const input = ['# List', '', '* first', '* second', '', '1. one', '2. two'].join('\n');
    const { doc, markdown } = roundTrip(input);

    const section = doc.firstChild!;
    expect(section.child(1).type.name).toBe('bulletList');
    expect(section.child(2).type.name).toBe('orderedList');
    expect(section.child(2).child(0).type.name).toBe('listItem');
    expect(markdown).toBe(input);
  });
});

describe('manuscript schema: quotes and inline', () => {
  it('round-trips a blockquote with nested emphasis', () => {
    const input = ['# Quote', '', '> a *quoted* line'].join('\n');
    const { doc, markdown } = roundTrip(input);

    const quote = doc.firstChild!.child(1);
    expect(quote.type.name).toBe('blockquote');
    expect(markNames(quote.child(0).content.content)).toContain('em');
    expect(markdown).toBe(input);
  });

  it('round-trips inline marks and links', () => {
    const input = ['# Text', '', 'Some **bold**, *em*, `code` and [a link](https://x.dev).'].join('\n');
    const { doc, markdown } = roundTrip(input);
    const names = markNames(doc.firstChild!.child(1).content.content);

    expect(names).toContain('strong');
    expect(names).toContain('em');
    expect(names).toContain('code');
    expect(names).toContain('link');
    expect(markdown).toBe(input);
  });
});

describe('manuscript schema: images and literals', () => {
  it('round-trips images and thematic breaks', () => {
    const input = ['# Fig', '', '![alt](fig.png)', '', '***'].join('\n');
    const { doc, markdown } = roundTrip(input);

    const paragraph = doc.firstChild!.child(1);
    expect(paragraph.type.name).toBe('paragraph');
    expect(paragraph.child(0).type.name).toBe('image');
    expect(paragraph.child(0).attrs.alt).toBe('alt');
    expect(doc.firstChild!.child(2).type.name).toBe('hr');
    expect(markdown).toBe(input);
  });

  it('keeps raw html blocks verbatim', () => {
    const input = ['# Html', '', '<div class="raw">custom</div>'].join('\n');
    const { doc, markdown } = roundTrip(input);

    expect(doc.firstChild!.child(1).type.name).toBe('quartoBlock');
    expect(markdown).toBe(input);
  });
});