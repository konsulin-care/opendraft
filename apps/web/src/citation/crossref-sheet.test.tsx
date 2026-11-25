// @vitest-environment jsdom
/**
 * CrossrefSheet tests: the sheet shows the kind, id and caption of a
 * resolved label, scrolls the matching block into view and closes on the
 * go-to action, and renders an unknown message without action for a
 * broken label.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CrossrefSheet, hideCrossrefSheet, showCrossrefSheet } from './crossref-sheet';

afterEach(() => {
  cleanup();
  hideCrossrefSheet();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('CrossrefSheet', () => {
  it('shows the kind name, id and caption of a resolved label', () => {
    render(
      <CrossrefSheet
        id="fig-cat"
        kind="fig"
        caption="A cat"
        file="chapter.qmd"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Figure' })).toBeTruthy();
    expect(screen.getByText('fig-cat')).toBeTruthy();
    expect(screen.getByText('A cat')).toBeTruthy();
  });

  it('scrolls the matching block into view and closes the sheet', () => {
    const onClose = vi.fn();
    const target = document.createElement('div');
    target.setAttribute('data-block-file', 'chapter.qmd');
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    render(
      <CrossrefSheet
        id="fig-cat"
        kind="fig"
        caption="A cat"
        file="chapter.qmd"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId('bottom-sheet-action'));
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the unknown message and no footer button for a broken label', () => {
    render(
      <CrossrefSheet id="fig-nope" kind="fig" broken onClose={vi.fn()} />,
    );
    expect(screen.getByText('Unknown cross-reference: fig-nope')).toBeTruthy();
    expect(screen.queryByTestId('bottom-sheet-action')).toBeNull();
  });
});

describe('showCrossrefSheet / hideCrossrefSheet', () => {
  it('mounts the sheet into the body and unmounts it on hide', () => {
    act(() => {
      showCrossrefSheet({ id: 'fig-cat', kind: 'fig', caption: 'A cat' });
    });
    expect(screen.getByRole('heading', { name: 'Figure' })).toBeTruthy();
    expect(document.querySelector('.crossref-sheet-container')).not.toBeNull();

    act(() => {
      hideCrossrefSheet();
    });
    expect(document.querySelector('.crossref-sheet-container')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Figure' })).toBeNull();
  });
});
