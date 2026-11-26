// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useHeaderOverlays } from './use-header-overlays';

/** Props for the test harness component. */
interface HarnessProps {
  /** Whether the project drawer is open. */
  sidebarOpen?: boolean;
}

/**
 * Minimal header standing in for the real editor header.
 *
 * Renders the title trigger and a container, plus the switch manuscript
 * button only while the details view is open.
 *
 * @param props - See {@link HarnessProps}.
 * @returns The harness markup.
 */
function Harness({ sidebarOpen = false }: HarnessProps) {
  const overlays = useHeaderOverlays(sidebarOpen);

  return (
    <div ref={overlays.containerRef}>
      <button type="button" ref={overlays.triggerRef} onClick={overlays.toggleDetails}>
        Title
      </button>
      <span data-testid="view">{overlays.view}</span>
      {overlays.view !== 'closed' && (
        <div>
          <button type="button" onClick={overlays.openPicker}>
            Open picker
          </button>
          <button type="button" onClick={overlays.dismiss}>
            Close overlay
          </button>
          {overlays.view === 'picker' && (
            <button type="button" onClick={overlays.pick}>
              Pick manuscript
            </button>
          )}
        </div>
      )}
      {overlays.view === 'details' && (
        <button type="button" ref={overlays.switchRef} onClick={overlays.openPicker}>
          Switch manuscript
        </button>
      )}
    </div>
  );
}

/** Read the current overlay view from the harness. */
function currentView(): string {
  return screen.getByTestId('view').textContent ?? '';
}

/** Open the details panel, then the picker. */
function openPicker(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Title' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open picker' }));
}

describe('useHeaderOverlays dismissal', () => {
  it('returns from the picker to details on Escape and closes details on the next Escape', () => {
    render(<Harness />);
    openPicker();
    expect(currentView()).toBe('picker');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(currentView()).toBe('details');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(currentView()).toBe('closed');
  });

  it('returns from the picker to details on an outside press and closes details on the next press', () => {
    render(<Harness />);
    openPicker();
    expect(currentView()).toBe('picker');

    fireEvent.mouseDown(document.body);
    expect(currentView()).toBe('details');

    fireEvent.mouseDown(document.body);
    expect(currentView()).toBe('closed');
  });
});

describe('useHeaderOverlays focus restoration', () => {
  it('focuses the switch button when the picker returns to details', () => {
    render(<Harness />);
    openPicker();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(currentView()).toBe('details');
    expect(screen.getByRole('button', { name: 'Switch manuscript' })).toHaveFocus();
  });

  it('focuses the title trigger when the details panel is dismissed', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(currentView()).toBe('details');

    fireEvent.click(screen.getByRole('button', { name: 'Close overlay' }));

    expect(currentView()).toBe('closed');
    expect(screen.getByRole('button', { name: 'Title' })).toHaveFocus();
  });

  it('focuses the title trigger after picking a manuscript', () => {
    render(<Harness />);
    openPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Pick manuscript' }));

    expect(currentView()).toBe('closed');
    expect(screen.getByRole('button', { name: 'Title' })).toHaveFocus();
  });
});

describe('useHeaderOverlays drawer', () => {
  it('closes the details panel when the sidebar opens', () => {
    const { rerender } = render(<Harness sidebarOpen={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(currentView()).toBe('details');

    rerender(<Harness sidebarOpen />);

    expect(currentView()).toBe('closed');
  });

  it('closes the picker when the sidebar opens', () => {
    const { rerender } = render(<Harness sidebarOpen={false} />);
    openPicker();
    expect(currentView()).toBe('picker');

    rerender(<Harness sidebarOpen />);

    expect(currentView()).toBe('closed');
  });
});
