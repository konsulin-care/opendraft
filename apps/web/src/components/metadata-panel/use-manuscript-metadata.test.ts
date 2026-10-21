import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { MemoryWorkspace } from '@opendraft/workspace';
import { useManuscriptMetadata } from './use-manuscript-metadata';

// @vitest-environment jsdom

const ROOT = 'manuscripts/x';
const FRONTMATTER = '# Front matter comment\ntitle: "Old"\ncustom: 1\n';

/** A workspace adapter whose writes are recorded per path. */
interface TrackedWorkspace {
  /** Adapter to pass to the hook. */
  ws: WorkspaceAdapter;
  /** One entry per writeFile call, in call order. */
  writes: { path: string; content: string }[];
}

/**
 * Wrap an in-memory workspace so tests can count writes.
 *
 * @param seed - Files to pre-populate, keyed by repo-relative path.
 * @returns The adapter and the recorded write log.
 */
async function trackedWorkspace(seed: Record<string, string> = {}): Promise<TrackedWorkspace> {
  const inner = new MemoryWorkspace();
  for (const [path, content] of Object.entries(seed)) await inner.writeFile(path, content);
  const writes: TrackedWorkspace['writes'] = [];
  const ws: WorkspaceAdapter = {
    readFile: (path) => inner.readFile(path),
    writeFile: async (path, content) => {
      writes.push({ path, content });
      await inner.writeFile(path, content);
    },
    deleteFile: (path) => inner.deleteFile(path),
    listFiles: (dir) => inner.listFiles(dir),
    listAll: () => inner.listAll(),
  };
  return { ws, writes };
}

/**
 * Render the hook against a workspace and drain the initial load.
 *
 * Memory-workspace reads resolve on microtasks only, so one act flush
 * (fake timers are active) settles the load deterministically.
 *
 * @param ws - Workspace adapter under test.
 * @returns The renderHook result after metadata has settled.
 */
async function bootHook(ws: WorkspaceAdapter) {
  const rendered = renderHook(() => useManuscriptMetadata(ws, ROOT));
  await act(async () => {});
  expect(rendered.result.current.loaded).toBe(true);
  return rendered;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loading', () => {
  it('loads title, authors and abstract', async () => {
    const { ws } = await trackedWorkspace({
      [`${ROOT}/_frontmatter.yml`]: FRONTMATTER,
      [`${ROOT}/_author.yml`]: 'authors:\n  - name: Jane Doe\n',
      [`${ROOT}/_abstract.yml`]: 'abstract: |\n  Some text.\n',
    });
    const rendered = await bootHook(ws);
    expect(rendered.result.current.title).toBe('Old');
    expect(rendered.result.current.authors).toHaveLength(1);
    expect(rendered.result.current.abstract).toBe('Some text.\n');
  });

  it('yields an empty author list when _author.yml is missing', async () => {
    const { ws } = await trackedWorkspace({ [`${ROOT}/_frontmatter.yml`]: FRONTMATTER });
    const rendered = await bootHook(ws);
    expect(rendered.result.current.authors).toEqual([]);
    expect(rendered.result.current.title).toBe('Old');
  });

  it('tolerates unparsable files without throwing', async () => {
    const { ws } = await trackedWorkspace({
      [`${ROOT}/_frontmatter.yml`]: '{{{ not yaml',
      [`${ROOT}/_author.yml`]: 'authors: [oops',
      [`${ROOT}/_abstract.yml`]: ':\n:\n',
    });
    const rendered = await bootHook(ws);
    expect(rendered.result.current.title).toBe('');
    expect(rendered.result.current.authors).toEqual([]);
    expect(rendered.result.current.abstract).toBeUndefined();
  });
});

describe('setTitle', () => {
  it('writes _frontmatter.yml after 800ms keeping comments and unknown keys', async () => {
    const { ws, writes } = await trackedWorkspace({
      [`${ROOT}/_frontmatter.yml`]: FRONTMATTER,
    });
    const rendered = await bootHook(ws);
    act(() => rendered.result.current.setTitle('New'));
    expect(rendered.result.current.title).toBe('New');
    expect(writes).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(800); });
    const written = writes.filter((w) => w.path === `${ROOT}/_frontmatter.yml`);
    expect(written).toHaveLength(1);
    expect(written[0].content).toContain('# Front matter comment');
    expect(written[0].content).toContain('custom: 1');
    expect(written[0].content).toMatch(/^title: ['"]?New['"]?$/m);
  });

  it('collapses two rapid edits into a single write', async () => {
    const { ws, writes } = await trackedWorkspace({
      [`${ROOT}/_frontmatter.yml`]: FRONTMATTER,
    });
    const rendered = await bootHook(ws);
    act(() => rendered.result.current.setTitle('A'));
    await act(async () => { vi.advanceTimersByTime(400); });
    act(() => rendered.result.current.setTitle('B'));
    await act(async () => { vi.advanceTimersByTime(800); });
    const written = writes.filter((w) => w.path === `${ROOT}/_frontmatter.yml`);
    expect(written).toHaveLength(1);
    expect(written[0].content).toMatch(/^title: ['"]?B['"]?$/m);
  });
});

describe('reload', () => {
  it('picks up an externally written _author.yml', async () => {
    const { ws } = await trackedWorkspace({
      [`${ROOT}/_author.yml`]: 'authors:\n  - name: Jane Doe\n',
    });
    const rendered = await bootHook(ws);
    expect(rendered.result.current.authors).toHaveLength(1);
    await act(async () => {
      await ws.writeFile(`${ROOT}/_author.yml`, 'authors:\n  - name: Ada Lovelace\n');
    });
    await act(async () => { await rendered.result.current.reload(); });
    expect(rendered.result.current.authors).toHaveLength(1);
    expect(rendered.result.current.authors[0].name).toBe('Ada Lovelace');
  });
});
