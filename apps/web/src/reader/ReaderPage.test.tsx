// @vitest-environment jsdom
/**
 * ReaderPage tests: the read-only manuscript view for an OpenDraft project,
 * the conversion panel for a plain repository, and the dedicated rate-limit
 * and not-found messages.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace, readOnlyWorkspace } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { RateLimitedError, NotFoundError } from './github-public';
import type { LoadedRepo } from './load-repo';
import { parseManuscripts } from './load-repo';
import type { ReaderPageDeps } from './ReaderPage';
import { ReaderPage } from './ReaderPage';
import type { ReaderRoute } from './route';

vi.mock('../components/ManuscriptView', () => ({
  ManuscriptView: (props: {
    dir: string;
    projectKey: string;
    readOnly?: boolean;
  }) => (
    <div
      data-testid="manuscript-view"
      data-dir={props.dir}
      data-project-key={props.projectKey}
      data-readonly={String(props.readOnly)}
    />
  ),
}));

const ROUTE: ReaderRoute = { owner: 'konsulin-care', repo: 'citizen-science' };

const SESSION: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  expiresAt: '2030-01-01T00:00:00Z',
};

/**
 * Build a loaded repository fixture from an opendraft.yml manuscript list.
 *
 * @param manuscripts - Manuscript entries to declare in opendraft.yml.
 * @returns The loaded repository with a read-only workspace.
 */
async function makeRepo(
  manuscripts: { id: string; path: string }[],
): Promise<LoadedRepo> {
  const workspace = new MemoryWorkspace();
  if (manuscripts.length > 0) {
    const yml = [
      'protocol:',
      '  name: opendraft',
      'manuscripts:',
      ...manuscripts.flatMap((entry) => [
        `  - id: ${entry.id}`,
        `    path: ${entry.path}`,
      ]),
      '',
    ].join('\n');
    await workspace.writeFile('opendraft.yml', yml);
    for (const entry of manuscripts) {
      await workspace.writeFile(`${entry.path}/article.qmd`, `# ${entry.id}\n`);
    }
    return {
      sha: 'sha1',
      workspace: readOnlyWorkspace(workspace),
      isOpenDraft: true,
      manuscripts: parseManuscripts(yml),
    };
  }

  await workspace.writeFile('README.md', '# Plain repository\n');
  return {
    sha: 'sha1',
    workspace: readOnlyWorkspace(workspace),
    isOpenDraft: false,
    manuscripts: [],
  };
}

/**
 * Build reader dependencies with inert defaults and spy hooks.
 *
 * @param overrides - Dependency overrides for one test.
 * @returns Reader page dependencies.
 */
function makeDeps(overrides: Partial<ReaderPageDeps> = {}): ReaderPageDeps {
  return {
    loadRepo: vi.fn(async () => makeRepo([{ id: 'demo', path: 'manuscripts/demo' }])),
    getSessionState: vi.fn(async () => ({ session: null, loginEnabled: true })),
    logout: vi.fn(async () => undefined),
    convert: vi.fn(async () => ({ kind: 'pr' as const, url: 'https://example.test/pr/1' })),
    ...overrides,
  };
}

describe('ReaderPage OpenDraft repository', () => {
  it('renders a read-only ManuscriptView for the first manuscript', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makeRepo([
          { id: 'first', path: 'manuscripts/first' },
          { id: 'second', path: 'manuscripts/second' },
        ]),
      ),
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    const view = await screen.findByTestId('manuscript-view');
    expect(view).toHaveAttribute('data-dir', 'manuscripts/first');
    expect(view).toHaveAttribute('data-project-key', 'reader:konsulin-care/citizen-science@sha1');
    expect(view).toHaveAttribute('data-readonly', 'true');
  });

  it('lists every manuscript and switches the rendered directory', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makeRepo([
          { id: 'first', path: 'manuscripts/first' },
          { id: 'second', path: 'manuscripts/second' },
        ]),
      ),
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    expect(await screen.findByRole('button', { name: 'first' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'second' }));

    expect(screen.getByTestId('manuscript-view')).toHaveAttribute(
      'data-dir',
      'manuscripts/second',
    );
    expect(screen.getByRole('button', { name: 'second' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('ReaderPage plain repository', () => {
  it('renders the ConvertPanel when opendraft.yml is missing', async () => {
    const deps = makeDeps({ loadRepo: vi.fn(async () => makeRepo([])) });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    expect(
      await screen.findByText('This repository is not an OpenDraft project yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('manuscript-view')).toBeNull();
  });

  it('offers conversion to a signed-in viewer', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () => makeRepo([])),
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    expect(await screen.findByRole('button', { name: 'Convert to OpenDraft' })).toBeInTheDocument();
  });
});

describe('ReaderPage login availability', () => {
  it('shows no sign-in link when login is disabled', async () => {
    const deps = makeDeps({
      getSessionState: vi.fn(async () => ({ session: null, loginEnabled: false })),
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    await screen.findByTestId('manuscript-view');
    expect(screen.queryByRole('link', { name: 'Sign in with GitHub' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Install OpenDraft' })).toBeNull();
  });

  it('offers sign-in when login is enabled without a session', async () => {
    const deps = makeDeps({
      getSessionState: vi.fn(async () => ({ session: null, loginEnabled: true })),
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    expect(
      await screen.findByRole('link', { name: 'Sign in with GitHub' }),
    ).toBeInTheDocument();
  });
});

describe('ReaderPage load errors', () => {
  it('shows the rate-limit message with a sign-in link', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () => {
        throw new RateLimitedError();
      }),
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    expect(
      await screen.findByText('GitHub rate limit reached. Sign in for higher limits.'),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Sign in for higher limits' });
    expect(link).toHaveAttribute(
      'href',
      `/@api/auth/login?return_to=${encodeURIComponent('/konsulin-care/citizen-science')}`,
    );
  });

  it('shows the not-found message for a missing or private repository', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () => {
        throw new NotFoundError();
      }),
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    expect(
      await screen.findByText('Repository not found or private.'),
    ).toBeInTheDocument();
  });
});
