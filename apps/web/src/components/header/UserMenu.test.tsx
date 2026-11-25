import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BffSession } from '../../github/bff-client';
import { UserMenu } from './UserMenu';
import type { UserMenuProps } from './UserMenu';

// @vitest-environment jsdom

const SESSION: BffSession = {
  login: 'octocat',
  id: 583231,
  name: 'The Octocat',
  expiresAt: '2099-01-01T00:00:00Z',
};

const BASE_PROPS: UserMenuProps = {
  session: null,
  returnTo: '/owner/repo/tree/main?manuscript=intro',
  onLogout: vi.fn(),
  loginEnabled: true,
};

/**
 * Render the user menu with optional prop overrides.
 *
 * @param overrides - Props to replace on top of {@link BASE_PROPS}.
 * @returns The testing-library render result.
 */
function renderMenu(overrides: Partial<UserMenuProps> = {}) {
  return render(<UserMenu {...BASE_PROPS} {...overrides} />);
}

/**
 * Open the menu by activating the account button.
 */
function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserMenu login disabled', () => {
  it('renders nothing when login is disabled', () => {
    const { container } = renderMenu({ loginEnabled: false });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('UserMenu signed out', () => {
  it('renders a GitHub mark account button without a menu until opened', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: 'Account' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu containing only the sign-in link', () => {
    renderMenu();
    openMenu();
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(1);
    const link = within(menu).getByRole('menuitem', { name: 'Sign in with GitHub' });
    expect(link.getAttribute('href')).toBe(
      '/@api/auth/login?return_to=%2Fowner%2Frepo%2Ftree%2Fmain%3Fmanuscript%3Dintro',
    );
  });
});

describe('UserMenu signed in', () => {
  it('renders the GitHub avatar', () => {
    renderMenu({ session: SESSION });
    const avatar = screen.getByRole('img', { name: '@octocat' });
    expect(avatar.getAttribute('src')).toBe('https://avatars.githubusercontent.com/u/583231?s=64');
  });

  it('shows the identity, install link and sign-out action', () => {
    renderMenu({ session: SESSION });
    openMenu();
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Signed in as @octocat')).toBeDefined();
    const manage = within(menu).getByRole('menuitem', { name: 'Manage GitHub access' });
    expect(manage.getAttribute('href')).toBe(
      '/@api/auth/install?return_to=%2Fowner%2Frepo%2Ftree%2Fmain%3Fmanuscript%3Dintro',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeDefined();
  });

  it('calls onLogout when Sign out is clicked', () => {
    const onLogout = vi.fn();
    renderMenu({ session: SESSION, onLogout });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('UserMenu closing', () => {
  it('closes on Escape', () => {
    renderMenu();
    openMenu();
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on an outside click', () => {
    renderMenu();
    openMenu();
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
