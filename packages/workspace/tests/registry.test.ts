import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { indexedDB } from 'fake-indexeddb';
import { ProjectRegistry } from '../src/registry.js';
import { REGISTRY_DB, workspaceDbName } from '../src/db-names.js';
import { workspaceManager } from '../src/manager.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Create a ProjectRegistry against a freshly deleted registry database.
 * @returns A new registry instance.
 */
async function freshRegistry(): Promise<ProjectRegistry> {
  await deleteDB(REGISTRY_DB);
  return new ProjectRegistry();
}

/**
 * List all IndexedDB database names.
 * @returns Database names currently present.
 */
async function dbNames(): Promise<(string | undefined)[]> {
  const dbs = await indexedDB.databases();
  return dbs.map((db: { name?: string }) => db.name);
}

describe('ProjectRegistry.create and list', () => {
  let registry: ProjectRegistry;

  beforeEach(async () => {
    registry = await freshRegistry();
  });

  afterEach(async () => {
    await registry.close();
  });

  it('create returns a record with a UUID id, name and local source', async () => {
    const record = await registry.create('Paper A');
    expect(record.id).toMatch(UUID_RE);
    expect(record.name).toBe('Paper A');
    expect(record.source).toEqual({ kind: 'local' });
  });

  it('list orders by lastOpenedAt descending and touch moves a project to the front', async () => {
    const a = await registry.create('Paper A');
    await registry.create('Paper B');
    await registry.create('Paper C');

    let list = await registry.list();
    expect(list.map((p) => p.name)).toEqual(['Paper C', 'Paper B', 'Paper A']);

    await registry.touch(a.id);
    list = await registry.list();
    expect(list[0].id).toBe(a.id);
    expect(list).toHaveLength(3);
  });
});

describe('ProjectRegistry.rename and lastPath meta', () => {
  let registry: ProjectRegistry;

  beforeEach(async () => {
    registry = await freshRegistry();
  });

  afterEach(async () => {
    await registry.close();
  });

  it('rename changes the name while the id stays the same', async () => {
    const record = await registry.create('Paper A');
    await registry.rename(record.id, 'Paper B');

    const updated = await registry.get(record.id);
    expect(updated?.name).toBe('Paper B');
    expect(updated?.id).toBe(record.id);
  });

  it('setLastPath and getLastPath round-trip per project', async () => {
    const a = await registry.create('Paper A');
    const b = await registry.create('Paper B');

    expect(await registry.getLastPath(a.id)).toBeNull();

    await registry.setLastPath(a.id, 'manuscripts/a/article.qmd');
    await registry.setLastPath(b.id, 'manuscripts/b/references.bib');

    expect(await registry.getLastPath(a.id)).toBe('manuscripts/a/article.qmd');
    expect(await registry.getLastPath(b.id)).toBe('manuscripts/b/references.bib');
  });
});

describe('ProjectRegistry manuscript display names', () => {
  let registry: ProjectRegistry;

  beforeEach(async () => {
    registry = await freshRegistry();
  });

  afterEach(async () => {
    await registry.close();
  });

  it('setManuscriptDisplayName persists and getManuscriptDisplayName reads it after reopen', async () => {
    const record = await registry.create('Paper A');
    await registry.setManuscriptDisplayName(record.id, 'my-thesis', 'My Thesis');
    await registry.close();

    const next = new ProjectRegistry();
    try {
      expect(await next.getManuscriptDisplayName(record.id, 'my-thesis')).toBe('My Thesis');
    } finally {
      await next.close();
    }
  });

  it('getManuscriptDisplayName returns undefined for a project with no map', async () => {
    const record = await registry.create('Paper A');
    expect(record.manuscriptNames).toBeUndefined();
    expect(await registry.getManuscriptDisplayName(record.id, 'my-thesis')).toBeUndefined();
  });

  it('moveManuscriptKey reads the value under the new key and no longer under the old one', async () => {
    const record = await registry.create('Paper A');
    await registry.setManuscriptDisplayName(record.id, 'old', 'Old Name');

    await registry.moveManuscriptKey(record.id, 'old', 'new');

    expect(await registry.getManuscriptDisplayName(record.id, 'new')).toBe('Old Name');
    expect(await registry.getManuscriptDisplayName(record.id, 'old')).toBeUndefined();
  });

  it('moveManuscriptKey on a project without the field leaves records working', async () => {
    const record = await registry.create('Paper A');
    await registry.moveManuscriptKey(record.id, 'old', 'new');
    expect(await registry.getManuscriptDisplayName(record.id, 'new')).toBeUndefined();
    expect((await registry.get(record.id))?.name).toBe('Paper A');
  });
});

describe('ProjectRegistry.remove', () => {
  let registry: ProjectRegistry;

  beforeEach(async () => {
    registry = await freshRegistry();
  });

  afterEach(async () => {
    await registry.close();
  });

  it('leaves get undefined and deletes the od-ws-<id> database', async () => {
    const record = await registry.create('Paper A');
    const ws = await workspaceManager.get(record.id);
    await ws.writeFile('hello.md', 'hi');
    workspaceManager.release(record.id);
    expect(await dbNames()).toContain(workspaceDbName(record.id));

    await registry.remove(record.id);

    expect(await registry.get(record.id)).toBeUndefined();
    expect(await dbNames()).not.toContain(workspaceDbName(record.id));
  });
});

describe('ProjectRegistry persistence', () => {
  let registry: ProjectRegistry;

  beforeEach(async () => {
    registry = await freshRegistry();
  });

  afterEach(async () => {
    await registry.close();
  });

  it('persists data across a new ProjectRegistry instance', async () => {
    const record = await registry.create('Paper A');
    await registry.setLastPath(record.id, 'manuscripts/a/article.qmd');
    await registry.close();

    const next = new ProjectRegistry();
    try {
      const fetched = await next.get(record.id);
      expect(fetched).toEqual(record);
      expect(await next.getLastPath(record.id)).toBe('manuscripts/a/article.qmd');
      expect((await next.list()).map((p) => p.id)).toContain(record.id);
    } finally {
      await next.close();
    }
  });
});
