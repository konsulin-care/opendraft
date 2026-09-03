import { Schema } from '@milkdown/kit/prose/model';
import type { NodeSchema } from '@milkdown/kit/transformer';
import {
  docSchema,
  headingSchema,
  paragraphSchema,
  stripHeadingId,
  textSchema,
} from './minimal-schema.js';

const sectionSchema: NodeSchema = {
  group: 'block',
  content: 'heading block*',
  defining: true,
  isolate: true,
  attrs: { id: { default: null }, draft: { default: false } },
  toMarkdown: {
    match: (node) => node.type.name === 'section',
    // Sections serialize inline: their children flow directly under root.
    runner: (state, node) => state.next(node.content),
  },
  parseMarkdown: {
    match: (node) => node.type === 'section',
    runner: (state, node, type) => {
      const first = node.children?.[0];
      const id = first?.type === 'heading' ? stripHeadingId(first).id : null;
      state.openNode(type, id ? { id } : {});
      state.next(node.children);
      state.closeNode();
    },
  },
};

const includeSchema: NodeSchema = {
  group: 'block',
  atom: true,
  attrs: { path: { default: '' } },
  toMarkdown: {
    match: (node) => node.type.name === 'include',
    runner: (state, node) =>
      state.addNode('html', undefined, `{{< include ${node.attrs.path as string} >}}`),
  },
  parseMarkdown: {
    match: (node) => node.type === 'include',
    runner: (state, node, type) => state.addNode(type, { path: node.path }),
  },
};

const glueSchema: NodeSchema = {
  group: 'block',
  atom: true,
  attrs: { value: { default: '' } },
  toMarkdown: {
    match: (node) => node.type.name === 'glue',
    // Glue is verbatim: emitted as raw markdown via an HTML node.
    runner: (state, node) => {
      const value = (node.attrs.value as string).trimEnd();
      state.addNode('html', undefined, value);
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'glue',
    runner: (state, node, type) => state.addNode(type, { value: node.value }),
  },
};

const quartoBlockSchema: NodeSchema = {
  group: 'block',
  atom: true,
  attrs: { value: { default: '' } },
  toMarkdown: {
    match: (node) => node.type.name === 'quartoBlock',
    runner: (state, node) => {
      const value = (node.attrs.value as string).trimEnd();
      state.addNode('html', undefined, value);
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'quartoBlock',
    runner: (state, node, type) => state.addNode(type, { value: node.value }),
  },
};

const quartoInlineSchema: NodeSchema = {
  group: 'inline',
  inline: true,
  atom: true,
  attrs: { value: { default: '' } },
  toMarkdown: {
    match: (node) => node.type.name === 'quartoInline',
    runner: (state, node) => state.addNode('html', undefined, node.attrs.value as string),
  },
  parseMarkdown: {
    match: (node) => node.type === 'quartoInline',
    runner: (state, node, type) => state.addNode(type, { value: node.value }),
  },
};

/**
 * Build the manuscript schema: doc restricts top level to sections,
 * include atoms, glue atoms and (later) quarto literals.
 *
 * @returns A prosemirror Schema for manuscript editing.
 */
export function buildManuscriptSchema(): Schema {
  return new Schema({
    nodes: {
      doc: docSchema,
      section: sectionSchema,
      include: includeSchema,
      glue: glueSchema,
      quartoBlock: quartoBlockSchema,
      quartoInline: quartoInlineSchema,
      heading: headingSchema,
      paragraph: paragraphSchema,
      text: textSchema,
    },
  });
}