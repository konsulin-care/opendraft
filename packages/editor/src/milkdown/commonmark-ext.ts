import type { MarkSchema, NodeSchema } from '@milkdown/kit/transformer';

/**
 * Common block constructs the editor can produce: lists, quotes, code
 * blocks, images, horizontal rules, hard breaks, and inline marks.
 * Mirror of the Milkdown preset-commonmark specs, in camelCase node names,
 * so editor markdown round-trips through the manuscript schema.
 */

export const blockquoteSchema: NodeSchema = {
  group: 'block',
  content: 'block+',
  defining: true,
  toMarkdown: {
    match: (node) => node.type.name === 'blockquote',
    runner: (state, node) => state.openNode('blockquote').next(node.content).closeNode(),
  },
  parseMarkdown: {
    match: (node) => node.type === 'blockquote',
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    },
  },
};

export const bulletListSchema: NodeSchema = {
  group: 'block',
  content: 'listItem+',
  toMarkdown: {
    match: (node) => node.type.name === 'bulletList',
    runner: (state, node) =>
      state
        .openNode('list', undefined, { ordered: false, spread: false })
        .next(node.content)
        .closeNode(),
  },
  parseMarkdown: {
    match: (node) => node.type === 'list' && !node.ordered,
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    },
  },
};

export const orderedListSchema: NodeSchema = {
  group: 'block',
  content: 'listItem+',
  attrs: { start: { default: 1 } },
  toMarkdown: {
    match: (node) => node.type.name === 'orderedList',
    runner: (state, node) =>
      state
        .openNode('list', undefined, { ordered: true, start: node.attrs.start as number, spread: false })
        .next(node.content)
        .closeNode(),
  },
  parseMarkdown: {
    match: (node) => node.type === 'list' && node.ordered === true,
    runner: (state, node, type) => {
      state.openNode(type, { start: node.start ?? 1 });
      state.next(node.children);
      state.closeNode();
    },
  },
};

export const listItemSchema: NodeSchema = {
  group: 'listItem',
  content: 'paragraph block*',
  defining: true,
  toMarkdown: {
    match: (node) => node.type.name === 'listItem',
    runner: (state, node) => state.openNode('listItem').next(node.content).closeNode(),
  },
  parseMarkdown: {
    match: (node) => node.type === 'listItem',
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    },
  },
};

export const codeBlockSchema: NodeSchema = {
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,
  code: true,
  attrs: { language: { default: '' } },
  toMarkdown: {
    match: (node) => node.type.name === 'codeBlock',
    runner: (state, node) => {
      const language = node.attrs.language as string;
      state.openNode('code', node.textContent, language ? { lang: language } : {});
      state.closeNode();
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'code',
    runner: (state, node, type) => {
      const language = typeof node.lang === 'string' ? node.lang : '';
      state.openNode(type, { language });
      if (node.value) state.addText(String(node.value));
      state.closeNode();
    },
  },
};

export const imageSchema: NodeSchema = {
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  marks: '',
  attrs: {
    src: { default: '' },
    alt: { default: '' },
    title: { default: '' },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'image',
    runner: (state, node) =>
      state.addNode('image', undefined, undefined, {
        alt: node.attrs.alt as string,
        url: node.attrs.src as string,
        title: node.attrs.title as string,
      }),
  },
  parseMarkdown: {
    match: (node) => node.type === 'image',
    runner: (state, node, type) => {
      state.addNode(type, {
        src: node.url ?? '',
        alt: node.alt ?? '',
        title: node.title ?? '',
      });
    },
  },
};

export const hrSchema: NodeSchema = {
  group: 'block',
  atom: true,
  toMarkdown: {
    match: (node) => node.type.name === 'hr',
    runner: (state) => state.addNode('thematicBreak'),
  },
  parseMarkdown: {
    match: (node) => node.type === 'thematicBreak',
    runner: (state, _node, type) => state.addNode(type),
  },
};

export const hardBreakSchema: NodeSchema = {
  group: 'inline',
  inline: true,
  atom: true,
  toMarkdown: {
    match: (node) => node.type.name === 'hardBreak',
    runner: (state) => state.addNode('break'),
  },
  parseMarkdown: {
    match: (node) => node.type === 'break',
    runner: (state, _node, type) => state.addNode(type),
  },
};

export const strongMark: MarkSchema = {
  toMarkdown: {
    match: (mark) => mark.type.name === 'strong',
    runner: (state, mark) => {
      state.withMark(mark, 'strong');
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'strong',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
};

export const emMark: MarkSchema = {
  toMarkdown: {
    match: (mark) => mark.type.name === 'em',
    runner: (state, mark) => {
      state.withMark(mark, 'emphasis');
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'emphasis',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
};

export const codeMark: MarkSchema = {
  toMarkdown: {
    match: (mark) => mark.type.name === 'code',
    runner: (state, mark, node) => {
      state.withMark(mark, 'inlineCode', node.text ?? '');
      return true;
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'inlineCode',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.addText(String(node.value ?? ''));
      state.closeMark(markType);
    },
  },
};

export const linkMark: MarkSchema = {
  attrs: {
    href: { default: '' },
    title: { default: null },
  },
  inclusive: false,
  toMarkdown: {
    match: (mark) => mark.type.name === 'link',
    runner: (state, mark) => {
      state.withMark(mark, 'link', undefined, {
        url: mark.attrs.href as string,
        title: mark.attrs.title as string | null,
      });
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'link',
    runner: (state, node, markType) => {
      state.openMark(markType, { href: node.url ?? '', title: node.title ?? null });
      state.next(node.children);
      state.closeMark(markType);
    },
  },
};

export const strikeMark: MarkSchema = {
  toMarkdown: {
    match: (mark) => mark.type.name === 'strike',
    runner: (state, mark) => {
      state.withMark(mark, 'delete');
    },
  },
  parseMarkdown: {
    match: (node) => node.type === 'delete',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
};