// @vitest-environment jsdom
/**
 * ReaderDetailsPanel tests: the panel lists the published repository, shows
 * the current manuscript read-only, and switches manuscripts through the
 * shared picker.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ReaderDetailsPanel } from './ReaderDetailsPanel';

const REPO = 'konsulin-care/citizen-science';

const MANUSCRIPTS = [
  { id: 'alpha', title: 'Alpha study' },
  { id: 'beta', title: 'Beta study' },
];

/** Render the panel with spies and a selected manuscript. */
function renderPanel(overrides: Partial<Parameters<typeof ReaderDetailsPanel>[0]> = {}) {
  const onSelect = vi.fn();
  const onSelectAll = vi.fn();
  const onClose = vi.fn();
  render(
    <ReaderDetailsPanel
      id="reader-details"
      repo={REPO}
      manuscripts={MANUSCRIPTS}
      selectedId="alpha"
      onSelect={onSelect}
      onSelectAll={onSelectAll}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSelect, onSelectAll, onClose };
}

describe('ReaderDetailsPanel repository row', () => {
  it('links the published repository in a new tab', () => {
    renderPanel();

    const link = screen.getByRole('link', { name: new RegExp(REPO) });
    expect(link).toHaveAttribute('href', `https://github.com/${REPO}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('ReaderDetailsPanel manuscript row', () => {
  it('shows the current manuscript read-only and opens the picker', () => {
    renderPanel();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Alpha study')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Choose manuscript' }));
    expect(screen.getByRole('dialog', { name: 'Select manuscript' })).toBeDefined();
  });

  it('selects a manuscript from the picker and closes it', async () => {
    const { onSelect } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Choose manuscript' }));
    fireEvent.click(screen.getByRole('button', { name: /Beta study/ }));

    expect(onSelect).toHaveBeenCalledWith('beta');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Select manuscript' })).toBeNull(),
    );
  });
});
