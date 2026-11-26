// @vitest-environment jsdom
/**
 * Draft section tests: the hook exposes the split action, status chip and the
 * send, publish and conflict dialogs as project state changes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ProjectRecord, WorkspaceAdapter } from '@opendraft/workspace';
import { preflight } from '../publish/preflight';
import type { BffSession, Owner } from '../github/bff-client';
import type { SaveConflictChoice, SaveGitHubResult } from '../suggest/save';
import type { SendSuggestionResult } from '../suggest/submit';
import type { DraftSectionDeps, UseDraftSectionInput } from './use-draft-section';
import { useDraftSection } from './use-draft-section';

vi.mock('../publish/preflight', () => ({ preflight: vi.fn() }));
const mockedPreflight = vi.mocked(preflight);

beforeEach(() => {
  mockedPreflight.mockReset();
  mockedPreflight.mockResolvedValue({ ok: true, errors: [], warnings: [] });
});

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Octo Cat',
  expiresAt: '2030-01-01T00:00:00Z',
};

const OWNERS: Owner[] = [
  { login: 'octocat', type: 'User', avatarUrl: 'https://example.test/a.png', allRepos: true },
];

const DRAFT: ProjectRecord = {
  id: 'project-1',
  name: 'Draft',
  source: {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: 'od-octocat/untitled-draft',
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: false,
    syncedSha: 'sync-sha',
    digest: {},
    pullNumber: null,
  },
  createdAt: 1,
  lastOpenedAt: 1,
};

const LOCAL: ProjectRecord = {
  id: 'project-2',
  name: 'Local paper',
  source: { kind: 'local' },
  createdAt: 1,
  lastOpenedAt: 1,
};

/**
 * Build draft dependencies with inert defaults and spy hooks.
 *
 * @param overrides - Dependency overrides for the scenario under test.
 * @returns Complete section dependencies.
 */
function makeDeps(overrides: Partial<DraftSectionDeps> = {}): DraftSectionDeps {
  return {
    load: vi.fn(async () => ({ status: { state: 'draft' as const }, pendingSaves: 0 })),
    save: vi.fn(async (): Promise<SaveGitHubResult> => ({ kind: 'unchanged' })),
    send: vi.fn(async (): Promise<SendSuggestionResult> => ({ kind: 'closed', state: 'closed' })),
    update: vi.fn(async (): Promise<SaveGitHubResult> => ({ kind: 'unchanged' })),
    startNew: vi.fn(async () => ({ projectId: 'project-1' })),
    publish: vi.fn(async () => ({ repo: 'draft' })),
    checkName: vi.fn(async () => ({ kind: 'free' as const })),
    runPreflight: vi.fn(async () => ({ ok: true, errors: [], warnings: [] })),
    ...overrides,
  };
}

/**
 * Build hook input for a project.
 *
 * @param project - Project under test.
 * @param deps - Draft dependencies.
 * @returns Complete hook input.
 */
function makeInput(project: ProjectRecord, deps: DraftSectionDeps): UseDraftSectionInput {
  return { project, workspace: null, session: SESSION, owners: OWNERS, deps };
}

/**
 * Render the hook output into the document.
 *
 * @param input - Hook input for the scenario.
 */
function Section(input: UseDraftSectionInput) {
  const section = useDraftSection(input);
  return (
    <div>
      {section.action}
      {section.extra}
      {section.dialogs}
    </div>
  );
}

