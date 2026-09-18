import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkspace } from './useWorkspace.js';
import { workspaceManager } from '@opendraft/workspace';
import 'fake-indexeddb/auto';

describe('useWorkspace', () => {
  beforeEach(() => {});

  afterEach(() => {
    workspaceManager.closeAll();
  });

  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useWorkspace('test-hook-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.workspace).toBeNull();
    expect(result.current.markdown).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('loads markdown on success', async () => {
    const { result } = renderHook(() => useWorkspace('test-hook-2'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.workspace).not.toBeNull();
    expect(result.current.markdown).toBe('\n');
    expect(result.current.error).toBeNull();
  });
});