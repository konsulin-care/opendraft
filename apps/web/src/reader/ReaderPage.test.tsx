// @vitest-environment jsdom
/**
 * ReaderPage tests: the read-only manuscript view for an OpenDraft project,
 * the unlisted-manuscript banner, the conversion panel for a plain repository,
 * and the dedicated rate-limit and not-found messages.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace, readOnlyWorkspace } from '@opendraft/workspace';
import { stringify } from 'yaml';
import { PROTOCOL } from '../project/scaffold';
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

/** Build a loaded repository fixture from an opendraft.yml manuscript list. */
async function makeRepo(
  manuscripts: { id: string; path: string }[],
  unlisted: string[] = [],
): Promise<LoadedRepo> {
  const workspace = new MemoryWorkspace();
  if (manuscripts.length > 0) {
    const yml = stringify({ protocol: PROTOCOL, manuscripts });
    await workspace.writeFile('opendraft.yml', yml);
    for (const entry of manuscripts) {
      await workspace.writeFile(`${entry.path}/article.qmd`, `# ${entry.id}\n`);
    }
    for (const id of unlisted) {
      await workspace.writeFile(`manuscripts/${id}/article.qmd`, `# ${id}\n`);
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

/** Build a plain (non-OpenDraft) repository fixture with extra files. */
async function makePlainRepo(files: Record<string, string> = {}): Promise<LoadedRepo> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile('README.md', '# Plain repository\n');
  for (const [path, content] of Object.entries(files)) {
    await workspace.writeFile(path, content);
  }
  return {
    sha: 'sha1',
    workspace: readOnlyWorkspace(workspace),
    isOpenDraft: false,
    manuscripts: [],
  };
}

/** Build reader dependencies with inert defaults and spy hooks. */
function makeDeps(overrides: Partial<ReaderPageDeps> = {}): ReaderPageDeps {
  return {
    loadRepo: vi.fn(async () => makeRepo([{ id: 'demo', path: 'manuscripts/demo' }])),
    getSessionState: vi.fn(async () => ({ session: null, loginEnabled: true })),
    logout: vi.fn(async () => undefined),
    convert: vi.fn(async () => ({ kind: 'pr' as const, url: 'https://example.test/pr/1' })),
    register: vi.fn(async () => ({ kind: 'pr' as const, url: 'https://example.test/pr/1' })),
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
    render(<ReaderPage route={ROUTE} deps={deps} action={<button type="button">Edit</button>} />);
    const view = await screen.findByTestId('manuscript-view');
    expect(view).toHaveAttribute('data-dir', 'manuscripts/first');
    expect(view).toHaveAttribute('data-project-key', 'reader:konsulin-care/citizen-science@sha1');
    expect(view).toHaveAttribute('data-readonly', 'true');
    const header = screen.getByTestId('header-shell');
    expect(within(header).getByText('first')).toBeInTheDocument();
    expect(within(header).getByText('Published at konsulin-care/citizen-science')).toBeInTheDocument();
    expect(within(header).getByTestId('manuscript-switcher')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' }).compareDocumentPosition(
      screen.getByRole('button', { name: 'Account' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe('ReaderPage unlisted manuscripts', () => {
  it('banners unlisted manuscripts and registers the checked ids', async () => {
    const register = vi.fn(async () => ({
      kind: 'pr' as const,
      url: 'https://example.test/pr/2',
    }));
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makeRepo([{ id: 'intro', path: 'manuscripts/intro' }], ['case-series-review']),
      ),
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
      register,
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    expect(
      await screen.findByText('1 manuscript(s) not listed in opendraft.yml'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'case-series-review' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Add to opendraft.yml' }));
    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(['case-series-review']);
    });
    expect(await screen.findByRole('link', { name: 'View pull request' })).toHaveAttribute(
      'href',
      'https://example.test/pr/2',
    );
  });

  it('renders no banner when every manuscript is listed', async () => {
    const deps = makeDeps({
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    await screen.findByTestId('manuscript-view');
    expect(
      screen.queryByText('1 manuscript(s) not listed in opendraft.yml'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to opendraft.yml' })).toBeNull();
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
});

describe('ReaderPage plain repository conversion', () => {
  it('offers conversion to a signed-in viewer', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makePlainRepo({
          'manuscripts/case-series-review/article.qmd': '# Case series\n',
        }),
      ),
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    expect(await screen.findByRole('button', { name: 'Convert to OpenDraft' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /case-series-review/ }),
    ).toBeChecked();
  });

  it('converts with the checked registration decisions', async () => {
    const convert = vi.fn(async () => ({
      kind: 'pr' as const,
      url: 'https://example.test/pr/1',
    }));
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makePlainRepo({
          'manuscripts/case-series-review/article.qmd': '# Case series\n',
        }),
      ),
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
      convert,
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Convert to OpenDraft' }));
    await waitFor(() => {
      expect(convert).toHaveBeenCalledWith({
        owner: ROUTE.owner,
        repo: ROUTE.repo,
        session: SESSION,
        decisions: { register: ['case-series-review'] },
      });
    });
  });
});

describe('ReaderPage login availability', () => {
  it('shows no account menu when login is disabled', async () => {
    const deps = makeDeps({
      getSessionState: vi.fn(async () => ({ session: null, loginEnabled: false })),
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    await screen.findByTestId('manuscript-view');
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
  });

  it('offers sign-in from the account menu when login is enabled without a session', async () => {
    const deps = makeDeps({
      getSessionState: vi.fn(async () => ({ session: null, loginEnabled: true })),
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    await screen.findByTestId('manuscript-view');

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    const signIn = screen.getByRole('menuitem', { name: 'Sign in with GitHub' });
    expect(signIn).toHaveAttribute(
      'href',
      `/@api/auth/login?return_to=${encodeURIComponent('/konsulin-care/citizen-science')}`,
    );
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
