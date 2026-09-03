import { describe, expect, it } from 'vitest';
import { ParserState, SerializerState } from '@milkdown/kit/transformer';
import { buildManuscriptSchema } from '../src/milkdown/manuscript-schema.js';
import { createManuscriptRemark } from '../src/milkdown/manuscript-remark.js';

/**
 * Quarto literal passthrough: callouts, custom divs, block shortcodes and
 * inline shortcodes must survive the round-trip verbatim.
 */
const CALLOUT_INPUT = [
  '# Intro',
  '',
  '::: {.callout-note}',
  'Callout with **bold** and a code block:',
  '',
  '``` r',
  'x <- 1',
  '```',
  ':::',
].join('\n');

const CUSTOM_DIV_INPUT = ['# Fig', '', '::: {#fig-x .custom}', 'custom div content', ':::'].join('\n');

const BLOCK_SHORTCODE_INPUT = ['# Intro', '', '{{< embed assets/paper.pdf >}}'].join('\n');

const INLINE_SHORTCODE_INPUT = ['# Intro', '', 'Text with {{< icon fixme >}} inline.'].join('\n');

function roundTrip(markdown: string) {
  const schema = buildManuscriptSchema();
  const remark = createManuscriptRemark();
  const parse = ParserState.create(schema, remark);
  const serialize = SerializerState.create(schema, remark);
  const doc = parse(markdown);
  return { doc, markdown: serialize(doc).trim() };
}

describe('quarto literal passthrough', () => {
  it('round-trips a callout with nested bold and a fenced code block byte-identical', () => {
    const { doc, markdown } = roundTrip(CALLOUT_INPUT);

    const section = doc.firstChild!;
    const callout = section.child(1);
    expect(callout.type.name).toBe('quartoBlock');
    expect(callout.attrs.value).toContain('::: {.callout-note}');
    expect(markdown).toBe(CALLOUT_INPUT);
  });

  it('preserves custom divs verbatim', () => {
    const { doc, markdown } = roundTrip(CUSTOM_DIV_INPUT);

    const section = doc.firstChild!;
    expect(section.child(1).type.name).toBe('quartoBlock');
    expect(markdown).toBe(CUSTOM_DIV_INPUT);
  });

  it('preserves unrecognized block shortcodes verbatim', () => {
    const { doc, markdown } = roundTrip(BLOCK_SHORTCODE_INPUT);

    const section = doc.firstChild!;
    expect(section.child(1).type.name).toBe('quartoBlock');
    expect(section.child(1).attrs.value).toBe('{{< embed assets/paper.pdf >}}');
    expect(markdown).toBe(BLOCK_SHORTCODE_INPUT);
  });

  it('captures inline shortcodes as quartoInline nodes', () => {
    const { doc, markdown } = roundTrip(INLINE_SHORTCODE_INPUT);

    const paragraph = doc.firstChild!.child(1);
    expect(paragraph.type.name).toBe('paragraph');
    const literal = paragraph.child(1);
    expect(literal.type.name).toBe('quartoInline');
    expect(literal.attrs.value).toBe('{{< icon fixme >}}');
    expect(markdown).toBe(INLINE_SHORTCODE_INPUT);
  });
});