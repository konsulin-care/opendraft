/**
 * Send and update tests: fixed send title/message, update commit messages and
 * retry-safe pull request creation.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import type { SuggestionPull } from '../github/bff-suggest';
import { fileDigest } from './file-diff';
import { SEND_MESSAGE, sendSuggestion, sendUpdate } from './submit';
import type { SendSuggestionDeps } from './submit';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const BRANCH = 'od-octocat/paper';
const CONFIG_OLD = 'project: old\n';
const CONFIG_NEW = 'project: new\n';
const PR_URL = 'https://github.com/konsulin-care/draft/pull/7';
const UPPER_HEAD = `konsulin-care:${BRANCH}`;

/** Build a GitHub project source for the tests. */
function source(overrides: Partial<ProjectSourceGitHub> = {}): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'base-sha',
    digest: fileDigest(new Map([['opendraft.yml', CONFIG_OLD]])),
    pullNumber: null,
    ...overrides,
  };
}

/** Build the initial project record for the tests. */
function record(value: ProjectSourceGitHub): ProjectRecord {
  return { id: 'project-1', name: 'draft', source: value, createdAt: 1, lastOpenedAt: 1 };
}

/** Build a workspace with either the old or a changed config file. */
async function workspace(edited: boolean): Promise<MemoryWorkspace> {
  const memory = new MemoryWorkspace();
  await memory.writeFile('opendraft.yml', edited ? CONFIG_NEW : CONFIG_OLD);
  return memory;
}

/** Test harness exposing commit messages and mutable project records. */
interface Harness {
  deps: SendSuggestionDeps;
  records: Map<string, ProjectRecord>;
  messages: string[];
}

/** Options controlling the send/update test doubles. */
interface MakeOptions {
  /** Whether the workspace contains an edited config. */
  edited?: boolean;
  /** Existing pull request returned by the lookup. */
  existingPull?: { number: number; url: string; state: SuggestionPull['state'] } | null;
}

/** Build an in-memory registry whose setSource updates stored records. */
function makeRegistry(project: ProjectRecord): {
  registry: SendSuggestionDeps['registry'];
  records: Map<string, ProjectRecord>;
} {
  const records = new Map([[project.id, project]]);
  return {
    records,
    registry: {
      get: vi.fn(async (id: string) => records.get(id)),
      setSource: vi.fn(async (id: string, next: ProjectSourceGitHub) => {
        const existing = records.get(id);
        if (!existing) throw new Error(`missing ${id}`);
        records.set(id, { ...existing, source: next });
        return { id, source: next };
      }),
    },
  };
}

/** Build an applyName double that rewrites the stored draft branch. */
function makeApplyName(
  records: Map<string, ProjectRecord>,
): SendSuggestionDeps['applyName'] {
  return vi.fn(async (id: string, name: string) => {
    const existing = records.get(id);
    if (!existing) throw new Error(`missing ${id}`);
    const branch = `od-octocat/${name.toLowerCase()}`;
    const stored = existing.source as ProjectSourceGitHub;
    records.set(id, { ...existing, source: { ...stored, branch } });
    return branch;
  });
}

/** Build the git, workspace and commit dependencies of a send. */
function makeRepoDeps(
  records: Map<string, ProjectRecord>,
  options: MakeOptions,
): { repo: Omit<SendSuggestionDeps, 'registry' | 'applyName' | 'findSuggestionPull' | 'createPullRequest'>; messages: string[] } {
  const messages: string[] = [];
  const files = new Map([['opendraft.yml', CONFIG_OLD]]);
  const repo = {
    getWorkspace: vi.fn(async () => workspace(options.edited ?? true)),
    clone: vi.fn(async () => ({ sha: 'base-sha', fs: {}, dir: '/' })),
    relayUrl: vi.fn((owner: string, name: string) => `${owner}/${name}.git`),
    readWorkingFiles: vi.fn(async () => new Map(files)),
    commitFilesOnBranch: vi.fn(async () => 'new-sha'),
    push: vi.fn(async () => undefined),
    session: SESSION,
    openRepo: vi.fn(async () => {
      const stored = records.get('project-1')?.source;
      const branch =
        stored && stored.kind === 'github' ? stored.branch : BRANCH;
      return { fs: {}, dir: '/repo', branch };
    }),
    commitWorkspace: vi.fn(async (_id: string, message: string) => {
      messages.push(message);
      return 'new-sha';
    }),
    headSha: vi.fn(async () => 'new-sha'),
    fetch: vi.fn(async () => undefined),
    remoteHead: vi.fn(async () => null),
    unpushed: vi.fn(async () => []),
    rebaseOnto: vi.fn(async () => ({ tip: 'new-sha', backup: 'base-sha' })),
    resolveConflicts: vi.fn(() => ({})),
  };
  return { repo, messages };
}

/** Build send/update dependencies with an in-memory repository and registry. */
async function makeDeps(
  project: ProjectRecord,
  options: MakeOptions = {},
): Promise<Harness> {
  const { registry, records } = makeRegistry(project);
  const { repo, messages } = makeRepoDeps(records, options);

  const deps: SendSuggestionDeps = {
    ...repo,
    registry,
    applyName: makeApplyName(records),
    findSuggestionPull: vi.fn(async () => options.existingPull ?? null),
    createPullRequest: vi.fn(async () => ({ number: 7, url: PR_URL })),
  };

  return { deps, records, messages };
}

