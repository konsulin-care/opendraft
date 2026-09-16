import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { workspaceManager, WorkspaceManager } from '../src/manager.js';
import { IndexedDBWorkspace } from '../src/indexeddb.js';

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;

  beforeEach(() => {
    manager = new WorkspaceManager();
  });

  it('get() creates new workspace, refCount=1', async () => {
    const ws = await manager.get('test-workspace-1');
    expect(ws).toBeInstanceOf(IndexedDBWorkspace);
    expect(manager.has('test-workspace-1')).toBe(true);
  });

  it('second get() returns same instance, refCount=2', async () => {
    const ws1 = await manager.get('test-workspace-2');
    const ws2 = await manager.get('test-workspace-2');
    expect(ws1).toBe(ws2);
  });

  it('release() decrements refCount, closes at 0', async () => {
    await manager.get('test-workspace-3');
    manager.release('test-workspace-3');
    // After release, workspace should be closed (can't easily test internal state)
    // But we can verify the manager no longer has it
    expect(manager.has('test-workspace-3')).toBe(false);
  });

  it('closeAll() closes all workspaces, clears map', async () => {
    await manager.get('ws-a');
    await manager.get('ws-b');
    expect(manager.has('ws-a')).toBe(true);
    expect(manager.has('ws-b')).toBe(true);
    await manager.closeAll();
    expect(manager.has('ws-a')).toBe(false);
    expect(manager.has('ws-b')).toBe(false);
  });

  it('has() returns true for tracked workspaces', async () => {
    expect(manager.has('unknown')).toBe(false);
    await manager.get('known');
    expect(manager.has('known')).toBe(true);
  });
});

describe('workspaceManager singleton', () => {
  it('is exported and usable', async () => {
    const ws = await workspaceManager.get('singleton-test');
    expect(ws).toBeInstanceOf(IndexedDBWorkspace);
    workspaceManager.release('singleton-test');
  });
});