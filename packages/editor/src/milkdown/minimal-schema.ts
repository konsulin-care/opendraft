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

interface MdastHeadingNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdastHeadingNode[];
  [k: string]: unknown;
}

/** Matches a trailing `{#slug}` heading attribute. */
const HEADING_ID_RE = /\{#([a-zA-Z0-9-]+)\}\s*$/;

/**
 * Extract a trailing `{#slug}` attribute from an mdast heading: returns the
 * id and a copy of the heading children with the attribute stripped.
 *
 * @param node - An mdast heading node.
 * @returns The extracted id (or null) and the attribute-stripped children.
 */
export function stripHeadingId(node: MdastHeadingNode): {
  id: string | null;
  children?: MdastHeadingNode[];
} {
  const children = node.children ? [...node.children] : undefined;
  const last = children?.[children.length - 1];
  if (last && last.type === 'text' && typeof last.value === 'string') {
    const match = HEADING_ID_RE.exec(last.value);
    if (match) {
      const value = last.value.slice(0, match.index).trimEnd();
      if (value.length > 0) {
        children![children.length - 1] = { ...last, value };
      } else {
        children!.pop();
      }
      return { id: match[1], children };
    }
  }
  return { id: null, children };
}

export const headingSchema: NodeSchema = {
  attrs: { level: { default: 1 }, id: { default: null } },
  content: 'inline*',
  group: 'block',
  defining: true,
  toMarkdown: {
    match: (node) => node.type.name === 'heading',
    runner: (state, node) => {
      state.openNode('heading', undefined, { depth: node.attrs.level as number });
      state.next(node.content);
      const id = node.attrs.id;
      if (typeof id === 'string' && id.length > 0) {
        state.addNode('text', undefined, ` {#${id}}`);
      }
      state.closeNode();
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'heading',
    runner: (state, node, type) => {
      const level = typeof node.depth === 'number' ? node.depth : 1;
      const { id, children } = stripHeadingId(node);
      state.openNode(type, { level, id: id ?? null });
      state.next(children);
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