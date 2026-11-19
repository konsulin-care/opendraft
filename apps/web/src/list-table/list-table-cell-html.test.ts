// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { cellToHtml } from './list-table-cell-html';
import type { MdNode } from './list-table-parse';

/**
 * Build a text node for the renderer tests.
 *
 * @param value - Raw text content.
 * @returns A minimal mdast text node.
 */
function text(value: string): MdNode {
  return { type: 'text', value };
}

describe('cellToHtml — text escaping', () => {
  it('escapes HTML special characters in text', () => {
    const html = cellToHtml([{ type: 'paragraph', children: [text('a & b < c > d "e" \'f\'')] }]);
    expect(html).toBe('<p>a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;</p>');
  });

});

describe('cellToHtml — inline formatting', () => {
  it('renders strong, emphasis, delete, inline code and breaks', () => {
    const html = cellToHtml([
      {
        type: 'paragraph',
        children: [
          { type: 'strong', children: [text('bold')] },
          { type: 'emphasis', children: [text('em')] },
          { type: 'delete', children: [text('gone')] },
          { type: 'inlineCode', value: 'x < y' },
          { type: 'break' },
        ],
      },
    ]);
    expect(html).toBe(
      '<p><strong>bold</strong><em>em</em><del>gone</del><code>x &lt; y</code><br></p>',
    );
  });

});

describe('cellToHtml — links and code blocks', () => {
  it('renders links with an escaped href', () => {
    const html = cellToHtml([
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com/?a=1&b="2"',
            children: [text('site')],
          },
        ],
      },
    ]);
    expect(html).toBe(
      '<p><a href="https://example.com/?a=1&amp;b=&quot;2&quot;">site</a></p>',
    );
  });

  it('renders code blocks as pre and escaped code', () => {
    const html = cellToHtml([{ type: 'code', value: 'const a = 1 < 2;' }]);
    expect(html).toBe('<pre><code>const a = 1 &lt; 2;</code></pre>');
  });

  it('renders unordered and ordered lists with list items', () => {
    const html = cellToHtml([
      {
        type: 'list',
        ordered: false,
        children: [
          { type: 'listItem', children: [{ type: 'paragraph', children: [text('one')] }] },
          { type: 'listItem', children: [{ type: 'paragraph', children: [text('two')] }] },
        ],
      },
      {
        type: 'list',
        ordered: true,
        children: [
          { type: 'listItem', children: [{ type: 'paragraph', children: [text('first')] }] },
        ],
      },
    ]);
    expect(html).toBe(
      '<ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li><p>first</p></li></ol>',
    );
  });
});

describe('cellToHtml — math', () => {
  it('renders inline math as KaTeX markup', () => {
    const html = cellToHtml([
      { type: 'paragraph', children: [{ type: 'inlineMath', value: 'x^2' }] },
    ]);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-display');
  });

  it('renders display math in KaTeX display mode', () => {
    const html = cellToHtml([{ type: 'math', value: 'x^2' }]);
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
  });
});

describe('cellToHtml — fallbacks', () => {
  it('renders unknown node types as escaped plain-text content', () => {
    const html = cellToHtml([
      {
        type: 'definition',
        children: [text('A & B'), { type: 'definitionTerm', value: '<term>' }],
      },
    ]);
    expect(html).toBe('A &amp; B&lt;term&gt;');
  });
});
