import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { getFileCapability } from '../../project/file-capability';
import type { FlatItem } from './file-tree-model';

/** Roving-focus state and keyboard handling exposed to the tree root. */
export interface TreeNavigation {
  /** Path of the row that currently holds focus. */
  focusedPath: string | null;
  /** Update the focused path. */
  setFocusedPath: (path: string) => void;
  /** Path of the row carrying the roving `tabIndex={0}`. */
  tabStopPath: string | undefined;
  /** Register or clear a row's DOM element for focus management. */
  registerItem: (path: string, el: HTMLSpanElement | null) => void;
  /** KeyDown handler implementing arrow-key navigation and Enter. */
  handleKeyDown: (event: ReactKeyboardEvent<HTMLUListElement>) => void;
}

/**
 * Classify every file once per paths/workspace change and return the set
 * of paths whose content is binary.
 *
 * @param paths - Every repo-relative file path in the workspace.
 * @param workspace - Workspace used to read file content.
 * @returns Set of paths classified as binary.
 */
export function useBinaryPaths(paths: string[], workspace: WorkspaceAdapter): Set<string> {
  const [binaryPaths, setBinaryPaths] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const binary = new Set<string>();
      for (const path of paths) {
        const content = await workspace.readFile(path);
        if (content !== null && getFileCapability(path, content) === 'binary') {
          binary.add(path);
        }
      }
      if (!cancelled) setBinaryPaths(binary);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths, workspace]);
  return binaryPaths;
}

/**
 * Roving-focus state for the tree: tracks the focused row, registers row
 * DOM elements, scrolls the active file into view, and implements the
 * WAI-ARIA keyboard pattern (ArrowUp/ArrowDown plus Enter to open).
 *
 * @param items - Flattened visible tree rows in pre-order.
 * @param activePath - Path of the active file, or null.
 * @param openItem - Open a row; folders and binary files are ignored.
 * @returns Navigation state and handlers for the tree root.
 */
export function useTreeNavigation(
  items: FlatItem[],
  activePath: string | null,
  openItem: (item: FlatItem) => void,
): TreeNavigation {
  const [focusedPath, setFocusedPath] = useState<string | null>(activePath);
  const itemRefs = useRef(new Map<string, HTMLSpanElement>());

  // Scroll the active file into view once its treeitem is rendered.
  useEffect(() => {
    if (!activePath) return;
    itemRefs.current.get(activePath)?.scrollIntoView?.({ block: 'nearest' });
  }, [activePath, items]);

  const registerItem = useCallback((path: string, el: HTMLSpanElement | null) => {
    if (el) itemRefs.current.set(path, el);
    else itemRefs.current.delete(path);
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (items.length === 0) return;
    let index = items.findIndex((item) => item.node.path === focusedPath);
    if (index < 0) index = 0;
    const clamp = (i: number) => items[Math.max(0, Math.min(i, items.length - 1))];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const target = clamp(index + (event.key === 'ArrowDown' ? 1 : -1));
      if (!target) return;
      setFocusedPath(target.node.path);
      itemRefs.current.get(target.node.path)?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openItem(items[index]);
    }
  };

  return {
    focusedPath,
    setFocusedPath,
    tabStopPath: focusedPath ?? activePath ?? items[0]?.node.path,
    registerItem,
    handleKeyDown,
  };
}
