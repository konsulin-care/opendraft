import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import type { EditorView } from '@milkdown/kit/prose/view';
import { CrossrefTooltip } from './crossref-tooltip';
import {
  handleMouseOver,
  handleMouseOut,
  hideTooltip,
} from './citekey-interactions';

const computePositionMock = vi
  .fn()
  .mockResolvedValue({ x: 120, y: 200, placement: 'bottom' });

vi.mock('@floating-ui/dom', () => ({
  computePosition: (...args: unknown[]) => computePositionMock(...args),
  flip: vi.fn().mockReturnValue('flip-middleware'),
  shift: vi.fn().mockReturnValue('shift-middleware'),
  offset: vi.fn().mockReturnValue('offset-middleware'),
}));

/** Create and attach a mock anchor element. */
function createMockAnchor() {
  const anchor = document.createElement('span');
  anchor.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 100,
    left: 100,
    width: 50,
    height: 20,
    bottom: 120,
    right: 150,
  });
  document.body.appendChild(anchor);
  return anchor;
}

beforeEach(() => {
  computePositionMock.mockClear();
  computePositionMock.mockResolvedValue({ x: 120, y: 200, placement: 'bottom' });
});

afterEach(() => {
  cleanup();
  hideTooltip();
  document.body.innerHTML = '';
});

describe('CrossrefTooltip — rendering', () => {
  it('renders the kind name, id and caption for a known label', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(
        <CrossrefTooltip
          id="fig-cat"
          kind="fig"
          caption="A cat"
          anchorEl={anchor}
        />,
      );
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Figure');
    expect(tooltip.textContent).toContain('fig-cat');
    expect(tooltip.textContent).toContain('A cat');
  });

  it('renders the unknown message for a broken label', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(
        <CrossrefTooltip
          id="fig-nope"
          kind="fig"
          broken
          anchorEl={anchor}
        />,
      );
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe('Unknown cross-reference: fig-nope');
  });
});

describe('CrossrefTooltip — known label hover', () => {
  it('mounts a tooltip containing the caption for a .crossref-link target', async () => {
    const target = document.createElement('span');
    target.className = 'crossref-link';
    target.setAttribute('data-crossref', 'fig-cat');
    target.setAttribute('data-crossref-kind', 'fig');
    target.setAttribute('data-crossref-caption', 'A cat');
    document.body.appendChild(target);

    const view = {} as EditorView;
    await act(async () => {
      handleMouseOver(view, { target } as unknown as MouseEvent);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('A cat');
    });
    const tooltip = document.body.querySelector('.crossref-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain('fig-cat');
  });
});

describe('CrossrefTooltip — broken label and hide', () => {
  it('mounts a broken-label tooltip for a .crossref-broken target', async () => {
    const target = document.createElement('span');
    target.className = 'crossref-broken';
    target.setAttribute('data-crossref', 'fig-nope');
    document.body.appendChild(target);

    const view = {} as EditorView;
    await act(async () => {
      handleMouseOver(view, { target } as unknown as MouseEvent);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain(
        'Unknown cross-reference: fig-nope',
      );
    });
  });

  it('hides the tooltip on mouseout', async () => {
    const target = document.createElement('span');
    target.className = 'crossref-link';
    target.setAttribute('data-crossref', 'fig-cat');
    target.setAttribute('data-crossref-kind', 'fig');
    target.setAttribute('data-crossref-caption', 'A cat');
    document.body.appendChild(target);

    const view = {} as EditorView;
    await act(async () => {
      handleMouseOver(view, { target } as unknown as MouseEvent);
    });
    await waitFor(() => {
      expect(document.body.querySelector('.crossref-tooltip')).not.toBeNull();
    });

    await act(async () => {
      handleMouseOut(view, { target } as unknown as MouseEvent);
    });
    expect(document.body.querySelector('.crossref-tooltip')).toBeNull();
  });
});
