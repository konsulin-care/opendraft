/**
 * Submit suggestion tests: creating a pull request, updating an open one, and
 * refusing to push when the stored pull request was merged or closed.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { fileDigest } from './file-diff';
import { submitSuggestion } from './submit';
import type { SubmitDeps } from './submit';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const BRANCH = 'opendraft/octocat/20260102-030405';
const CONFIG_OLD = 'project: old\n';
const CONFIG_NEW = 'project: new\n';
const PR_URL = 'https://github.com/konsulin-care/draft/pull/7';
const INPUT = { title: 'Add results', body: 'Please review.' } as const;

/** Build a GitHub project source for the submit tests. */
function source(overrides: Partial<ProjectSourceGitHub> = {}): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: false,
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

/** Build an edited workspace that saveToCopy can commit. */
async function editedWorkspace(): Promise<MemoryWorkspace> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile('opendraft.yml', CONFIG_NEW);
  return workspace;
}

/** In-memory registry double whose setSource is observable. */
function makeRegistry(project: ProjectRecord): {
  registry: SubmitDeps['registry'];
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

/** Build submit dependencies with inert save, GitHub and registry doubles. */
function makeDeps(
  project: ProjectRecord,
  overrides: Partial<SubmitDeps> = {},
): { deps: SubmitDeps; records: Map<string, ProjectRecord> } {
  const { registry, records } = makeRegistry(project);
  const files = new Map([['opendraft.yml', CONFIG_OLD]]);
  const deps: SubmitDeps = {
    registry,
    getWorkspace: vi.fn(async () => editedWorkspace()),
    clone: vi.fn(async () => ({ sha: 'base-sha', fs: {}, dir: '/' })),
    relayUrl: vi.fn((owner: string, repo: string) => `${owner}/${repo}.git`),
    readWorkingFiles: vi.fn(async () => new Map(files)),
    commitFilesOnBranch: vi.fn(async (_fs, _dir, commit) => {
      for (const [path, content] of commit.files) files.set(path, content);
      return 'new-sha';
    }),
    push: vi.fn(async () => undefined),
    session: SESSION,
    findSuggestionPull: vi.fn(async () => null),
    createPullRequest: vi.fn(async () => ({ number: 7, url: PR_URL })),
    ...overrides,
  };
  return { deps, records };
}

/** Assert the stored source after a successful create. */
function expectStoredSource(
  records: Map<string, ProjectRecord>,
  expected: Record<string, unknown>,
): void {
  const stored = records.get('project-1')?.source;
  expect(stored).toMatchObject({ kind: 'github', ...expected });
}

describe('submitSuggestion create', () => {
  it('opens a pull request on the upstream with a fork-qualified head and stores its number', async () => {
    const { deps, records } = makeDeps(record(source()));

    const result = await submitSuggestion('project-1', INPUT, deps);

    expect(deps.findSuggestionPull).not.toHaveBeenCalled();
    expect(deps.createPullRequest).toHaveBeenCalledWith('konsulin-care', 'draft', {
      title: INPUT.title,
      body: INPUT.body,
      head: `octocat:${BRANCH}`,
      base: 'main',
    });
    expect(result).toEqual({ kind: 'created', number: 7, url: PR_URL });
    expectStoredSource(records, {
      branch: BRANCH,
      pushed: true,
      syncedSha: 'new-sha',
      pullNumber: 7,
    });
  });

  it('uses the plain branch as head when the viewer writes to the upstream', async () => {
    const { deps } = makeDeps(
      record(
        source({
          owner: 'konsulin-care',
          upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
        }),
      ),
    );

    await submitSuggestion('project-1', INPUT, deps);

    expect(deps.createPullRequest).toHaveBeenCalledWith(
      'konsulin-care',
      'draft',
      expect.objectContaining({ head: BRANCH }),
    );
  });
});

describe('submitSuggestion update', () => {
  it('saves through saveToCopy and returns updated without opening a pull request when the pull is open', async () => {
    const { deps } = makeDeps(
      record(source({ pullNumber: 5, pushed: true, syncedSha: 'base-sha' })),
      {
        findSuggestionPull: vi.fn(async () => ({
          number: 5,
          url: PR_URL,
          state: 'open' as const,
        })),
      },
    );

    const result = await submitSuggestion('project-1', INPUT, deps);

    expect(deps.findSuggestionPull).toHaveBeenCalledWith(
      'konsulin-care',
      'draft',
      `octocat:${BRANCH}`,
    );
    expect(deps.push).toHaveBeenCalledWith({}, '/', 'octocat/draft.git', BRANCH);
    expect(deps.createPullRequest).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'updated', number: 5, url: PR_URL });
  });
});

describe('submitSuggestion closed', () => {
  it.each(['merged', 'closed'] as const)(
    'returns closed with state %s without pushing when the stored pull is %s',
    async (state) => {
      const { deps } = makeDeps(
        record(source({ pullNumber: 5, pushed: true })),
        {
          findSuggestionPull: vi.fn(async () => ({
            number: 5,
            url: PR_URL,
            state,
          })),
        },
      );

      const result = await submitSuggestion('project-1', INPUT, deps);

      expect(result).toEqual({ kind: 'closed', state });
      expect(deps.commitFilesOnBranch).not.toHaveBeenCalled();
      expect(deps.push).not.toHaveBeenCalled();
      expect(deps.createPullRequest).not.toHaveBeenCalled();
    },
  );
});
