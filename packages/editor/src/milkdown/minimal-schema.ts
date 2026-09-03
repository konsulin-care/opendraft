import { Schema } from '@milkdown/kit/prose/model';
import type { NodeSchema } from '@milkdown/kit/transformer';

export const textSchema: NodeSchema = {
  group: 'inline',
  toMarkdown: {
    match: (node) => node.isText,
    runner: (state, node) => state.addNode('text', undefined, node.text ?? ''),
  },
  parseMarkdown: {
    match: (node) => node.type === 'text',
    runner: (state, node) => state.addText(String(node.value ?? '')),
  },
};

export const paragraphSchema: NodeSchema = {
  content: 'inline*',
  group: 'block',
  toMarkdown: {
    match: (node) => node.type.name === 'paragraph',
    runner: (state, node) => state.openNode('paragraph').next(node.content).closeNode(),
  },
  parseMarkdown: {
    match: (node) => node.type === 'paragraph',
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    },
  },
};

export const headingSchema: NodeSchema = {
  attrs: { level: { default: 1 } },
  content: 'inline*',
  group: 'block',
  defining: true,
  toMarkdown: {
    match: (node) => node.type.name === 'heading',
    runner: (state, node) => {
      state.openNode('heading', undefined, { depth: node.attrs.level as number });
      state.next(node.content);
      state.closeNode();
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'heading',
    runner: (state, node, type) => {
      const level = typeof node.depth === 'number' ? node.depth : 1;
      state.openNode(type, { level });
      state.next(node.children);
      state.closeNode();
    },
  },
};

export const docSchema: NodeSchema = {
  content: 'block+',
  toMarkdown: {
    match: (node) => node.type.name === 'doc',
    // Root stays open; SerializerState.build() closes the outermost node.
    runner: (state, node) => state.openNode('root').next(node.content),
  },
  parseMarkdown: {
    match: (node) => node.type === 'root',
    runner: (state, node, type) => state.injectRoot(node, type),
  },
};

/**
 * Build a minimal markdown schema (doc/paragraph/heading/text) with
 * Milkdown parseMarkdown/toMarkdown specs for headless use.
 *
 * @returns A prosemirror Schema ready for ParserState/SerializerState.
 */
export function buildMinimalSchema(): Schema {
  return new Schema({
    nodes: {
      doc: docSchema,
      paragraph: paragraphSchema,
      heading: headingSchema,
      text: textSchema,
    },
  });
}