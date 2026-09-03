import { describe, expect, it } from 'vitest';
import { ParserState, SerializerState } from '@milkdown/kit/transformer';
import { buildManuscriptSchema } from '../src/milkdown/manuscript-schema.js';
import { createManuscriptRemark } from '../src/milkdown/manuscript-remark.js';

/**
 * Manuscript schema: sections regrouped at H1 boundaries, include atoms
 * for {{< include >}} shortcodes, glue for top-level verbatim prose.
 */
function roundTrip(markdown: string) {
  const schema = buildManuscriptSchema();
  const remark = createManuscriptRemark();
  const parse = ParserState.create(schema, remark);
  const serialize = SerializerState.create(schema, remark);
  const doc = parse(markdown);
  return { doc, markdown: serialize(doc).trim() };
}

describe('manuscript schema: section grouping', () => {
  it('groups flat markdown into sections at H1 boundaries, H2 stays inside', () => {
    const { doc, markdown } = roundTrip('# Intro\n\npara\n\n## Sub\n\n# Methods');

    expect(doc.childCount).toBe(2);
    expect(doc.firstChild?.type.name).toBe('section');

    const intro = doc.firstChild!;
    expect(intro.childCount).toBe(3);
    expect(intro.child(0).type.name).toBe('heading');
    expect(intro.child(0).attrs.level).toBe(1);
    expect(intro.child(1).type.name).toBe('paragraph');
    expect(intro.child(2).type.name).toBe('heading');
    expect(intro.child(2).attrs.level).toBe(2);

    expect(doc.lastChild?.type.name).toBe('section');
    expect(markdown).toBe('# Intro\n\npara\n\n## Sub\n\n# Methods');
  });

  it('round-trips include shortcodes as include atoms', () => {
    const input = [
      '# Intro',
      '',
      'para',
      '',
      '{{< include blocks/methods.qmd >}}',
      '',
      '# Methods',
      '',
      'body',
    ].join('\n');
    const { doc, markdown } = roundTrip(input);

    expect(doc.childCount).toBe(3);
    const include = doc.child(1);
    expect(include.type.name).toBe('include');
    expect(include.attrs.path).toBe('blocks/methods.qmd');
    expect(markdown).toBe(input);
  });

  it('keeps top-level preamble as verbatim glue', () => {
    const { doc, markdown } = roundTrip('Preamble\n\n# Intro\n\npara');

    expect(doc.childCount).toBe(2);
    expect(doc.firstChild?.type.name).toBe('glue');
    expect(markdown).toBe('Preamble\n\n# Intro\n\npara');
  });
});