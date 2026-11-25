// @vitest-environment jsdom
/**
 * Touch behaviour of the editor byline: a touch tap on an author opens
 * the author sheet with that author's details (instead of the author
 * form) and keeps the hover/focus tooltip suppressed; the sheet's Edit
 * action closes it and opens the author form for the tapped index.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Byline } from './Byline';
import { buildByline } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Author with details rendered by the sheet. */
const AUTHOR: MetadataAuthor = {
  id: 'smith',
  name: { given: 'Alice', family: 'Smith' },
  email: 'alice@example.edu',
  affiliations: [{ ref: 'ui' }],
};

/** Affiliation registry used by the fixture. */
const AFFILIATIONS = [{ id: 'ui', name: 'University of Indonesia' }];

/** Render the byline of one detailed author and return the open spy. */
function renderByline(): ReturnType<typeof vi.fn> {
  const onOpenName = vi.fn();
  render(
    <Byline
      model={buildByline([AUTHOR], AFFILIATIONS)}
      authors={[AUTHOR]}
      setAuthors={() => {}}
      onOpenName={onOpenName}
    />,
  );
  return onOpenName;
}

/** Dispatch a pointerdown carrying a pointerType, which jsdom events lack by default. */
function pointerDown(element: HTMLElement, pointerType: string): void {
  const event = new Event('pointerdown', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(element, event);
}

/** Simulate a touch tap: pointerdown with pointerType touch, then click. */
function touchTap(element: HTMLElement): void {
  pointerDown(element, 'touch');
  fireEvent.focus(element);
  fireEvent.mouseEnter(element);
  fireEvent.click(element);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Byline touch tap', () => {
  it('opens the author sheet without calling onOpenName or showing the tooltip', () => {
    const onOpenName = renderByline();

    touchTap(screen.getByTestId('byline-author-0'));

    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    expect(screen.getByTestId('author-details-email').textContent).toBe('alice@example.edu');
    expect(onOpenName).not.toHaveBeenCalled();
    expect(screen.queryByTestId('byline-tooltip')).toBeNull();
  });

  it('closes the sheet and opens the author form from the Edit action', () => {
    const onOpenName = renderByline();

    touchTap(screen.getByTestId('byline-author-0'));
    fireEvent.click(screen.getByTestId('bottom-sheet-action'));

    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    expect(onOpenName).toHaveBeenCalledTimes(1);
    expect(onOpenName).toHaveBeenCalledWith(0);
  });

  it('still opens the author form for a mouse click', () => {
    const onOpenName = renderByline();

    fireEvent.pointerDown(screen.getByTestId('byline-author-0'), { pointerType: 'mouse' });
    fireEvent.click(screen.getByTestId('byline-author-0'));

    expect(onOpenName).toHaveBeenCalledWith(0);
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });
});
