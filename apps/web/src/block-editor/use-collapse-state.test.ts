import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { blockCollapseStorageKey, useCollapseState } from './use-collapse-state';

/** Project identifier used by the primary fixture. */
const PROJECT = 'proj-alpha';

/** Second project identifier proving the storage key is project-scoped. */
const OTHER_PROJECT = 'proj-beta';

/** Block short names known to the editor fixture. */
const BLOCKS = ['intro', 'methods'];

/** Clear persisted state between tests. */
beforeEach(() => {
  localStorage.clear();
});

/**
 * Read the persisted collapse payload for a project.
 *
 * @param projectKey - Project identifier scoping the storage key.
 * @returns The parsed map, or null when the project has no stored state.
 */
function storedFor(projectKey: string): Record<string, boolean> | null {
  const raw = localStorage.getItem(blockCollapseStorageKey(projectKey));
  if (raw === null) return null;
  return JSON.parse(raw) as Record<string, boolean>;
}

describe('collapse persistence', () => {
  it("persists each block's collapsed state under a project-scoped storage key", () => {
    const { result } = renderHook(() => useCollapseState(PROJECT, BLOCKS));

    act(() => result.current.toggle('intro'));
    act(() => result.current.toggle('methods'));
    act(() => result.current.toggle('intro'));

    expect(storedFor(PROJECT)).toEqual({ intro: false, methods: true });

    const other = renderHook(() => useCollapseState(OTHER_PROJECT, BLOCKS));
    act(() => other.result.current.toggle('methods'));

    expect(blockCollapseStorageKey(PROJECT)).not.toBe(blockCollapseStorageKey(OTHER_PROJECT));
    expect(storedFor(PROJECT)).toEqual({ intro: false, methods: true });
    expect(storedFor(OTHER_PROJECT)).toEqual({ methods: true });
  });
});

describe('collapse restoration', () => {
  it('restores the persisted collapse state when the editor loads', () => {
    localStorage.setItem(
      blockCollapseStorageKey(PROJECT),
      JSON.stringify({ intro: true, methods: false }),
    );

    const { result } = renderHook(() => useCollapseState(PROJECT, BLOCKS));

    expect(result.current.isCollapsed('intro')).toBe(true);
    expect(result.current.isCollapsed('methods')).toBe(false);
    expect(result.current.isCollapsed('refs')).toBe(false);

    const other = renderHook(() => useCollapseState(OTHER_PROJECT, BLOCKS));
    expect(other.result.current.isCollapsed('intro')).toBe(false);
  });
});

describe('collapse-all and expand-all', () => {
  it('collapse-all collapses every block and expand-all expands every block', () => {
    const blocks = ['intro', 'methods', 'refs'];
    const { result } = renderHook(() => useCollapseState(PROJECT, blocks));

    act(() => result.current.collapseAll());
    expect(blocks.every((short) => result.current.isCollapsed(short))).toBe(true);
    expect(storedFor(PROJECT)).toEqual({ intro: true, methods: true, refs: true });

    act(() => result.current.expandAll());
    expect(blocks.every((short) => result.current.isCollapsed(short))).toBe(false);
    expect(storedFor(PROJECT)).toEqual({ intro: false, methods: false, refs: false });
  });
});
