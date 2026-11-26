// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TitleTrigger } from './TitleTrigger';
import type { TitleTriggerProps } from './TitleTrigger';

const PANEL_ID = 'manuscript-details';

/**
 * Render the trigger with optional prop overrides.
 *
 * @param overrides - Props to replace on top of the defaults.
 * @returns The testing-library render result.
 */
function renderTrigger(overrides: Partial<TitleTriggerProps> = {}) {
  return render(
    <TitleTrigger
      title="Alpha study"
      open={false}
      panelId={PANEL_ID}
      onToggle={vi.fn()}
      saveStatus="saved"
      {...overrides}
    />,
  );
}

/** Return the trigger button by its accessible name. */
function triggerButton(name = 'Alpha study'): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(name) });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TitleTrigger disclosure', () => {
  it('shows the title and wires aria-expanded and aria-controls to the panel', () => {
    const { rerender } = renderTrigger();

    const button = triggerButton();
    expect(button).toHaveTextContent('Alpha study');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', PANEL_ID);

    rerender(
      <TitleTrigger
        title="Alpha study"
        open
        panelId={PANEL_ID}
        onToggle={vi.fn()}
        saveStatus="saved"
      />,
    );

    expect(triggerButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('falls back to "Manuscript" when no title is given', () => {
    renderTrigger({ title: undefined });

    expect(triggerButton('Manuscript')).toHaveTextContent('Manuscript');
  });

  it('calls onToggle when activated', () => {
    const onToggle = vi.fn();
    renderTrigger({ onToggle });

    fireEvent.click(triggerButton());

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('TitleTrigger attention dot', () => {
  it('shows the dot when attention is set', () => {
    renderTrigger({ attention: true });

    expect(screen.getByTestId('title-trigger-attention')).toBeInTheDocument();
  });

  it('shows the dot when the last save failed', () => {
    renderTrigger({ saveStatus: 'error' });

    expect(screen.getByTestId('title-trigger-attention')).toBeInTheDocument();
  });

  it('hides the dot otherwise', () => {
    renderTrigger({ saveStatus: 'saved', attention: false });

    expect(screen.queryByTestId('title-trigger-attention')).toBeNull();
  });
});

describe('TitleTrigger status region', () => {
  it('announces each save state', () => {
    const { rerender } = renderTrigger({ saveStatus: 'saved' });
    expect(within(screen.getByRole('status')).getByText('Saved')).toBeInTheDocument();

    rerender(
      <TitleTrigger title="Alpha study" open={false} panelId={PANEL_ID} onToggle={vi.fn()} saveStatus="saving" />,
    );
    expect(within(screen.getByRole('status')).getByText('Saving')).toBeInTheDocument();

    rerender(
      <TitleTrigger title="Alpha study" open={false} panelId={PANEL_ID} onToggle={vi.fn()} saveStatus="error" />,
    );
    expect(within(screen.getByRole('status')).getByText('Save failed')).toBeInTheDocument();
  });

  it('hides the label below md but keeps it in the accessibility tree', () => {
    renderTrigger({ saveStatus: 'saved' });

    const label = within(screen.getByRole('status')).getByText('Saved');
    expect(label.className).toMatch(/\bsr-only\b/);
    expect(label.className).toMatch(/\bmd:not-sr-only\b/);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('replaces the label with a notice for four seconds at every width', () => {
    vi.useFakeTimers();
    renderTrigger({ saveStatus: 'saved', notice: 'Draft sent' });

    const status = screen.getByRole('status');
    const notice = within(status).getByText('Draft sent');
    expect(notice.className.split(/\s+/)).toContain('max-w-[40vw]');
    expect(notice.className).toMatch(/\btruncate\b/);
    expect(notice.className).not.toMatch(/\bsr-only\b/);
    expect(within(status).queryByText('Saved')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(within(screen.getByRole('status')).getByText('Draft sent')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(within(screen.getByRole('status')).getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByText('Draft sent')).toBeNull();
  });
});

describe('TitleTrigger without a save status', () => {
  it('renders no status live region', () => {
    renderTrigger({ saveStatus: undefined });

    expect(screen.queryByRole('status')).toBeNull();
    expect(triggerButton()).toHaveAttribute('aria-expanded', 'false');
  });
});
