// @vitest-environment jsdom
/**
 * ReaderHeader tests: the header links its book mark back to the editor, shows
 * the selected manuscript with its switcher and the published repository,
 * places the main action before the account menu, and follows the shared md
 * contract (compact trigger plus details panel below md).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

/** Render the reader header with a selected manuscript and spies. */
function renderHeader(overrides: Partial<Parameters<typeof ReaderHeader>[0]> = {}) {
  return render(
    <ReaderHeader
      session={SESSION}
      returnTo={RETURN_TO}
      onLogout={vi.fn()}
      title="Alpha study"
      manuscripts={MANUSCRIPTS}
      selectedId="alpha"
      onSelect={vi.fn()}
      {...overrides}
    />,
  );
}

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

    expect(screen.getAllByText('Alpha study').length).toBeGreaterThan(0);
    expect(screen.getByTestId('manuscript-switcher')).toBeInTheDocument();
    const repoLink = screen.getByRole('link', { name: /konsulin-care\/citizen-science/ });
    expect(repoLink).toHaveAttribute('href', 'https://github.com/konsulin-care/citizen-science');
    expect(repoLink).toHaveAttribute('target', '_blank');
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('ReaderHeader responsive contract', () => {
  it('keeps the compact title trigger visible below md only', () => {
    renderHeader();

    const compact = screen.getByTestId('header-compact-title');
    expect(compact).toHaveClass('md:hidden');
    expect(within(compact).getByRole('button', { name: /Alpha study/ })).toBeDefined();
  });

  it('shows the wide title with its switcher from md and hides the subtitle below md', () => {
    renderHeader();

    const wide = screen.getByTestId('header-wide-title');
    expect(wide).toHaveClass('hidden', 'md:flex');
    expect(within(wide).getByTestId('manuscript-switcher')).toBeDefined();

    const subtitle = screen.getByText('Published at').parentElement;
    expect(subtitle).toHaveClass('hidden', 'md:block');
  });

  it('opens the reader details panel from the trigger and closes it on Escape', () => {
    renderHeader();
    const trigger = within(screen.getByTestId('header-compact-title')).getByRole('button', {
      name: /Alpha study/,
    });

    expect(screen.queryByRole('region', { name: 'Published details' })).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole('region', { name: 'Published details' })).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Published details' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
