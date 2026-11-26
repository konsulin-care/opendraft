// @vitest-environment jsdom
/**
 * HeaderFrame tests: the shared responsive contract of both app headers. The
 * compact title slot is visible below the md breakpoint, the wide title slot
 * from md up, the panel slot is md-hidden, and the panel render prop receives
 * the overlay actions so its trigger can open and dismiss it.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HeaderFrame } from './HeaderFrame';

/** Render the frame with a compact trigger, a wide slot and a panel. */
function renderFrame(): void {
  render(
    <HeaderFrame
      testId="test-header"
      leading={<span>Lead</span>}
      subtitle="Published at owner/repo"
      compact={(overlays) => (
        <button
          ref={overlays.triggerRef}
          type="button"
          aria-expanded={overlays.view !== 'closed'}
          aria-controls="test-panel"
          onClick={overlays.toggleDetails}
        >
          Alpha study
        </button>
      )}
      wide={<span>Alpha study</span>}
      action={<span>Action</span>}
      userMenu={<span>Menu</span>}
      panel={(overlays) =>
        overlays.view === 'closed' ? null : (
          <div id="test-panel" role="region" aria-label="Details">
            open
          </div>
        )
      }
    />,
  );
}

describe('HeaderFrame title variants', () => {
  it('hides the compact slot from md up and the wide slot below md', () => {
    renderFrame();

    expect(screen.getByTestId('header-compact-title')).toHaveClass('md:hidden');
    expect(screen.getByTestId('header-wide-title')).toHaveClass('hidden', 'md:flex');
    expect(screen.getByTestId('header-wide-title')).not.toHaveClass('md:hidden');
  });
});

describe('HeaderFrame panel slot', () => {
  it('wraps the panel in an md-hidden slot so the subtitle hides below md', () => {
    renderFrame();

    expect(screen.getByTestId('header-panel-slot')).toHaveClass('md:hidden');
    const subtitle = screen.getByText('Published at owner/repo');
    expect(subtitle).toHaveClass('hidden', 'md:block');
  });

  it('passes the overlay actions to the panel render prop', () => {
    renderFrame();
    const trigger = screen.getByRole('button', { name: 'Alpha study' });

    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole('region', { name: 'Details' })).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