describe('sendSuggestion', () => {
  it('names an unpushed draft, saves with the send message and opens the pull request', async () => {
    const { deps, records, messages } = await makeDeps(
      record(source({ branch: 'od-octocat/untitled-draft', pushed: false })),
    );

    const result = await sendSuggestion(
      'project-1',
      { name: 'Paper', note: 'Please review.' },
      deps,
    );

    expect(deps.applyName).toHaveBeenCalledWith('project-1', 'Paper');
    expect(messages).toEqual([SEND_MESSAGE]);
    expect(deps.createPullRequest).toHaveBeenCalledWith('konsulin-care', 'draft', {
      title: 'What did you change?',
      body: 'Please review.',
      head: `octocat:${BRANCH}`,
      base: 'main',
    });
    expect(result).toEqual({ kind: 'created', number: 7, url: PR_URL });
    expect(records.get('project-1')?.source).toMatchObject({
      pushed: true,
      pullNumber: 7,
    });
  });
});

describe('sendSuggestion title', () => {
  it('uses the trimmed input title for both the commit message and the pull request', async () => {
    const { deps, messages } = await makeDeps(record(source()));

    const result = await sendSuggestion(
      'project-1',
      { title: '  Fix the config  ', note: 'Please review.' },
      deps,
    );

    expect(messages).toEqual(['Fix the config']);
    expect(deps.createPullRequest).toHaveBeenCalledWith('konsulin-care', 'draft', {
      title: 'Fix the config',
      body: 'Please review.',
      head: `octocat:${BRANCH}`,
      base: 'main',
    });
    expect(result).toEqual({ kind: 'created', number: 7, url: PR_URL });
  });

  it('falls back to SEND_MESSAGE when the title is blank', async () => {
    const { deps, messages } = await makeDeps(record(source()));

    await sendSuggestion('project-1', { title: '   ' }, deps);

    expect(messages).toEqual([SEND_MESSAGE]);
    expect(deps.createPullRequest).toHaveBeenCalledWith('konsulin-care', 'draft', {
      title: SEND_MESSAGE,
      body: '',
      head: `octocat:${BRANCH}`,
      base: 'main',
    });
  });
});

describe('sendSuggestion retry', () => {
  it('reuses an existing pull request after a failed creation instead of opening a duplicate', async () => {
    const existing = { number: 7, url: PR_URL, state: 'open' as const };
    const { deps } = await makeDeps(record(source()), {
      edited: false,
      existingPull: existing,
    });

    const result = await sendSuggestion('project-1', { note: 'Retry' }, deps);

    expect(deps.findSuggestionPull).toHaveBeenCalledWith(
      'konsulin-care',
      'draft',
      `octocat:${BRANCH}`,
    );
    expect(deps.createPullRequest).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'updated', number: 7, url: PR_URL });
  });
});

describe('sendSuggestion pull request lookup', () => {
  it('qualifies the head with the owner when the branch lives on the upstream', async () => {
    const { deps } = await makeDeps(record(source({ owner: 'konsulin-care' })));
    await sendSuggestion('project-1', { note: 'Please review.' }, deps);

    expect(deps.findSuggestionPull).toHaveBeenCalledWith('konsulin-care', 'draft', UPPER_HEAD);
    expect(deps.createPullRequest).toHaveBeenCalledWith('konsulin-care', 'draft', {
      title: SEND_MESSAGE, body: 'Please review.', head: UPPER_HEAD, base: 'main',
    });
  });

  it('opens a new pull request when the latest one for the head is merged or closed', async () => {
    for (const state of ['merged', 'closed'] as const) {
      const existing = { number: 6, url: PR_URL, state };
      const { deps } = await makeDeps(record(source()), { existingPull: existing });

      const result = await sendSuggestion('project-1', { note: 'More' }, deps);

      expect(deps.createPullRequest).toHaveBeenCalled();
      expect(result).toEqual({ kind: 'created', number: 7, url: PR_URL });
    }
  });

  it('propagates the GitHub error when the pull request cannot be created', async () => {
    const { deps } = await makeDeps(record(source()));
    vi.mocked(deps.createPullRequest).mockRejectedValue(new Error('no commits between'));

    await expect(sendSuggestion('project-1', { note: 'More' }, deps)).rejects.toThrow('no commits between');
  });
});

describe('sendUpdate', () => {
  it('pushes with the "What\'s new?" text and never creates a pull request', async () => {
    const { deps, messages } = await makeDeps(record(source({ pullNumber: 5 })));

    const result = await sendUpdate(
      'project-1',
      { message: "What's new?" },
      deps,
    );

    expect(messages).toEqual(["What's new?"]);
    expect(result).toEqual({ kind: 'saved', sha: 'new-sha' });
    expect(deps.findSuggestionPull).not.toHaveBeenCalled();
    expect(deps.createPullRequest).not.toHaveBeenCalled();
  });

  it('falls back to the automatic commit message when no text is given', async () => {
    const { deps, messages } = await makeDeps(record(source({ pullNumber: 5 })));

    const result = await sendUpdate('project-1', {}, deps);

    expect(messages).toEqual(['Update opendraft.yml']);
    expect(result).toEqual({ kind: 'saved', sha: 'new-sha' });
    expect(deps.createPullRequest).not.toHaveBeenCalled();
  });
});
