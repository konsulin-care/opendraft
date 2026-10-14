import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppHeader } from './AppHeader';
import type { AppHeaderProps } from './AppHeader';

// @vitest-environment jsdom

const BASE_PROPS: AppHeaderProps = {
  fileName: 'manuscript.md',
  mode: 'wysiwyg',
  onSelectMode: vi.fn(),
  saveStatus: 'saved',
  formattingToolbar: true,
  onToggleFormattingToolbar: vi.fn(),
  onCommit: vi.fn(),
};

/**
 * Render the header with optional prop overrides.
 *
 * @param overrides - Props to replace on top of {@link BASE_PROPS}.
 * @returns The testing-library render result.
 */
function renderHeader(overrides: Partial<AppHeaderProps> = {}) {
  return render(<AppHeader {...BASE_PROPS} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppHeader save status', () => {
  it('shows Saving with a live status region while a save is pending', () => {
    renderHeader({ saveStatus: 'saving' });
    expect(screen.getByRole('status').textContent).toBe('Saving');
  });

  it('shows Saved once the save resolves', () => {
    renderHeader({ saveStatus: 'saved' });
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('shows Save failed when the save rejects', () => {
    renderHeader({ saveStatus: 'error' });
    expect(screen.getByRole('status').textContent).toBe('Save failed');
  });
});

describe('AppHeader identity', () => {
  it('shows an OpenDraft icon button without visible OpenDraft text', () => {
    renderHeader();
    const logo = screen.getByRole('button', { name: 'OpenDraft' });
    expect(logo).toBeDefined();
    expect(logo.getAttribute('title')).toBe('OpenDraft');
    expect(screen.queryByText('OpenDraft')).toBeNull();
  });

  it('shows the file name with the full name in title', () => {
    renderHeader({ fileName: 'manuscript.md' });
    const label = screen.getByTitle('manuscript.md');
    expect(label.textContent).toBe('manuscript.md');
  });

  it('truncates long file names but keeps the full name in title', () => {
    const longName = 'a'.repeat(200) + '.md';
    renderHeader({ fileName: longName });
    const label = screen.getByTitle(longName);
    const codePoints = Array.from(label.textContent ?? '');
    expect(codePoints).toHaveLength(140);
    expect(codePoints[0]).toBe('…');
  });

});

describe('AppHeader mode and toolbar', () => {
  it('marks Visual as pressed in wysiwyg mode and switches to source on click', () => {
    const onSelectMode = vi.fn();
    renderHeader({ mode: 'wysiwyg', onSelectMode });
    expect(screen.getByRole('button', { name: 'Visual' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Source' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    expect(onSelectMode).toHaveBeenCalledWith('source');
  });

  it('marks Source as pressed in source mode', () => {
    renderHeader({ mode: 'source' });
    expect(screen.getByRole('button', { name: 'Source' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Visual' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('mirrors the formatting toolbar preference and toggles on click', () => {
    const onToggleFormattingToolbar = vi.fn();
    renderHeader({ formattingToolbar: true, onToggleFormattingToolbar });
    const toggle = screen.getByRole('button', { name: 'Formatting toolbar' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('title')).toBe('Hide formatting toolbar (Ctrl/Cmd+\\)');

    fireEvent.click(toggle);
    expect(onToggleFormattingToolbar).toHaveBeenCalledTimes(1);
  });

  it('shows the toolbar toggle as unpressed when the preference is off', () => {
    renderHeader({ formattingToolbar: false });
    expect(
      screen.getByRole('button', { name: 'Formatting toolbar' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

});

describe('AppHeader commit and overflow', () => {
  it('calls onCommit when the Commit button is clicked', () => {
    const onCommit = vi.fn();
    renderHeader({ onCommit });
    const commit = screen.getByRole('button', { name: 'Commit' });
    expect(commit.getAttribute('title')).toBe('Commit');
    fireEvent.click(commit);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('moves mode and commit actions into the overflow menu when open', () => {
    const onSelectMode = vi.fn();
    const onCommit = vi.fn();
    renderHeader({ onSelectMode, onCommit });
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Source' }));
    expect(onSelectMode).toHaveBeenCalledWith('source');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Commit changes' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
