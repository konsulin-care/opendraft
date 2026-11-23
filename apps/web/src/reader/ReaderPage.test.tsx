// @vitest-environment jsdom
/**
 * ReaderPage tests: the read-only manuscript view for an OpenDraft project,
 * the unlisted-manuscript banner, the non-compliant notice and convert dialog
 * for a plain repository, and the dedicated rate-limit and not-found messages.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace, readOnlyWorkspace } from '@opendraft/workspace';
import { stringify } from 'yaml';
import { PROTOCOL } from '../project/scaffold';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { RateLimitedError, NotFoundError } from './github-public';
import type { LoadedRepo } from './load-repo';
import { parseManuscripts } from './load-repo';
import type { ReaderPageDeps } from './ReaderPage';
import { ReaderPage } from './ReaderPage';
import type { ReaderRoute } from './route';

vi.mock('../components/ManuscriptView', () => ({
  ManuscriptView: (props: { dir: string; projectKey: string; readOnly?: boolean }) => (
    <div data-testid="manuscript-view" data-dir={props.dir}
      data-project-key={props.projectKey} data-readonly={String(props.readOnly)} />
  ),
}));

const ROUTE: ReaderRoute = { owner: 'konsulin-care', repo: 'citizen-science' };
const SESSION: BffSession = {
  login: 'octocat',
  id: 1,
  name: 'The Octocat',
  expiresAt: '2030-01-01T00:00:00Z',
};

/** Access fixture for a writer on an installed repository. */
const PUSH_INSTALLED: RepoPermissions = {
  push: true,
  installed: true,
  defaultBranch: 'main',
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
    return { sha: 'sha1', workspace: readOnlyWorkspace(workspace), isOpenDraft: true, manuscripts: parseManuscripts(yml) };
  }
  await workspace.writeFile('README.md', '# Plain repository\n');
  return { sha: 'sha1', workspace: readOnlyWorkspace(workspace), isOpenDraft: false, manuscripts: [] };
}

/** Build a plain (non-OpenDraft) repository fixture with extra files. */
async function makePlainRepo(files: Record<string, string> = {}): Promise<LoadedRepo> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile('README.md', '# Plain repository\n');
  for (const [path, content] of Object.entries(files)) {
    await workspace.writeFile(path, content);
  }
  return { sha: 'sha1', workspace: readOnlyWorkspace(workspace), isOpenDraft: false, manuscripts: [] };
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

const TWO = [
  { id: 'first', path: 'manuscripts/first' },
  { id: 'second', path: 'manuscripts/second' },
];

