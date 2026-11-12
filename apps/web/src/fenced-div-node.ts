import { $node } from '@milkdown/kit/utils';

/**
 * Milkdown schema node for a verbatim Pandoc fenced div.
 *
 * Holds the div's raw source text in a `value` attribute. The parse
 * runner receives the `fencedDiv` mdast node produced by the
 * `fencedDivRemarkPlugin` in `fenced-div.ts`; the stringify runner
 * re-emits the attribute so the `fencedDivHandler` can print it back
 * unchanged. As an atom block it renders read-only in the editor,
 * which keeps the source text from being reflowed by rich-text
 * editing.
 */
export const fencedDivNode = $node('fencedDiv', () => ({
  group: 'block',
  atom: true,
  attrs: { value: { default: '' } },
  toDOM: (node) => [
    'div',
    { 'data-fenced-div': '' },
    String(node.attrs.value ?? ''),
  ],
  parseMarkdown: {
    match: (node) => node.type === 'fencedDiv',
    runner: (state, node, type) => {
      const value = typeof node.value === 'string' ? node.value : '';
      state.addNode(type, { value });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'fencedDiv',
    runner: (state, node) => {
      const value = typeof node.attrs.value === 'string' ? node.attrs.value : '';
      state.addNode('fencedDiv', undefined, value);
    },
  },
}));
