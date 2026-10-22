// @vitest-environment jsdom
/**
 * Byline tests: the add-author CTA is a pulsing black button when the
 * manuscript has no authors and reverts to the muted default style once
 * at least one author exists; name chips open the author form on click
 * and reorder authors on press-and-hold drop without a drag handle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Byline } from './Byline';
import { buildByline } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** One person author for the non-empty fixture. */
const ONE_AUTHOR: MetadataAuthor[] = [
  { id: 'smith', name: { given: 'Alice', family: 'Smith' } },
];

/** Two person authors with distinct affiliations for the drag fixture. */
const TWO_AUTHORS: MetadataAuthor[] = [
  { id: 'smith', name: { given: 'Alice', family: 'Smith' } },
  { id: 'doe', name: { given: 'Jane', family: 'Doe' } },
];

/** Render the byline for two authors with drag/open spies. */
function renderTwo(onOpenName = vi.fn(), setAuthors = vi.fn()): {
  onOpenName: ReturnType<typeof vi.fn>;
  setAuthors: ReturnType<typeof vi.fn>;
} {
  render(
    <Byline
      model={buildByline(TWO_AUTHORS, [])}
      authors={TWO_AUTHORS}
      setAuthors={setAuthors}
      onOpenName={onOpenName}
    />,
  );
  return { onOpenName, setAuthors };
}

describe('Byline press-to-drag', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('opens the author form for the clicked chip', () => {
    const { onOpenName } = renderTwo();
    fireEvent.click(screen.getByTestId('byline-author-1'));
    expect(onOpenName).toHaveBeenCalledTimes(1);
    expect(onOpenName).toHaveBeenCalledWith(1);
  });

  it('swaps the two authors on press-hold-drop without opening the dialog', () => {
    const { onOpenName, setAuthors } = renderTwo();
    fireEvent.pointerDown(screen.getByTestId('byline-author-0'));
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.pointerUp(screen.getByTestId('byline-author-1'));
    expect(setAuthors).toHaveBeenCalledTimes(1);
    expect(setAuthors).toHaveBeenCalledWith([TWO_AUTHORS[1], TWO_AUTHORS[0]]);
    expect(onOpenName).not.toHaveBeenCalled();
  });

  it('renders no drag handle', () => {
    renderTwo();
    expect(screen.queryByTestId('drag-handle')).toBeNull();
    expect(document.querySelector('[data-drag-handle]')).toBeNull();
  });
});

describe('Byline add-author CTA', () => {
  it('is a pulsing black CTA when there are no authors', () => {
    render(<Byline model={buildByline([], [])} authors={[]} setAuthors={() => {}} onOpenName={() => {}} />);
    const button = screen.getByTestId('add-author');
    expect(button.className).toContain('bg-black');
    expect(button.className).toContain('text-white');
    expect(button.className).toContain('animate-pulse');
  });

  it('uses the muted default style once an author exists', () => {
    render(<Byline model={buildByline(ONE_AUTHOR, [])} authors={ONE_AUTHOR} setAuthors={() => {}} onOpenName={() => {}} />);
    const button = screen.getByTestId('add-author');
    expect(button.className).not.toContain('bg-black');
    expect(button.className).not.toContain('text-white');
    expect(button.className).not.toContain('animate-pulse');
    expect(button.className).toContain('text-muted');
  });

  it('opens the draft author form when clicked', () => {
    const onOpenName = vi.fn();
    render(<Byline model={buildByline([], [])} authors={[]} setAuthors={() => {}} onOpenName={onOpenName} />);
    fireEvent.click(screen.getByTestId('add-author'));
    expect(onOpenName).toHaveBeenCalledWith(-1);
  });
});
