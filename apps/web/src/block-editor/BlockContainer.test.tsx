// @vitest-environment jsdom
/**
 * BlockContainer tests: the header H1 in both modes, aria-expanded with an
 * inert collapsed body, the read-only code-mode heading gutter line, and
 * the absence of the `@sec-` reference copy chip in the header.
 */
import { describe, expect, it, vi } from 'vitest';
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

describe('BlockContainer collapsed body visibility', () => {
  it('hides the body after expanding then collapsing while children stay mounted', () => {
    const { rerender, props } = renderContainer({
      collapsed: true,
      children: <div data-testid="mounted-child">section body</div>,
    });
    const body = screen.getByTestId('block-body');
    expect(body).not.toBeVisible();

    rerender(<BlockContainer {...props} collapsed={false} />);
    expect(body).toBeVisible();
    const child = screen.getByTestId('mounted-child');

    rerender(<BlockContainer {...props} collapsed />);
    expect(body).not.toBeVisible();

    rerender(<BlockContainer {...props} collapsed={false} />);
    expect(body).toBeVisible();
    expect(screen.getByTestId('mounted-child')).toBe(child);
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
  it("renders no '@sec-' reference copy button in the section header", () => {
    renderContainer();

    expect(screen.queryByRole('button', { name: /Copy @sec-/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/@sec-/)).not.toBeInTheDocument();
  });
});

describe('BlockContainer title passthrough', () => {
  it('routes header title saves to onTitleSave when the prop is given', () => {
    const onTitleSave = vi.fn();
    renderContainer({ onTitleSave });

    const input = screen.getByTestId('block-title');
    expect(input).toHaveValue('Methods');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    fireEvent.change(input, { target: { value: 'Background' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onTitleSave).toHaveBeenCalledTimes(1);
    expect(onTitleSave).toHaveBeenCalledWith('Background');
  });
});
