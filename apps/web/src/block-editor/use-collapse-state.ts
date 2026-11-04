/**
 * Block collapse state hook: per-block collapsed flags persisted under a
 * project-scoped localStorage key, with collapse-all and expand-all.
 *
 * Storage key: `opendraft:block-collapse:<projectKey>`. Payload shape:
 * `{ [blockShort]: boolean }` where `true` means collapsed. Reads and
 * writes are defensive: missing, corrupt or unavailable storage falls
 * back to the expanded default without throwing.
 */
import { useCallback, useEffect, useState } from 'react';

/** localStorage key prefix for the per-project block collapse state. */
const STORAGE_PREFIX = 'opendraft:block-collapse';

/** Collapsed flag per block short name; a missing block starts expanded. */
type CollapsedMap = Record<string, boolean>;

/**
 * localStorage key holding the collapsed state of one project's blocks.
 *
 * @param projectKey - Project identifier (registry id).
 * @returns The storage key for the project.
 */
export function blockCollapseStorageKey(projectKey: string): string {
  return `${STORAGE_PREFIX}:${projectKey}`;
}

/**
 * Read the persisted collapse state of one project.
 *
 * @param projectKey - Project identifier scoping the storage key.
 * @returns The stored map, or an empty map when absent, corrupt or unreadable.
 */
function readCollapsed(projectKey: string): CollapsedMap {
  try {
    const raw = localStorage.getItem(blockCollapseStorageKey(projectKey));
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const map: CollapsedMap = {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    for (const [short, flag] of entries) {
      if (typeof flag === 'boolean') map[short] = flag;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Persist the collapse state of one project.
 *
 * @param projectKey - Project identifier scoping the storage key.
 * @param collapsed - The map to write; storage errors are swallowed.
 */
function writeCollapsed(projectKey: string, collapsed: CollapsedMap): void {
  try {
    localStorage.setItem(blockCollapseStorageKey(projectKey), JSON.stringify(collapsed));
  } catch {
    // Storage unavailable: the state stays session-only.
  }
}

/**
 * Build a collapse map marking every given block with the same flag.
 *
 * @param blocks - Block short names known to the editor.
 * @param flag - Collapsed flag assigned to every block.
 * @returns A fresh map covering exactly `blocks`.
 */
function mapAll(blocks: readonly string[], flag: boolean): CollapsedMap {
  const map: CollapsedMap = {};
  for (const short of blocks) {
    map[short] = flag;
  }
  return map;
}

/** Value returned by {@link useCollapseState}. */
export interface UseCollapseStateResult {
  /** Whether the block is collapsed; blocks absent from the map are expanded. */
  isCollapsed: (short: string) => boolean;
  /** Flip one block's collapsed flag and persist the change. */
  toggle: (short: string) => void;
  /** Mark every known block collapsed and persist the change. */
  collapseAll: () => void;
  /** Mark every known block expanded and persist the change. */
  expandAll: () => void;
}

/**
 * Track and persist the per-block collapse state of one project.
 *
 * The map stored under the project-scoped key is restored on mount and
 * whenever `projectKey` changes; every toggle is written back to
 * localStorage so the editor loads with its previous collapse state.
 *
 * @param projectKey - Project identifier (registry id) scoping the storage key.
 * @param blocks - Block short names known to the editor.
 * @returns See {@link UseCollapseStateResult}.
 */
export function useCollapseState(
  projectKey: string,
  blocks: readonly string[],
): UseCollapseStateResult {
  const [collapsed, setCollapsed] = useState<CollapsedMap>(() => readCollapsed(projectKey));

  useEffect(() => {
    setCollapsed(readCollapsed(projectKey));
  }, [projectKey]);

  const persist = useCallback((next: CollapsedMap): void => {
    setCollapsed(next);
    writeCollapsed(projectKey, next);
  }, [projectKey]);

  const isCollapsed = useCallback(
    (short: string): boolean => collapsed[short] === true,
    [collapsed],
  );

  const toggle = useCallback(
    (short: string): void => {
      persist({ ...collapsed, [short]: !collapsed[short] });
    },
    [collapsed, persist],
  );

  const collapseAll = useCallback((): void => {
    persist(mapAll(blocks, true));
  }, [blocks, persist]);

  const expandAll = useCallback((): void => {
    persist(mapAll(blocks, false));
  }, [blocks, persist]);

  return { isCollapsed, toggle, collapseAll, expandAll };
}
