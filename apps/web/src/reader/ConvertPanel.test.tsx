// @vitest-environment jsdom
/**
 * ConvertPanel tests: anonymous sign-in, PR and compare outcomes, and error
 * recovery that re-enables the conversion button.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type {
  InitDecisions,
  ManuscriptCandidate,
  ProjectDiscovery,
} from '@opendraft/manuscript';
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

/** Valid manuscript candidate fixture. */
const CANDIDATE: ManuscriptCandidate = {
  id: 'case-series-review',
  path: 'manuscripts/case-series-review',
  status: 'valid',
  layout: 'legacy',
  missingFiles: [],
  warnings: [],
};

/** Discovery fixture with one registrable candidate. */
const DISCOVERY: ProjectDiscovery = {
  config: 'missing',
  configErrors: [],
  listed: [],
  candidates: [CANDIDATE],
  unlisted: [],
};

/** Render the panel with a convert spy and optional session. */
function renderPanel(
  convert: (decisions: InitDecisions) => Promise<ConvertResult>,
  session: BffSession | null = SESSION,
) {
  return render(
    <ConvertPanel
      session={session}
      returnTo={RETURN_TO}
      discovery={DISCOVERY}
      defaultId="opendraft"
      convert={convert}
    />,
  );
}

describe('ConvertPanel anonymous', () => {
  it('links the anonymous action to sign in with return_to and hides conversion', () => {
    render(
      <ConvertPanel
        session={null}
        returnTo={RETURN_TO}
        discovery={DISCOVERY}
        defaultId="opendraft"
        convert={vi.fn()}
      />,
    );

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

  it('shows the disabled note and no sign-in link when login is disabled', () => {
    render(
      <ConvertPanel
        session={null}
        returnTo={RETURN_TO}
        discovery={DISCOVERY}
        defaultId="opendraft"
        convert={vi.fn()}
        loginEnabled={false}
      />,
    );

    expect(
      screen.getByText('Conversion needs the GitHub app configured on this server.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Sign in with GitHub to convert' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Convert to OpenDraft' })).toBeNull();
  });
});

describe('ConvertPanel signed in', () => {
  it('calls convert and links to the pull request for a PR result', async () => {
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      async () => ({
        kind: 'pr',
        url: 'https://github.com/octocat/draft/pull/7',
      }),
    );
    renderPanel(convert);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    const link = await screen.findByRole('link', { name: 'View pull request' });
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith({ register: ['case-series-review'] });
    expect(link).toHaveAttribute('href', 'https://github.com/octocat/draft/pull/7');
  });

  it('links to GitHub compare for a compare result', async () => {
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      async () => ({
        kind: 'compare',
        url: 'https://github.com/octocat/draft/compare/main...octocat:opendraft/init?expand=1',
      }),
    );
    renderPanel(convert);

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
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      () =>
        new Promise<ConvertResult>((done) => {
          resolve = done;
        }),
    );
    renderPanel(convert);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeDisabled();
    resolve({ kind: 'pr', url: 'https://github.com/octocat/draft/pull/7' });
    await screen.findByRole('link', { name: 'View pull request' });
  });

  it('shows the error message and re-enables the button when conversion fails', async () => {
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      async () => {
        throw new Error('branch exists');
      },
    );
    renderPanel(convert);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(await screen.findByText('branch exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeEnabled();
  });
});
