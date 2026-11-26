// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AppHeader } from './AppHeader';
import type { AppHeaderProps } from './AppHeader';
import type { ProjectSource } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { APP_BAR_HEIGHT } from './app-bar-layout';

const LOCAL_SOURCE: ProjectSource = { kind: 'local' };

const FORK_SOURCE: ProjectSource = {
  kind: 'github',
  owner: 'octocat',
  repo: 'paper',
  branch: 'od-octocat/intro',
  upstream: { owner: 'upstream', repo: 'paper', defaultBranch: 'main' },
  private: false,
  pushed: false,
  syncedSha: 'abc123',
  digest: {},
  pullNumber: null,
};

const SESSION: BffSession = {
  login: 'octocat',
  id: 583231,
  name: 'The Octocat',
  expiresAt: '2099-01-01T00:00:00Z',
};

const MANUSCRIPTS = [
  { id: 'intro', title: 'Intro' },
  { id: 'methods', title: 'Methods' },
];

const BASE_PROPS: AppHeaderProps = {
  manuscriptDir: 'intro',
  source: LOCAL_SOURCE,
  saveStatus: 'saved',
  sidebarOpen: false,
  onToggleSidebar: vi.fn(),
};

/**
 * Render the header with optional prop overrides.
 *
 * @param overrides - Props to replace on top of {@link BASE_PROPS}.
 */
function renderHeader(overrides: Partial<AppHeaderProps> = {}) {
  return render(<AppHeader {...BASE_PROPS} {...overrides} />);
}

/**
 * Render the header with a removed legacy prop still attached at runtime.
 *
 * @param legacy - Props the header no longer declares.
 */
function renderLegacyHeader(legacy: Record<string, unknown>) {
  const props = { ...BASE_PROPS, ...legacy } as unknown as AppHeaderProps;
  return render(<AppHeader {...props} />);
}

/**
 * Read whether an element or an ancestor up to the title column has a class.
 *
 * @param element - Element to start from.
 * @param className - Class looking for.
 */
