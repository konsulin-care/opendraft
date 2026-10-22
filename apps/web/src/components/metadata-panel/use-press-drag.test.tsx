// @vitest-environment jsdom
/**
 * usePressDrag tests: a press shorter than the hold threshold behaves
 * like a plain click; holding for the threshold enters drag mode and
 * releasing over another chip reorders; releasing over the held chip
 * itself does not reorder; the click that follows a completed drag is
 * suppressed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { usePressDrag } from './use-press-drag';

/** Spy invoked by the harness when a click passes the filter. */
type Activate = (index: number) => void;

/** Minimal harness: two press-index chips inside one delegated row. */
function Harness(
  { onReorder, onActivate }: {
    onReorder: (from: number, to: number) => void;
    onActivate: Activate;
  },
): ReactNode {
  const drag = usePressDrag({ onReorder });
  return (
    <div
      data-testid="row"
      onPointerDown={drag.onPointerDown}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
    >
      {[0, 1].map((index) => (
        <button
          key={index}
          type="button"
          data-testid={`chip-${index}`}
          data-press-index={index}
          data-dragging={drag.dragging === index || undefined}
          onClick={() => {
            if (drag.filterClick()) onActivate(index);
          }}
        >
          chip {index}
        </button>
      ))}
    </div>
  );
}

/** Render the harness with spies. */
function renderHarness(): {
  onReorder: ReturnType<typeof vi.fn>;
  onActivate: ReturnType<typeof vi.fn>;
} {
  const onReorder = vi.fn();
  const onActivate = vi.fn();
  render(<Harness onReorder={onReorder} onActivate={onActivate} />);
  return { onReorder, onActivate };
}

/** Press chip `from`, hold for the threshold, then release over chip `to`. */
function holdDrop(from: number, to: number): void {
  fireEvent.pointerDown(screen.getByTestId(`chip-${from}`));
  act(() => { vi.advanceTimersByTime(300); });
  fireEvent.pointerUp(screen.getByTestId(`chip-${to}`));
}

describe('usePressDrag', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('treats a press shorter than the hold threshold as a plain click', () => {
    const { onReorder, onActivate } = renderHarness();
    fireEvent.pointerDown(screen.getByTestId('chip-0'));
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(screen.getByTestId('chip-0'));
    fireEvent.click(screen.getByTestId('chip-0'));
    expect(onActivate).toHaveBeenCalledWith(0);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('enters drag mode after the hold threshold and reorders on drop', () => {
    const { onReorder } = renderHarness();
    fireEvent.pointerDown(screen.getByTestId('chip-0'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByTestId('chip-0').hasAttribute('data-dragging')).toBe(true);
    fireEvent.pointerUp(screen.getByTestId('chip-1'));
    expect(onReorder).toHaveBeenCalledWith(0, 1);
    expect(screen.getByTestId('chip-0').hasAttribute('data-dragging')).toBe(false);
  });

  it('suppresses the click that follows a completed drag', () => {
    const { onActivate } = renderHarness();
    holdDrop(0, 1);
    fireEvent.click(screen.getByTestId('chip-1'));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does not reorder when a held press is released over its own chip', () => {
    const { onReorder, onActivate } = renderHarness();
    holdDrop(0, 0);
    expect(onReorder).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('aborts a pending press on pointercancel', () => {
    const { onReorder } = renderHarness();
    fireEvent.pointerDown(screen.getByTestId('chip-0'));
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.pointerCancel(screen.getByTestId('row'));
    expect(screen.getByTestId('chip-0').hasAttribute('data-dragging')).toBe(false);
    fireEvent.pointerUp(screen.getByTestId('chip-1'));
    expect(onReorder).not.toHaveBeenCalled();
  });
});
