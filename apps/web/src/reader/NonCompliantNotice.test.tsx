// @vitest-environment jsdom
/**
 * NonCompliantNotice tests: the notice explains why a repository is not an
 * OpenDraft project, lists detected manuscript folders read-only, and shows
 * either the conversion hint or the ask-the-owners fallback.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ManuscriptCandidate, ProjectDiscovery } from '@opendraft/manuscript';
import { NonCompliantNotice } from './NonCompliantNotice';

/** Build a discovery fixture from the given candidates. */
function discovery(candidates: ManuscriptCandidate[]): ProjectDiscovery {
  return {
    config: 'missing',
    configErrors: [],
    listed: [],
    candidates,
    unlisted: [],
  };
}

/** Build a candidate fixture with the given status and details. */
function candidate(
  id: string,
  overrides: Partial<ManuscriptCandidate> = {},
): ManuscriptCandidate {
  return {
    id,
    path: `manuscripts/${id}`,
    status: 'valid',
    layout: 'legacy',
    missingFiles: [],
    warnings: [],
    ...overrides,
  };
}

/** Mixed candidates covering ready, repairable and rejected rows. */
const MIXED: ManuscriptCandidate[] = [
  candidate('alpha'),
  candidate('beta', { status: 'repairable', missingFiles: ['_author.yml', '_abstract.yml'] }),
  candidate('Bad Name', { status: 'rejected', reason: 'invalid-id' }),
];

describe('NonCompliantNotice content', () => {
  it('renders the title and the opendraft.yml explanation', () => {
    render(
      <NonCompliantNotice
        discovery={discovery([])}
        canWrite={false}
        owner="konsulin"
        repo="paper"
      />,
    );

    expect(
      screen.getByText("This repository isn't an OpenDraft project yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "OpenDraft needs an opendraft.yml file and a standard folder layout to show, comment on and suggest edits to manuscripts. This repository doesn't have them.",
      ),
    ).toBeInTheDocument();
  });

  it('lists each discovered candidate as ready, repairable or rejected', () => {
    render(
      <NonCompliantNotice
        discovery={discovery(MIXED)}
        canWrite={false}
        owner="konsulin"
        repo="paper"
      />,
    );

    expect(screen.getByText('We found these possible manuscripts:')).toBeInTheDocument();
    expect(screen.getByText('alpha ready')).toBeInTheDocument();
    expect(
      screen.getByText("beta needs _author.yml, _abstract.yml (we'll create it)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Bad Name can't be used: invalid-id")).toBeInTheDocument();
  });
});

describe('NonCompliantNotice actions', () => {
  it('shows the Convert hint for viewers with write access', () => {
    render(
      <NonCompliantNotice
        discovery={discovery(MIXED)}
        canWrite
        owner="konsulin"
        repo="paper"
      />,
    );

    expect(
      screen.getByText(
        'Use "Convert to OpenDraft" to open a pull request that adds the missing files. Nothing changes until you merge it.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('asks the owners to convert and links to the repository otherwise', () => {
    render(
      <NonCompliantNotice
        discovery={discovery(MIXED)}
        canWrite={false}
        owner="konsulin"
        repo="paper"
      />,
    );

    expect(
      screen.getByText(/Only people with write access can convert it\./),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /read the files on GitHub/ });
    expect(link).toHaveAttribute('href', 'https://github.com/konsulin/paper');
  });
});