function hasAncestorClass(element: Element | null, className: string): boolean {
  let node: Element | null = element;
  while (node instanceof HTMLElement) {
    if (node.className.split(/\s+/).includes(className)) return true;
    if (node.dataset.testid === 'header-title-column') return false;
    node = node.parentElement;
  }
  return false;
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

describe('AppHeader title and subtitle', () => {
  it('opens the details panel and renames the manuscript title', () => {
    const onRenameManuscript = vi.fn();
    renderHeader({ manuscriptName: 'My Thesis', onRenameManuscript });
    fireEvent.click(screen.getByRole('button', { name: 'My Thesis' }));
    const panel = screen.getByRole('region', { name: 'Manuscript details' });
    const title = within(panel).getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('My Thesis');
    fireEvent.change(title, { target: { value: 'My Thesis edited' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onRenameManuscript).toHaveBeenCalledWith('My Thesis edited');
  });
  it('falls back to the manuscript dir name when no display name is set', () => {
    renderHeader({ manuscriptDir: 'my-thesis' });
    fireEvent.click(screen.getByRole('button', { name: 'my-thesis' }));
    const title = screen.getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('my-thesis');
  });
  it('hides the repo subtitle below md while the panel is closed', () => {
    renderHeader({ source: LOCAL_SOURCE });
    const subtitle = screen.getByText('Only on this device').parentElement;
    expect(subtitle?.className.split(/\s+/)).toContain('hidden');
    expect(subtitle?.className.split(/\s+/)).toContain('md:block');
  });
  it('keeps the repo subtitle and drops the legacy project-name field', () => {
    renderHeader({ source: LOCAL_SOURCE });
    const header = screen.getByTestId('app-header');
    expect(within(header).getByText('Only on this device')).toBeDefined();
    expect(within(header).queryByTestId('project-name')).toBeNull();
    expect(within(header).queryByRole('textbox', { name: 'Project name' })).toBeNull();
    expect(within(header).queryByRole('button', { name: 'More actions' })).toBeNull();
    expect(within(header).getByRole('status').textContent).toBe('Saved');
  });
});

describe('AppHeader desktop title', () => {
  it('renders the details trigger on mobile and an inline name field from md up', () => {
    renderHeader({ manuscriptName: 'My Thesis' });
    const header = screen.getByTestId('app-header');
    const inline = within(header).getByTestId('manuscript-title-inline') as HTMLInputElement;
    expect(inline.value).toBe('My Thesis');
    expect(inline.getAttribute('aria-label')).toBe('Manuscript name');
    expect(hasAncestorClass(inline, 'hidden')).toBe(true);
    expect(hasAncestorClass(inline, 'md:flex')).toBe(true);
    const trigger = within(header).getByRole('button', { name: 'My Thesis' });
    expect(hasAncestorClass(trigger, 'md:hidden')).toBe(true);
    expect(hasAncestorClass(trigger, 'md:flex')).toBe(false);
  });
  it('renames the manuscript from the desktop inline field', () => {
    const onRenameManuscript = vi.fn();
    renderHeader({ manuscriptName: 'My Thesis', onRenameManuscript });
    const inline = screen.getByTestId('manuscript-title-inline') as HTMLInputElement;
    fireEvent.change(inline, { target: { value: 'My Thesis edited' } });
    fireEvent.keyDown(inline, { key: 'Enter' });
    expect(onRenameManuscript).toHaveBeenCalledWith('My Thesis edited');
  });
  it('offers the switcher from md up and reports the chosen manuscript', () => {
    const onSelectManuscript = vi.fn();
    renderHeader({ manuscripts: MANUSCRIPTS, manuscriptId: 'intro', onSelectManuscript });
    const switcher = screen.getByRole('button', { name: 'Switch manuscript' });
    expect(hasAncestorClass(switcher, 'md:flex')).toBe(true);
    fireEvent.click(switcher);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Methods' }));
    expect(onSelectManuscript).toHaveBeenCalledWith('methods');
  });
});

describe('AppHeader fork subtitle', () => {
  it('describes forks with their upstream repository', () => {
    renderHeader({ source: FORK_SOURCE });
    expect(screen.getByText('Forked from')).toBeDefined();
    const link = screen.getByRole('link', { name: /upstream\/paper/ });
    expect(link.getAttribute('href')).toBe('https://github.com/upstream/paper');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('AppHeader details panel disclosure', () => {
  it('closes the panel on Escape and returns focus to the title trigger', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: 'intro' });
    fireEvent.click(trigger);
    expect(screen.getByRole('region', { name: 'Manuscript details' })).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Manuscript details' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the panel on an outside press and returns focus to the trigger', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: 'intro' });
    fireEvent.click(trigger);
    expect(screen.getByRole('region', { name: 'Manuscript details' })).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('region', { name: 'Manuscript details' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the panel when the scrim is pressed', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: 'intro' });
    fireEvent.click(trigger);
    expect(screen.getByRole('region', { name: 'Manuscript details' })).toBeDefined();
    fireEvent.click(screen.getByTestId('surface-scrim'));
    expect(screen.queryByRole('region', { name: 'Manuscript details' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the panel when the project drawer opens', () => {
    const { rerender } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'intro' }));
    expect(screen.getByRole('region', { name: 'Manuscript details' })).toBeDefined();
    rerender(<AppHeader {...BASE_PROPS} sidebarOpen />);
    expect(screen.queryByRole('region', { name: 'Manuscript details' })).toBeNull();
    expect(screen.getByRole('button', { name: 'intro' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});

describe('AppHeader manuscript picker', () => {
  it('opens the picker from the details panel and picks a manuscript', () => {
    const onSelectManuscript = vi.fn();
    renderHeader({ manuscripts: MANUSCRIPTS, manuscriptId: 'intro', onSelectManuscript });
    fireEvent.click(screen.getByRole('button', { name: 'intro' }));
    const panel = screen.getByRole('region', { name: 'Manuscript details' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Switch manuscript' }));
    expect(screen.queryByRole('region', { name: 'Manuscript details' })).toBeNull();
    const picker = screen.getByRole('dialog', { name: 'Select manuscript' });
    expect(within(picker).getByText('Methods')).toBeDefined();
    fireEvent.click(within(picker).getByRole('button', { name: /^Methods/ }));
    expect(onSelectManuscript).toHaveBeenCalledWith('methods');
    expect(screen.queryByRole('dialog', { name: 'Select manuscript' })).toBeNull();
  });

  it('reopens the details panel when the picker is closed without a pick', () => {
    renderHeader({ manuscripts: MANUSCRIPTS, manuscriptId: 'intro', onSelectManuscript: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'intro' }));
    const panel = screen.getByRole('region', { name: 'Manuscript details' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Switch manuscript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close manuscript picker' }));
    const reopened = screen.getByRole('region', { name: 'Manuscript details' });
    expect(document.activeElement).toBe(
      within(reopened).getByRole('button', { name: 'Switch manuscript' }),
    );
  });
});

describe('AppHeader legacy project rename', () => {
  it('ignores the removed legacy project-name props and renames the manuscript title', () => {
    const onRename = vi.fn();
    const onRenameManuscript = vi.fn();
    renderLegacyHeader({ projectName: 'Legacy Paper', onRename, onRenameManuscript });
    expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull();
    expect(screen.getByText('Only on this device')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'intro' }));
    const title = screen.getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('intro');
    fireEvent.change(title, { target: { value: 'Intro v2' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onRenameManuscript).toHaveBeenCalledWith('Intro v2');
    expect(onRename).not.toHaveBeenCalled();
  });
});

describe('AppHeader layout', () => {
  it('carries the APP_BAR_HEIGHT class on the shared header shell', () => {
    renderHeader();
    const header = screen.getByTestId('header-shell');
    for (const cls of APP_BAR_HEIGHT.split(/\s+/)) {
      expect(header.className.split(/\s+/)).toContain(cls);
    }
  });
  it('shows the drawer toggle as the leading control', () => {
    renderHeader();
    const toggle = screen.getByRole('button', { name: 'OpenDraft' });
    expect(toggle.getAttribute('title')).toBe('OpenDraft');
    expect(toggle.querySelector('.lucide-book-open-text')).not.toBeNull();
    expect(screen.queryByText('OpenDraft')).toBeNull();
  });
});

describe('AppHeader action slot and account', () => {
  it('renders the action slot and the signed-in user avatar', () => {
    renderHeader({ action: <button type="button">Edit</button>, session: SESSION });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    const avatar = screen.getByRole('img', { name: '@octocat' });
    expect(avatar.getAttribute('src')).toBe('https://avatars.githubusercontent.com/u/583231?s=64');
  });

  it('renders no Commit button', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull();
    expect(screen.queryByText('Commit')).toBeNull();
  });
  it('hides the account menu when login is disabled', () => {
    renderHeader({ loginEnabled: false });
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
  });
});
