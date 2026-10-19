import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppHeader } from './AppHeader';
import type { AppHeaderProps } from './AppHeader';
import { APP_BAR_HEIGHT } from './app-bar-layout';

// @vitest-environment jsdom

const BASE_PROPS: AppHeaderProps = {
  fileName: 'manuscript.md',
  mode: 'wysiwyg',
  onSelectMode: vi.fn(),
  saveStatus: 'saved',
  formattingToolbar: true,
  onToggleFormattingToolbar: vi.fn(),
  onCommit: vi.fn(),
  sidebarOpen: false,
  onToggleSidebar: vi.fn(),
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

  it('shows the manuscript display name over the project name', () => {
    renderHeader({ manuscriptName: 'My Thesis', projectName: 'Test Project' });
    const title = screen.getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('My Thesis');
    const subtitle = screen.getByTestId('project-name') as HTMLInputElement;
    expect(subtitle.value).toBe('Test Project');
  });

  it('falls back to the manuscript dir name when no display name is set', () => {
    renderHeader({ manuscriptDir: 'my-thesis', projectName: 'Test Project' });
    const title = screen.getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('my-thesis');
  });
});

describe('AppHeader layout', () => {
  it('keeps the title and project name in an h-9 centered column', () => {
    renderHeader({ manuscriptName: 'My Thesis', projectName: 'Test Project' });
    const block = screen.getByTestId('header-title');
    expect(block.className).toMatch(/\bh-9\b/);
    expect(block.className).toMatch(/\bitems-center\b/);
  });

  it('carries the APP_BAR_HEIGHT class on the header root', () => {
    renderHeader();
    const header = screen.getByTestId('app-header');
    for (const cls of APP_BAR_HEIGHT.split(/\s+/)) {
      expect(header.className.split(/\s+/)).toContain(cls);
    }
  });

  it('shows the project name field only when a project name is provided', () => {
    const { unmount } = renderHeader();
    expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull();
    unmount();

    renderHeader({ projectName: 'My Project' });
    const input = screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement;
    expect(input.value).toBe('My Project');
  });
});

describe('AppHeader inline project rename', () => {
  // The project-name InlineEditField is the subtitle line of the title
  // column; the save/revert behavior itself is covered by
  // InlineEditField.test.tsx.
  it('renders the project name as a plain-text input with a hover/focus SquarePen icon', () => {
    const { container } = renderHeader({ projectName: 'My Project' });
    const input = screen.getByTestId('project-name');
    expect((input as HTMLInputElement).value).toBe('My Project');
    expect(input.className).toMatch(/\bborder-0\b/);
    const pen = container.querySelector('.lucide-square-pen');
    expect(pen).not.toBeNull();
    expect(pen?.getAttribute('class')).toMatch(/opacity-0/);
    expect(pen?.getAttribute('class')).toMatch(/group-hover:opacity-100/);
    expect(pen?.getAttribute('class')).toMatch(/group-focus-within:opacity-100/);
  });

  it('calls onRenameProject with the trimmed name on Enter', () => {
    const onRenameProject = vi.fn();
    renderHeader({ projectName: 'My Project', onRenameProject });
    const input = screen.getByTestId('project-name');
    fireEvent.change(input, { target: { value: '  New Name  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameProject).toHaveBeenCalledTimes(1);
    expect(onRenameProject).toHaveBeenCalledWith('New Name');
  });

  it('calls onRenameProject with the trimmed name on blur', () => {
    const onRenameProject = vi.fn();
    renderHeader({ projectName: 'My Project', onRenameProject });
    const input = screen.getByTestId('project-name');
    fireEvent.change(input, { target: { value: 'Renamed ' } });
    fireEvent.blur(input);
    expect(onRenameProject).toHaveBeenCalledTimes(1);
    expect(onRenameProject).toHaveBeenCalledWith('Renamed');
  });
});

describe('AppHeader manuscript title rename', () => {
  it('calls onRenameManuscript with the edited title on Enter', () => {
    const onRenameManuscript = vi.fn();
    renderHeader({
      manuscriptName: 'My Thesis',
      projectName: 'Test Project',
      onRenameManuscript,
    });
    const title = screen.getByTestId('manuscript-title');
    fireEvent.change(title, { target: { value: 'My Thesis edited' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onRenameManuscript).toHaveBeenCalledTimes(1);
    expect(onRenameManuscript).toHaveBeenCalledWith('My Thesis edited');
  });
});

describe('AppHeader inline rename cancellation', () => {
  it('restores the previous name on Escape without calling onRenameProject', () => {
    const onRenameProject = vi.fn();
    renderHeader({ projectName: 'My Project', onRenameProject });
    const input = screen.getByTestId('project-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Typo' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRenameProject).not.toHaveBeenCalled();
    expect(input.value).toBe('My Project');
  });

  it('rejects an empty or whitespace-only name and restores the old name', () => {
    const onRenameProject = vi.fn();
    renderHeader({ projectName: 'My Project', onRenameProject });
    const input = screen.getByTestId('project-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameProject).not.toHaveBeenCalled();
    expect(input.value).toBe('My Project');
  });

  it('shows an inline error when the rename is rejected', async () => {
    const onRenameProject = vi.fn().mockRejectedValue(new Error('nope'));
    renderHeader({ projectName: 'My Project', onRenameProject });
    const input = screen.getByTestId('project-name');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/rename/i);
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
