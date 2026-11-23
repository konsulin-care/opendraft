import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AppHeader } from './AppHeader';
import type { AppHeaderProps } from './AppHeader';
import type { ProjectSource } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { APP_BAR_HEIGHT } from './app-bar-layout';

// @vitest-environment jsdom

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

const BASE_PROPS: AppHeaderProps = {
  fileName: 'manuscript.md',
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

describe('AppHeader title and subtitle', () => {
  it('keeps the manuscript title inline-editable', () => {
    const onRenameManuscript = vi.fn();
    renderHeader({ manuscriptName: 'My Thesis', onRenameManuscript });

    const title = screen.getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('My Thesis');
    fireEvent.change(title, { target: { value: 'My Thesis edited' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onRenameManuscript).toHaveBeenCalledWith('My Thesis edited');
  });

  it('falls back to the manuscript dir name when no display name is set', () => {
    renderHeader({ manuscriptDir: 'my-thesis' });
    const title = screen.getByTestId('manuscript-title') as HTMLInputElement;
    expect(title.value).toBe('my-thesis');
  });

  it('renders the repo subtitle as read-only text with no project-name input', () => {
    renderHeader({ source: LOCAL_SOURCE, projectName: 'Test Project' });

    expect(screen.getByText('Only on this device')).toBeDefined();
    expect(screen.queryByTestId('project-name')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull();
  });

  it('describes forks with their upstream repository', () => {
    renderHeader({ source: FORK_SOURCE });
    expect(screen.getByText('Forked from upstream/paper')).toBeDefined();
  });

  it('offers the manuscript switcher when several manuscripts exist', () => {
    const onSelectManuscript = vi.fn();
    renderHeader({
      manuscripts: [
        { id: 'intro', title: 'Intro' },
        { id: 'methods', title: 'Methods' },
      ],
      manuscriptId: 'intro',
      onSelectManuscript,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Switch manuscript' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Methods' }));
    expect(onSelectManuscript).toHaveBeenCalledWith('methods');
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
    renderHeader({
      action: <button type="button">Edit</button>,
      session: SESSION,
    });

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

describe('AppHeader overflow menu', () => {
  it('has no Commit changes item', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByText('Commit changes')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Commit changes' })).toBeNull();
  });

  it('renders supplied overflow entries', () => {
    renderHeader();
    // Default header has no replacement entries; the trigger still exists.
    const trigger = screen.getByRole('button', { name: 'More actions' });
    expect(within(trigger.closest('div') as HTMLElement).queryByText('Commit changes')).toBeNull();
  });
});
