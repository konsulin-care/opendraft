import katex from 'katex';
import type { ReactNode } from 'react';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/** Minimal mdast node shape walked by the inline markdown renderer. */
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

/** Props for {@link InlineMarkdown}. */
export interface InlineMarkdownProps {
  /** Markdown source to render. */
  source: string;
  /** Render paragraph children inside one span instead of paragraph blocks. */
  inline?: boolean;
}

/** Kind of a chunk produced when splitting Pandoc inline markup out of text. */
type PandocTextKind = 'text' | 'del' | 'sup' | 'sub';

/** One chunk of text after splitting Pandoc inline markup. */
interface PandocTextChunk {
  kind: PandocTextKind;
  value: string;
}

/** Matches `~~strike~~`, `^sup^` and `~sub~`, delimiters longest first. */
const PANDOC_INLINE = /(~~[^~]+~~|\^[^^]+\^|~[^~]+~)/g;

const processor = unified().use(remarkParse).use(remarkMath);

/**
 * Split a markdown text node into plain text and Pandoc strike, superscript
 * and subscript chunks. Delimiters are dropped and the inner text kept.
 *
 * @param text - Raw mdast text value.
 * @returns Ordered chunks, or a single text chunk when nothing matched.
 */
function splitPandocMarkup(text: string): PandocTextChunk[] {
  const chunks: PandocTextChunk[] = [];
  let last = 0;

  for (const match of text.matchAll(PANDOC_INLINE)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > last) {
      chunks.push({ kind: 'text', value: text.slice(last, index) });
    }

    if (token.startsWith('~~')) {
      chunks.push({ kind: 'del', value: token.slice(2, -2) });
    } else if (token.startsWith('^')) {
      chunks.push({ kind: 'sup', value: token.slice(1, -1) });
    } else {
      chunks.push({ kind: 'sub', value: token.slice(1, -1) });
    }
    last = index + token.length;
  }

  if (last < text.length) {
    chunks.push({ kind: 'text', value: text.slice(last) });
  }

  return chunks.length > 0 ? chunks : [{ kind: 'text', value: text }];
}

/**
 * Render a text node, lifting Pandoc strike, sup and sub markup into elements.
 *
 * @param value - Raw text value.
 * @param key - Key prefix for the produced children.
 * @returns React children for the text node.
 */
function renderText(value: string, key: string): ReactNode[] {
  return splitPandocMarkup(value).flatMap<ReactNode>((chunk, index) => {
    const chunkKey = `${key}-${index}`;
    switch (chunk.kind) {
      case 'del':
        return [<del key={chunkKey}>{chunk.value}</del>];
      case 'sup':
        return [<sup key={chunkKey}>{chunk.value}</sup>];
      case 'sub':
        return [<sub key={chunkKey}>{chunk.value}</sub>];
      default:
        return [chunk.value];
    }
  });
}

/**
 * Render a math node through KaTeX. KaTeX output is trusted and is the only
 * innerHTML used by this component.
 *
 * @param node - Math mdast node.
 * @param key - Key for the produced child.
 * @returns React children holding the rendered katex span.
 */
function renderMath(node: MdNode, key: string): ReactNode[] {
  return [
    <span
      key={key}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(node.value ?? '', { throwOnError: false }),
      }}
    />,
  ];
}

/**
 * Render an inline formatting node, or return null when the node type is not
 * one of the simple inline wrappers.
 *
 * @param node - Node to render.
 * @param key - Key for the produced child.
 * @returns React children for the node, or null when unsupported.
 */
function renderInlineElement(node: MdNode, key: string): ReactNode[] | null {
  switch (node.type) {
    case 'strong':
      return [<strong key={key}>{renderChildren(node.children, key)}</strong>];
    case 'emphasis':
      return [<em key={key}>{renderChildren(node.children, key)}</em>];
    case 'inlineCode':
      return [<code key={key}>{node.value ?? ''}</code>];
    case 'link':
      return [
        <a key={key} href={node.url ?? ''} target="_blank" rel="noopener noreferrer">
          {renderChildren(node.children, key)}
        </a>,
      ];
    case 'break':
      return [<br key={key} />];
    default:
      return null;
  }
}

/**
 * Render a list of mdast nodes to React children.
 *
 * @param nodes - Child nodes to render.
 * @param key - Key prefix for the produced children.
 * @returns React children in source order.
 */
function renderChildren(nodes: MdNode[] | undefined, key: string): ReactNode[] {
  return (nodes ?? []).flatMap((node, index) => renderNode(node, `${key}-${index}`));
}

/**
 * Render a single mdast node to React children. Unknown nodes fall back to
 * their children or their literal text value.
 *
 * @param node - Node to render.
 * @param key - Key for the produced child.
 * @returns React children for the node.
 */
function renderNode(node: MdNode, key: string): ReactNode[] {
  const element = renderInlineElement(node, key);
  if (element) {
    return element;
  }

  switch (node.type) {
    case 'paragraph':
      return [<p key={key}>{renderChildren(node.children, key)}</p>];
    case 'text':
      return renderText(node.value ?? '', key);
    case 'html':
      return [node.value ?? ''];
    case 'inlineMath':
    case 'math':
      return renderMath(node, key);
    default:
      if (node.children) {
        return renderChildren(node.children, key);
      }
      return node.value ? [node.value] : [];
  }
}

/**
 * Render a markdown source as React elements without interpreting raw HTML.
 *
 * @param props - Component props; see {@link InlineMarkdownProps}.
 * @returns A span of paragraph children when inline, otherwise block nodes.
 */
export function InlineMarkdown({ source, inline = false }: InlineMarkdownProps) {
  const tree = processor.parse(source) as unknown as MdNode;
  const children = tree.children ?? [];

  if (inline) {
    const content = children.flatMap((node, index) =>
      node.type === 'paragraph'
        ? renderChildren(node.children, `inline-${index}`)
        : renderNode(node, `inline-${index}`),
    );
    return <span>{content}</span>;
  }

  return <>{renderChildren(children, 'block')}</>;
}
