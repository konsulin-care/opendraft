// @vitest-environment jsdom
/**
 * Suggestion banner tests: GitHub-only rendering, remote suggestion states,
 * save outcomes and the submit dialog's required title and success message.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { SuggestionActions } from './SuggestionBanner';
import { SuggestionBanner } from './SuggestionBanner';

const BRANCH = 'opendraft/octocat/20260102-030405';
const PR_URL = 'https://github.com/konsulin-care/draft/pull/7';

/** Build a GitHub project source for the banner tests. */
function githubSource(overrides: Partial<ProjectSourceGitHub> = {}): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'sync-sha',
    digest: {},
    pullNumber: null,
    ...overrides,
  };
}

/** Build a project record around a source. */
function record(source: ProjectRecord['source']): ProjectRecord {
  return { id: 'project-1', name: 'draft', source, createdAt: 1, lastOpenedAt: 1 };
}

/** Build banner actions with inert doubles. */
function makeActions(overrides: Partial<SuggestionActions> = {}): SuggestionActions {
  return {
    check: vi.fn(async () => ({ state: 'local-only' as const })),
    save: vi.fn(async () => ({ kind: 'unchanged' as const })),
    submit: vi.fn(async () => ({ kind: 'created' as const, number: 7, url: PR_URL })),
    restart: vi.fn(async () => ({ projectId: 'project-1', branch: BRANCH, sha: 'new-sha' })),
    pullLatest: vi.fn(async () => ({ projectId: 'project-1', branch: BRANCH, sha: 'head-sha' })),
    ...overrides,
  };
}

/** Render the banner over a fresh workspace. */
function renderBanner(project: ProjectRecord, actions: SuggestionActions) {
  return render(
    <SuggestionBanner project={project} workspace={new MemoryWorkspace()} actions={actions} />,
  );
}

describe('SuggestionBanner source', () => {
  it('shows the upstream copy message and both actions for a GitHub project', async () => {
    renderBanner(record(githubSource()), makeActions());

    expect(
      await screen.findByText(
        'Editing your copy of konsulin-care/draft. Changes are saved in this browser.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to my copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit suggestion' })).toBeInTheDocument();
  });

  it('renders nothing for a local project', () => {
    const { container } = renderBanner(record({ kind: 'local' }), makeActions());

    expect(container).toBeEmptyDOMElement();
  });
});

describe('SuggestionBanner remote state', () => {
  it('links an open suggestion and labels the submit action Update suggestion', async () => {
    renderBanner(
      record(githubSource({ pullNumber: 7 })),
      makeActions({
        check: vi.fn(async () => ({ state: 'open' as const, number: 7, url: PR_URL })),
      }),
    );

    const link = await screen.findByRole('link', { name: 'Suggestion #7 is open' });
    expect(link).toHaveAttribute('href', PR_URL);
    expect(screen.getByRole('button', { name: 'Update suggestion' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit suggestion' })).toBeNull();
  });

  it.each(['merged', 'closed', 'branch-deleted'] as const)(
    'offers Start a new suggestion for a %s suggestion',
    async (state) => {
      const actions = makeActions({ check: vi.fn(async () => ({ state })) });
      renderBanner(record(githubSource()), actions);

      const restart = await screen.findByRole('button', { name: 'Start a new suggestion' });
      fireEvent.click(restart);

      await waitFor(() => expect(actions.restart).toHaveBeenCalledTimes(1));
    },
  );

  it('offers both latest-from-GitHub and keep-this-device actions when the remote moved', async () => {
    const actions = makeActions({
      check: vi.fn(async () => ({ state: 'remote-moved' as const })),
    });
    renderBanner(record(githubSource()), actions);

    const pull = await screen.findByRole('button', { name: 'Use the latest from GitHub' });
    const keep = screen.getByRole('button', { name: "Keep this device's version" });

    fireEvent.click(keep);
    await waitFor(() => expect(actions.save).toHaveBeenCalledWith({ overwrite: true }));

    fireEvent.click(pull);
    await waitFor(() => expect(actions.pullLatest).toHaveBeenCalledTimes(1));
  });
});

describe('SuggestionBanner save outcome', () => {
  it('warns when the original changed under an unpushed suggestion', async () => {
    const actions = makeActions({
      save: vi.fn(async () => ({ kind: 'saved' as const, sha: 'new-sha', upstreamMoved: true })),
    });
    renderBanner(record(githubSource({ pushed: false })), actions);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to my copy' }));

    expect(
      await screen.findByText(
        'The original has changed since you started; your suggestion may need review.',
      ),
    ).toBeInTheDocument();
  });
});

describe('SuggestionBanner submit dialog', () => {
  it('requires a title, submits the title and note, and links the sent suggestion', async () => {
    const actions = makeActions();
    renderBanner(record(githubSource()), actions);

    fireEvent.click(await screen.findByRole('button', { name: 'Submit suggestion' }));
    const dialog = screen.getByRole('dialog', { name: 'Submit suggestion' });
    const send = within(dialog).getByRole('button', { name: 'Submit suggestion' });
    expect(send).toBeDisabled();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Add results' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Note' }), {
      target: { value: 'Please review.' },
    });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() =>
      expect(actions.submit).toHaveBeenCalledWith({ title: 'Add results', note: 'Please review.' }),
    );
    expect(await within(dialog).findByText('Suggestion #7 sent')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'View suggestion' })).toHaveAttribute(
      'href',
      PR_URL,
    );
  });
});