describe('ReaderPage OpenDraft repository', () => {
  it('shows the manuscript index and All manuscripts title for several manuscripts', async () => {
    const deps = makeDeps({ loadRepo: vi.fn(async () => makeRepo(TWO)) });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    expect(await screen.findByTestId('manuscript-index')).toBeInTheDocument();
    expect(screen.queryByTestId('manuscript-view')).toBeNull();
    const header = screen.getByTestId('header-shell');
    expect(within(header).getByText('All manuscripts')).toBeInTheDocument();
    expect(within(header).getByText('Published at konsulin-care/citizen-science')).toBeInTheDocument();
    expect(within(header).getByTestId('manuscript-switcher')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Suggest edits' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText('Suggest edits')).toBeNull();
    expect(within(header).getByRole('button', { name: 'Suggest edits' }).compareDocumentPosition(
      within(header).getByRole('button', { name: 'Account' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the manuscript named by ?manuscript without a button-row switcher', async () => {
    const deps = makeDeps({ loadRepo: vi.fn(async () => makeRepo(TWO)) });
    render(<ReaderPage route={{ ...ROUTE, manuscript: 'second' }} deps={deps} />);
    const view = await screen.findByTestId('manuscript-view');
    expect(view).toHaveAttribute('data-dir', 'manuscripts/second');
    expect(view).toHaveAttribute('data-project-key', 'reader:konsulin-care/citizen-science@sha1');
    expect(view).toHaveAttribute('data-readonly', 'true');
    expect(screen.queryByTestId('manuscript-index')).toBeNull();
    expect(screen.queryByRole('button', { name: 'second' })).toBeNull();
    const header = screen.getByTestId('header-shell');
    expect(within(header).getByText('second')).toBeInTheDocument();
  });
});

describe('ReaderPage edit intent', () => {
  it('auto-starts once for a signed-in viewer and clears the intent from the URL', async () => {
    window.history.replaceState({}, '', `${ROUTE.owner}/${ROUTE.repo}?intent=edit`);
    const replace = vi.spyOn(window.history, 'replaceState');
    const start = vi.fn(async () => ({ projectId: 'project-1', resumed: 'fresh' as const }));
    const navigate = vi.fn();
    const deps = makeDeps({
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
      getAccess: vi.fn(async () => PUSH_INSTALLED),
      start,
      navigate,
    });

    render(<ReaderPage route={ROUTE} deps={deps} />);

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(window.location.search).not.toContain('intent=edit');
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalled();

    replace.mockRestore();
    window.history.replaceState({}, '', '/');
  });
});

describe('ReaderPage single manuscript', () => {
  it('shows a single manuscript directly', async () => {
    const deps = makeDeps();
    render(<ReaderPage route={ROUTE} deps={deps} />);
    const view = await screen.findByTestId('manuscript-view');
    expect(view).toHaveAttribute('data-dir', 'manuscripts/demo');
    expect(screen.queryByTestId('manuscript-index')).toBeNull();
    const header = screen.getByTestId('header-shell');
    expect(within(header).getByText('demo')).toBeInTheDocument();
    expect(within(header).queryByTestId('manuscript-switcher')).toBeNull();
  });
});

describe('ReaderPage unlisted manuscripts', () => {
  it('banners unlisted manuscripts and registers the checked ids', async () => {
    const register = vi.fn(async () => ({ kind: 'pr' as const, url: 'https://example.test/pr/2' }));
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makeRepo([{ id: 'intro', path: 'manuscripts/intro' }], ['case-series-review']),
      ),
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
      register,
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    expect(await screen.findByText('1 manuscript(s) not listed in opendraft.yml')).toBeInTheDocument();
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
    expect(screen.queryByText('1 manuscript(s) not listed in opendraft.yml')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to opendraft.yml' })).toBeNull();
  });
});

describe('ReaderPage non-compliant repository', () => {
  it('shows the notice body and opens the convert dialog for a signed-in viewer', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makePlainRepo({ 'manuscripts/case-series-review/article.qmd': '# Case series\n' }),
      ),
      getSessionState: vi.fn(async () => ({ session: SESSION, loginEnabled: true })),
      getAccess: vi.fn(async () => PUSH_INSTALLED),
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);

    expect(
      await screen.findByText("This repository isn't an OpenDraft project yet"),
    ).toBeInTheDocument();
    expect(screen.getByText('We found these possible manuscripts:')).toBeInTheDocument();
    expect(screen.getByText(/case-series-review needs/)).toBeInTheDocument();
    expect(screen.queryByTestId('manuscript-view')).toBeNull();

    const header = screen.getByTestId('header-shell');
    fireEvent.click(within(header).getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(
      screen.getByRole('dialog', { name: 'Convert to OpenDraft' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /case-series-review/ })).toBeChecked();
  });

  it('shows the sign-in popover for a signed-out viewer', async () => {
    const deps = makeDeps({
      loadRepo: vi.fn(async () =>
        makePlainRepo({ 'manuscripts/case-series-review/article.qmd': '# Case series\n' }),
      ),
    });
    render(<ReaderPage route={ROUTE} deps={deps} />);

    await screen.findByText("This repository isn't an OpenDraft project yet");
    const header = screen.getByTestId('header-shell');
    fireEvent.click(within(header).getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(
      screen.getByText('Sign in to check whether you can convert this repository.'),
    ).toBeInTheDocument();
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
    const deps = makeDeps({ loadRepo: vi.fn(async () => { throw new RateLimitedError(); }) });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    expect(await screen.findByText('GitHub rate limit reached. Sign in for higher limits.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Sign in for higher limits' });
    expect(link).toHaveAttribute(
      'href',
      `/@api/auth/login?return_to=${encodeURIComponent('/konsulin-care/citizen-science')}`,
    );
  });

  it('shows the not-found message for a missing or private repository', async () => {
    const deps = makeDeps({ loadRepo: vi.fn(async () => { throw new NotFoundError(); }) });
    render(<ReaderPage route={ROUTE} deps={deps} />);
    expect(await screen.findByText('Repository not found or private.')).toBeInTheDocument();
  });
});
