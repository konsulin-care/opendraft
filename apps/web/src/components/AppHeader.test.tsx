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

describe('AppHeader mode toggle', () => {
  it('shows a FileText toggle targeting source in visual mode and switches on click', () => {
    const onSelectMode = vi.fn();
    const { container } = renderHeader({ mode: 'wysiwyg', onSelectMode });
    const toggle = screen.getByRole('button', { name: 'Switch to source' });
    expect(toggle.getAttribute('title')).toBe('Switch to source');
    expect(container.querySelector('.lucide-file-text')).not.toBeNull();
    expect(container.querySelector('.lucide-file-code')).toBeNull();

    fireEvent.click(toggle);
    expect(onSelectMode).toHaveBeenCalledWith('source');
  });

  it('shows a FileCode toggle targeting visual in source mode and switches on click', () => {
    const onSelectMode = vi.fn();
    const { container } = renderHeader({ mode: 'source', onSelectMode });
    const toggle = screen.getByRole('button', { name: 'Switch to visual' });
    expect(toggle.getAttribute('title')).toBe('Switch to visual');
    expect(container.querySelector('.lucide-file-code')).not.toBeNull();
    expect(container.querySelector('.lucide-file-text')).toBeNull();

    fireEvent.click(toggle);
    expect(onSelectMode).toHaveBeenCalledWith('wysiwyg');
  });

  it('keeps the mode toggle hidden below md', () => {
    renderHeader();
    const toggle = screen.getByRole('button', { name: 'Switch to source' });
    const wrapper = toggle.parentElement;
    expect(wrapper?.className).toMatch(/\bhidden\b/);
    expect(wrapper?.className).toMatch(/md:flex/);
  });
});

describe('AppHeader toolbar preference', () => {
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
  it('styles the header Commit button as a near-black filled button', () => {
    renderHeader();
    const commit = screen.getByRole('button', { name: 'Commit' });
    expect(commit.className).toMatch(/\bbg-gray-900\b/);
    expect(commit.className).toMatch(/\btext-white\b/);
    expect(commit.className).toMatch(/hover:bg-gray-800/);
    expect(commit.className).not.toMatch(/\btext-gray-600\b/);
    expect(commit.className).not.toMatch(/hover:bg-gray-100/);
    expect(commit.querySelector('.lucide-git-commit-horizontal')).not.toBeNull();
    expect(commit.textContent).toBe('Commit');
  });

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
