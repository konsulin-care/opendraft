// @vitest-environment jsdom
/**
 * ConvertPanel tests: anonymous sign-in, PR and compare outcomes, and error
 * recovery that re-enables the conversion button.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BffSession } from '../github/bff-client';
import type { ConvertResult } from './convert';
import { ConvertPanel } from './ConvertPanel';

/** Reader path used as the return target in every fixture. */
const RETURN_TO = '/konsulin-care/opendraft';

/** Signed-in session fixture. */
const SESSION: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  expiresAt: '2030-01-01T00:00:00Z',
};

describe('ConvertPanel anonymous', () => {
  it('links the anonymous action to sign in with return_to and hides conversion', () => {
    render(<ConvertPanel session={null} returnTo={RETURN_TO} convert={vi.fn()} />);

    expect(
      screen.getByText('This repository is not an OpenDraft project yet.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Sign in with GitHub to convert' }),
    ).toHaveAttribute(
      'href',
      `/@api/auth/login?return_to=${encodeURIComponent(RETURN_TO)}`,
    );
    expect(screen.queryByRole('button', { name: 'Convert to OpenDraft' })).toBeNull();
  });
});

describe('ConvertPanel signed in', () => {
  it('calls convert and links to the pull request for a PR result', async () => {
    const convert = vi.fn<() => Promise<ConvertResult>>(async () => ({
      kind: 'pr',
      url: 'https://github.com/octocat/draft/pull/7',
    }));
    render(<ConvertPanel session={SESSION} returnTo={RETURN_TO} convert={convert} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    const link = await screen.findByRole('link', { name: 'View pull request' });
    expect(convert).toHaveBeenCalledTimes(1);
    expect(link).toHaveAttribute('href', 'https://github.com/octocat/draft/pull/7');
  });

  it('links to GitHub compare for a compare result', async () => {
    const convert = vi.fn<() => Promise<ConvertResult>>(async () => ({
      kind: 'compare',
      url: 'https://github.com/octocat/draft/compare/main...octocat:opendraft/init?expand=1',
    }));
    render(<ConvertPanel session={SESSION} returnTo={RETURN_TO} convert={convert} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    const link = await screen.findByRole('link', { name: 'Open pull request on GitHub' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/octocat/draft/compare/main...octocat:opendraft/init?expand=1',
    );
  });
});

describe('ConvertPanel conversion state', () => {
  it('disables the button while running', async () => {
    let resolve: (value: ConvertResult) => void = () => undefined;
    const convert = vi.fn<() => Promise<ConvertResult>>(
      () =>
        new Promise<ConvertResult>((done) => {
          resolve = done;
        }),
    );
    render(<ConvertPanel session={SESSION} returnTo={RETURN_TO} convert={convert} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeDisabled();
    resolve({ kind: 'pr', url: 'https://github.com/octocat/draft/pull/7' });
    await screen.findByRole('link', { name: 'View pull request' });
  });

  it('shows the error message and re-enables the button when conversion fails', async () => {
    const convert = vi.fn<() => Promise<ConvertResult>>(async () => {
      throw new Error('branch exists');
    });
    render(<ConvertPanel session={SESSION} returnTo={RETURN_TO} convert={convert} />);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(await screen.findByText('branch exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeEnabled();
  });
});
