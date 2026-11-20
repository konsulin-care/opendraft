import katex from 'katex';
import type { MdNode } from './list-table-parse';

/** Renderer for a single mdast node type. */
type NodeRenderer = (node: MdNode) => string;

/** Escape a string for safe use in HTML text and attribute values. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Concatenate the raw `value`s of a node and its descendants. */
function plainText(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(plainText).join('');
}

/** Render an array of mdast nodes to concatenated HTML. */
function renderNodes(nodes: MdNode[]): string {
  return nodes.map(renderNode).join('');
}

/** Render KaTeX markup for a math node, inline or display mode. */
function renderMath(node: MdNode, displayMode: boolean): string {
  return katex.renderToString(node.value ?? '', {
    throwOnError: false,
    displayMode,
  });
}

/** Wrap a node's children in an HTML tag. */
function wrap(tag: string, node: MdNode): string {
  return `<${tag}>${renderNodes(node.children ?? [])}</${tag}>`;
}

/** Per-node-type renderers; unknown types fall through to plain text. */
const RENDERERS: Record<string, NodeRenderer> = {
  paragraph: (node) => wrap('p', node),
  text: (node) => escapeHtml(node.value ?? ''),
  strong: (node) => wrap('strong', node),
  emphasis: (node) => wrap('em', node),
  delete: (node) => wrap('del', node),
  inlineCode: (node) => `<code>${escapeHtml(node.value ?? '')}</code>`,
  code: (node) => `<pre><code>${escapeHtml(node.value ?? '')}</code></pre>`,
  link: (node) => {
    const href = typeof node.url === 'string' ? node.url : '';
    return `<a href="${escapeHtml(href)}">${renderNodes(node.children ?? [])}</a>`;
  },
  list: (node) => wrap(node.ordered === true ? 'ol' : 'ul', node),
  listItem: (node) => wrap('li', node),
  break: () => '<br>',
  inlineMath: (node) => renderMath(node, false),
  math: (node) => renderMath(node, true),
};

/** Render one mdast node to HTML. */
function renderNode(node: MdNode): string {
  const renderer = RENDERERS[node.type];
  return renderer ? renderer(node) : escapeHtml(plainText(node));
}

/**
 * Render mdast nodes from a list-table cell as HTML.
 *
 * @param nodes - Block-level mdast nodes parsed from the cell source.
 * @returns The concatenated, escaped HTML markup.
 */
export function cellToHtml(nodes: MdNode[]): string {
  return renderNodes(nodes);
}
