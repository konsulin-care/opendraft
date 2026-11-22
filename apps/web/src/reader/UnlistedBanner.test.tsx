// @vitest-environment jsdom
/**
 * UnlistedBanner tests: the unlisted count, checked checkboxes and the
 * registration action with its resulting pull request link.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ManuscriptCandidate, ProjectDiscovery } from '@opendraft/manuscript';
import type { BffSession } from '../github/bff-client';
import type { ConvertResult } from './convert';
import { UnlistedBanner } from './UnlistedBanner';

/** Signed-in session fixture. */
const SESSION: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  expiresAt: '2030-01-01T00:00:00Z',
};

/** Valid candidate fixture. */
function candidate(id: string): ManuscriptCandidate {
  return {
    id,
    path: `manuscripts/${id}`,
    status: 'valid',
    layout: 'legacy',
    missingFiles: [],
    warnings: [],
  };
}

/** Discovery fixture with one listed and two unlisted manuscripts. */
const DISCOVERY: ProjectDiscovery = {
  config: 'valid',
  configErrors: [],
  listed: ['intro'],
  candidates: [candidate('intro'), candidate('case-series-review'), candidate('second-draft')],
  unlisted: ['case-series-review', 'second-draft'],
};

describe('UnlistedBanner', () => {
  it('shows the count and a checked checkbox per unlisted manuscript', () => {
    render(<UnlistedBanner discovery={DISCOVERY} session={SESSION} register={vi.fn()} />);

    expect(
      screen.getByText('2 manuscript(s) not listed in opendraft.yml'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'case-series-review' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'second-draft' })).toBeChecked();
  });

  it('registers the checked ids and links the pull request', async () => {
    const register = vi.fn(
      async (): Promise<ConvertResult> => ({
        kind: 'pr',
        url: 'https://github.com/octocat/draft/pull/9',
      }),
    );
    render(<UnlistedBanner discovery={DISCOVERY} session={SESSION} register={register} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'second-draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to opendraft.yml' }));

    expect(register).toHaveBeenCalledWith(['case-series-review']);
    expect(await screen.findByRole('link', { name: 'View pull request' })).toHaveAttribute(
      'href',
      'https://github.com/octocat/draft/pull/9',
    );
  });
});
