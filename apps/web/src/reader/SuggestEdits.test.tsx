// @vitest-environment jsdom
/**
 * Suggest edits tests: anonymous sign-in, install and blocked screens, an
 * unverified-email hint and intent-driven start/resume.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { installUrl, loginUrl } from '../github/bff-client';
import type { StartSuggestionInput, StartSuggestionResult } from '../suggest/start';
import type { ReaderRoute } from './route';
import { SuggestEdits } from './SuggestEdits';

const ROUTE: ReaderRoute = { owner: 'konsulin-care', repo: 'citizen-science' };
const INTENT_PATH = '/konsulin-care/citizen-science?intent=edit';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2030-01-01T00:00:00Z',
};

/** Build repository permissions with fork-friendly defaults. */
function access(overrides: Partial<RepoPermissions> = {}): RepoPermissions {
  return {
    push: false,
    installed: true,
    defaultBranch: 'main',
    private: false,
    allowForking: true,
    viewerInstalledAll: true,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

/** Render a signed-in viewer whose intent auto-starts a fork suggestion. */
function renderAutoStart() {
  let resolveStart: (result: StartSuggestionResult) => void = () => undefined;
  const start = vi.fn<(input: StartSuggestionInput) => Promise<StartSuggestionResult>>(
    () =>
      new Promise<StartSuggestionResult>((resolve) => {
        resolveStart = resolve;
      }),
  );
  const navigate = vi.fn();
  const getAccess = vi.fn(async () => access());

  render(
    <SuggestEdits
      route={ROUTE}
      session={SESSION}
      loginEnabled
      search="?intent=edit"
      getAccess={getAccess}
      start={start}
      navigate={navigate}
    />,
  );

  return {
    start,
    navigate,
    getAccess,
    resolve: (result: StartSuggestionResult) => resolveStart(result),
  };
}

describe('SuggestEdits anonymous viewer', () => {
  it('shows the sign-in screen with the Google hint and intent return path', () => {
    const getAccess = vi.fn(async () => access());
    render(
      <SuggestEdits
        route={ROUTE}
        session={null}
        loginEnabled
        search=""
        getAccess={getAccess}
        start={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suggest edits' }));

    expect(
      screen.getByText(
        'Suggestions are saved under your free GitHub account. No account? You can create one with Google in a few seconds.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in with GitHub' })).toHaveAttribute(
      'href',
      loginUrl(INTENT_PATH),
    );
    expect(getAccess).not.toHaveBeenCalled();
  });
});

describe('SuggestEdits install plans', () => {
  it('asks for an all-repositories install with an intent install link', async () => {
    render(
      <SuggestEdits
        route={ROUTE}
        session={SESSION}
        loginEnabled
        search=""
        getAccess={vi.fn(async () => access({ viewerInstalledAll: false }))}
        start={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suggest edits' }));

    expect(await screen.findByText(/All repositories/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Install OpenDraft' })).toHaveAttribute(
      'href',
      installUrl(INTENT_PATH),
    );
  });

  it('tells writers that a repository owner must install OpenDraft', async () => {
    render(
      <SuggestEdits
        route={ROUTE}
        session={SESSION}
        loginEnabled
        search=""
        getAccess={vi.fn(async () => access({ push: true, installed: false }))}
        start={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suggest edits' }));

    expect(
      await screen.findByText(
        'A repository owner must install OpenDraft before anyone can suggest edits.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Install OpenDraft' })).toHaveAttribute(
      'href',
      installUrl(INTENT_PATH),
    );
  });
});

describe('SuggestEdits blocked plans', () => {
  it('explains that the owners have not enabled suggestions', async () => {
    render(
      <SuggestEdits
        route={ROUTE}
        session={SESSION}
        loginEnabled
        search=""
        getAccess={vi.fn(async () => access({ installed: false }))}
        start={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suggest edits' }));

    expect(
      await screen.findByText('The owners have not enabled OpenDraft suggestions.'),
    ).toBeInTheDocument();
  });

  it('asks for collaborator access when the private repository disallows forks', async () => {
    render(
      <SuggestEdits
        route={ROUTE}
        session={SESSION}
        loginEnabled
        search=""
        getAccess={vi.fn(async () =>
          access({ private: true, allowForking: false }),
        )}
        start={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suggest edits' }));

    expect(
      await screen.findByText('Ask a maintainer to add you as a collaborator.'),
    ).toBeInTheDocument();
  });
});

describe('SuggestEdits auth errors', () => {
  it('asks for email confirmation after an unverified GitHub sign-in', () => {
    render(
      <SuggestEdits
        route={ROUTE}
        session={null}
        loginEnabled
        search="?intent=edit&auth_error=unverified_email"
        getAccess={vi.fn(async () => access())}
        start={vi.fn()}
        navigate={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Please confirm your email on GitHub, then try again.'),
    ).toBeInTheDocument();
  });
});

describe('SuggestEdits intent-driven start', () => {
  it('starts on load, prepares the copy, stores the project and navigates home', async () => {
    const { start, navigate, getAccess, resolve } = renderAutoStart();

    expect(await screen.findByText('Preparing your copy…')).toBeInTheDocument();
    expect(getAccess).toHaveBeenCalledWith(ROUTE.owner, ROUTE.repo);
    expect(start).toHaveBeenCalledTimes(1);
    const input = start.mock.calls[0][0];
    expect(input.plan).toBe('fork');
    expect(input.upstream).toEqual({ owner: ROUTE.owner, repo: ROUTE.repo });
    expect(input.session).toBe(SESSION);
    expect(localStorage.getItem('opendraft:active-project')).toBeNull();

    resolve({ projectId: 'project-7', resumed: 'fresh' });

    await waitFor(() => {
      expect(localStorage.getItem('opendraft:active-project')).toBe('project-7');
      expect(navigate).toHaveBeenCalledWith('/');
    });
  });

  it('uses a branch plan when the viewer can push to an installed upstream', async () => {
    const start = vi.fn<(input: StartSuggestionInput) => Promise<StartSuggestionResult>>(
      async () => ({ projectId: 'project-8', resumed: 'local' as const }),
    );
    render(
      <SuggestEdits
        route={ROUTE}
        session={SESSION}
        loginEnabled
        search="?intent=edit"
        getAccess={vi.fn(async () => access({ push: true }))}
        start={start}
        navigate={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });
    expect(start.mock.calls[0][0].plan).toBe('branch');
  });
});
