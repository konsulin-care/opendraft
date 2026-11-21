// @vitest-environment jsdom
/**
 * ReaderHeader tests: anonymous visitors get sign-in and install links that
 * return to the current reader path; signed-in users see their login and can
 * sign out.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BffSession } from '../github/bff-client';
import { ReaderHeader } from './ReaderHeader';

/** Reader path used as the return target in every fixture. */
const RETURN_TO = '/konsulin-care/opendraft';

/** Signed-in session fixture. */
const SESSION: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  expiresAt: '2030-01-01T00:00:00Z',
};

describe('ReaderHeader', () => {
  it('links the anonymous sign-in action to the login route with return_to', () => {
    render(<ReaderHeader session={null} returnTo={RETURN_TO} onLogout={vi.fn()} />);

    const signIn = screen.getByRole('link', { name: 'Sign in with GitHub' });
    expect(signIn).toHaveAttribute(
      'href',
      `/@api/auth/login?return_to=${encodeURIComponent(RETURN_TO)}`,
    );
    expect(screen.getByRole('link', { name: 'Install OpenDraft' })).toHaveAttribute(
      'href',
      `/@api/auth/install?return_to=${encodeURIComponent(RETURN_TO)}`,
    );
  });

  it('shows the login and calls onLogout when signing out', () => {
    const onLogout = vi.fn();
    render(<ReaderHeader session={SESSION} returnTo={RETURN_TO} onLogout={onLogout} />);

    expect(screen.getByText('@octocat')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in with GitHub' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
