// @vitest-environment jsdom
/**
 * BlockContainer tests: the header H1 in both modes, aria-expanded with an
 * inert collapsed body, the read-only code-mode heading gutter line, and
 * clipboard copy of the `@sec-` reference chip.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BlockContainer } from './BlockContainer';
import type { BlockContainerProps } from './BlockContainer';

/** Render the container with fixture props and spy toggle handlers. */
function renderContainer(overrides: Partial<BlockContainerProps> = {}) {
  const onToggle = vi.fn();
  const props: BlockContainerProps = {
    short: 'methods',
    title: 'Methods',
    mode: 'visual',
    collapsed: false,
    onToggle,
    wordCount: 42,
    saveStatus: 'saved',
    children: <div>section body</div>,
    ...overrides,
  };
  const view = render(<BlockContainer {...props} />);
  return { ...view, onToggle, props };
}

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('BlockContainer heading', () => {
  it('renders the section title as the H1 in the header in both visual and code mode', () => {
    const visual = renderContainer({ mode: 'visual' });
    const h1 = screen.getByRole('heading', { level: 1, name: 'Methods' });
    expect(h1.closest('header')).not.toBeNull();
    visual.unmount();

    renderContainer({ mode: 'code' });
    const codeH1 = screen.getByRole('heading', { level: 1, name: 'Methods' });
    expect(codeH1.closest('header')).not.toBeNull();
  });
});

describe('BlockContainer collapse semantics', () => {
  it('sets aria-expanded on the toggle and makes the collapsed body inert', () => {
    const { rerender, onToggle, props } = renderContainer({ collapsed: false });
    const toggle = screen.getByRole('button', { name: 'Methods section' });
    const body = screen.getByTestId('block-body');

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(body).not.toHaveAttribute('inert');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<BlockContainer {...props} collapsed />);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(body).toHaveAttribute('inert');
  });
});

describe('BlockContainer code mode heading line', () => {
  it('shows a read-only heading line above the code surface naming the exact heading written to the file', () => {
    renderContainer({
      mode: 'code',
      type: 'methods',
      children: <div data-testid="code-surface">source text</div>,
    });

    const line = screen.getByRole('note', { name: 'Read-only heading line' });
    expect(line).toHaveTextContent('# Methods {#sec-methods .deo-methods}');
    const surface = screen.getByTestId('code-surface');
    const follows = line.compareDocumentPosition(surface) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(follows).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('BlockContainer reference chip', () => {
  it("copies the '@sec-<short>' reference to the clipboard when the chip is activated", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderContainer();

    fireEvent.click(screen.getByRole('button', { name: 'Copy @sec-methods reference' }));
    expect(writeText).toHaveBeenCalledWith('@sec-methods');
  });
});
