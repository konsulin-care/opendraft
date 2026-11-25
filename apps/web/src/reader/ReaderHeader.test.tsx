// @vitest-environment jsdom
/**
 * ReaderHeader tests: the header links its book mark back to the editor, shows
 * the selected manuscript with its switcher and the published repository, and
 * places the main action before the account menu.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BffSession } from '../github/bff-client';
import { ReaderHeader } from './ReaderHeader';

/** Reader path used as the return target in every fixture. */
const RETURN_TO = '/konsulin-care/citizen-science';

/** Signed-in session fixture. */
const SESSION: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  expiresAt: '2030-01-01T00:00:00Z',
};

const MANUSCRIPTS = [
  { id: 'alpha', title: 'Alpha study' },
  { id: 'beta', title: 'Beta study' },
];

describe('ReaderHeader basics', () => {
  it('renders no OpenDraft text and links the book icon to the editor', () => {
    render(<ReaderHeader session={null} returnTo={RETURN_TO} onLogout={vi.fn()} />);

    expect(screen.queryByText('OpenDraft')).toBeNull();
    const editorLink = screen.getByRole('link', { name: 'Open editor' });
    expect(editorLink).toHaveAttribute('href', '/');
  });

  it('shows the selected manuscript title with the switcher and the published subtitle', () => {
    render(
      <ReaderHeader
        session={SESSION}
        returnTo={RETURN_TO}
        onLogout={vi.fn()}
        title="Alpha study"
        manuscripts={MANUSCRIPTS}
        selectedId="alpha"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Alpha study')).toBeInTheDocument();
    expect(screen.getByTestId('manuscript-switcher')).toBeInTheDocument();
    expect(screen.getByText('Published at')).toBeInTheDocument();
    const repoLink = screen.getByRole('link', { name: /konsulin-care\/citizen-science/ });
    expect(repoLink).toHaveAttribute('href', 'https://github.com/konsulin-care/citizen-science');
    expect(repoLink).toHaveAttribute('target', '_blank');
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('ReaderHeader actions', () => {
  it('renders the action node before the user menu avatar', () => {
    render(
      <ReaderHeader
        session={SESSION}
        returnTo={RETURN_TO}
        onLogout={vi.fn()}
        action={<button type="button">Edit</button>}
      />,
    );

    const action = screen.getByRole('button', { name: 'Edit' });
    const account = screen.getByRole('button', { name: 'Account' });
    expect(action.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the account menu when login is disabled', () => {
    render(
      <ReaderHeader
        session={null}
        returnTo={RETURN_TO}
        onLogout={vi.fn()}
        loginEnabled={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
    expect(screen.queryByText('OpenDraft')).toBeNull();
  });
});
