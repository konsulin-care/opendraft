// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InlineMarkdown } from './inline-markdown';

/**
 * Render the component and return the container element.
 *
 * @param source - Markdown source to render.
 * @param inline - Whether to render inline (no paragraph wrappers).
 * @returns The container element holding the rendered output.
 */
function renderSource(source: string, inline = false): HTMLElement {
  const { container } = render(<InlineMarkdown source={source} inline={inline} />);
  return container;
}

describe('InlineMarkdown', () => {
  it('renders bold, italic, code and links as elements', () => {
    const container = renderSource('**bold** *italic* `code` [link](https://x.org)');

    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('code')?.textContent).toBe('code');
    const link = container.querySelector('a');
    expect(link?.textContent).toBe('link');
    expect(link?.getAttribute('href')).toBe('https://x.org');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders pandoc strike, sub, sup and katex math', () => {
    const container = renderSource('~~strike~~ H~2~O x^2^ $x^2$');

    expect(container.querySelector('del')?.textContent).toBe('strike');
    expect(container.querySelector('sub')?.textContent).toBe('2');
    expect(container.querySelector('sup')?.textContent).toBe('2');
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('renders html as literal text and keeps paragraphs separate', () => {
    const container = renderSource('<b>x</b>\n\nsecond');

    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>x</b>');
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('renders paragraph children inside a single span when inline', () => {
    const container = renderSource('**bold** and `code`', true);

    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });
});