describe('useDraftSection action and chip', () => {
  it('labels the action for an unsent draft and shows a status chip', async () => {
    render(<Section {...makeInput(DRAFT, makeDeps())} />);

    expect(screen.getByRole('button', { name: 'Send for review' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument(),
    );
  });

  it('labels the action for a local project with Publish to GitHub', () => {
    const deps = makeDeps({
      load: vi.fn(async () => ({ status: { state: 'local-only' as const }, pendingSaves: 0 })),
    });
    render(<Section {...makeInput(LOCAL, deps)} />);

    expect(screen.getByRole('button', { name: 'Publish to GitHub' })).toBeInTheDocument();
  });
});

describe('useDraftSection local preflight', () => {
  it('calls the preflight module with the workspace when no runner is injected', async () => {
    const deps = makeDeps({
      load: vi.fn(async () => ({ status: { state: 'local-only' as const }, pendingSaves: 0 })),
      runPreflight: undefined,
    });
    const workspace = {} as WorkspaceAdapter;
    mockedPreflight.mockResolvedValue({
      ok: false,
      errors: [{ level: 'error', location: 'preflight', path: 'index.qmd', message: 'Broken cite' }],
      warnings: [],
    });
    render(
      <Section {...makeInput(LOCAL, deps)} workspace={workspace} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish to GitHub' }));

    expect(
      await screen.findByText('index.qmd — Broken cite'),
    ).toBeInTheDocument();
    expect(mockedPreflight).toHaveBeenCalledWith(workspace);
  });

  it('uses an injected runner and never calls the preflight module', async () => {
    const deps = makeDeps({
      load: vi.fn(async () => ({ status: { state: 'local-only' as const }, pendingSaves: 0 })),
    });
    render(<Section {...makeInput(LOCAL, deps)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publish to GitHub' }));

    await waitFor(() => expect(deps.runPreflight).toHaveBeenCalled());
    expect(mockedPreflight).not.toHaveBeenCalled();
  });
});

describe('useDraftSection status chip', () => {
  it('shows the draft error text in the status chip when an action fails', async () => {
    const deps = makeDeps({
      save: vi.fn(async () => {
        throw new Error('Could not save');
      }),
    });
    render(<Section {...makeInput(DRAFT, deps)} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save to GitHub' }));

    expect(
      await screen.findByRole('button', { name: 'Could not save' }),
    ).toBeInTheDocument();
  });

  it('shows the regular notice in the status chip when there is no draft error', async () => {
    const deps = makeDeps({
      save: vi.fn(async (): Promise<SaveGitHubResult> => ({ kind: 'saved' as const, sha: 'next-sha' })),
    });
    render(<Section {...makeInput(DRAFT, deps)} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save to GitHub' }));

    expect(
      await screen.findByRole('button', { name: 'Saved to GitHub' }),
    ).toBeInTheDocument();
  });
});

describe('useDraftSection dialogs', () => {
  it('opens the send dialog from the primary action of a draft', async () => {
    render(<Section {...makeInput(DRAFT, makeDeps())} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send for review' }));

    expect(
      await screen.findByRole('dialog', { name: 'Submit' }),
    ).toBeInTheDocument();
    expect(screen.getByText('What did you change?')).toBeInTheDocument();
  });

  it('opens the publish form from the primary action of a local project', async () => {
    const deps = makeDeps({
      load: vi.fn(async () => ({ status: { state: 'local-only' as const }, pendingSaves: 0 })),
    });
    render(<Section {...makeInput(LOCAL, deps)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publish to GitHub' }));

    expect(
      await screen.findByRole('dialog', { name: 'Publish to GitHub' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Who can see it')).toBeInTheDocument();
  });

  it('renders the per-file conflict dialog when a save surfaces conflicts', async () => {
    let choices: Record<string, SaveConflictChoice> | null = null;
    const deps = makeDeps({
      save: vi.fn(async (context) => {
        choices = await context.resolveConflicts(['manuscripts/paper/index.qmd']);
        return { kind: 'saved' as const, sha: 'next-sha' };
      }),
    });
    render(<Section {...makeInput(DRAFT, deps)} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save to GitHub' }));

    expect(
      await screen.findByRole('dialog', { name: 'Resolve conflicts' }),
    ).toBeInTheDocument();
    expect(screen.getByText('manuscripts/paper/index.qmd')).toBeInTheDocument();
    expect(screen.getByText('Keep my version')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(choices).toEqual({ 'manuscripts/paper/index.qmd': 'theirs' }));
  });
});

describe('useDraftSection send dialog', () => {
  it('submits the change text as the send title', async () => {
    const deps = makeDeps();
    render(<Section {...makeInput(DRAFT, deps)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send for review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit' });
    fireEvent.change(screen.getByLabelText('What did you change?'), {
      target: { value: 'Fix the abstract' },
    });
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() =>
      expect(deps.send).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Fix the abstract' }),
      ),
    );
  });
});
