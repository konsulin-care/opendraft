import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDBWorkspace } from '@opendraft/workspace';
import {
  COMPLETE_MARKER,
  loadSnapshot,
  readerWorkspaceId,
  saveSnapshot,
} from './reader-cache';

const OWNER = 'Konsulin-Care';
const REPO = 'Citizen-Science';
const SHA = 'ABC123DEF';
const ID = 'reader-konsulin-care-citizen-science-abc123def';

const FILES = new Map<string, string>([
  ['opendraft.yml', 'title: Demo'],
  ['manuscripts/chapter one.qmd', '---\ntitle: One\n---\n'],
  ['README.md', '# Demo'],
]);

describe('readerWorkspaceId', () => {
  it('builds a lowercased reader workspace id', () => {
    expect(readerWorkspaceId(OWNER, REPO, SHA)).toBe(ID);
  });
});

describe('saveSnapshot / loadSnapshot', () => {
  it('returns a saved snapshot without the marker file', async () => {
    await saveSnapshot(OWNER, REPO, SHA, FILES);

    const loaded = await loadSnapshot(OWNER, REPO, SHA);

    expect(loaded).not.toBeNull();
    expect([...(loaded as Map<string, string>).entries()].sort()).toEqual(
      [...FILES.entries()].sort(),
    );
    expect(loaded?.has(COMPLETE_MARKER)).toBe(false);
  });

  it('returns null for an unknown sha', async () => {
    await saveSnapshot(OWNER, REPO, SHA, FILES);

    await expect(loadSnapshot(OWNER, REPO, 'othersha')).resolves.toBeNull();
  });

  it('returns null for a snapshot written without the completion marker', async () => {
    const partialSha = 'NOMARKER';
    const workspace = new IndexedDBWorkspace(readerWorkspaceId(OWNER, REPO, partialSha));
    await workspace.writeFile('opendraft.yml', 'title: Broken');
    await workspace.close();

    await expect(loadSnapshot(OWNER, REPO, partialSha)).resolves.toBeNull();
  });
});
