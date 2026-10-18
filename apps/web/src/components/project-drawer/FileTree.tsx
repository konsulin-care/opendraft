import { useCallback, useMemo } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { useProjectDrawer } from './ProjectDrawer';
import type { FlatItem, TreeNode } from './file-tree-model';
import { buildTree, findDerivedArticles, flatten } from './file-tree-model';
import { useBinaryPaths, useTreeNavigation } from './use-file-tree-navigation';

/** Badge shown on an article whose blocks have been derived. */
const DERIVED_BADGE_TEXT = 'derived';

/** Tooltip explaining why a binary file cannot be opened. */
const BINARY_TITLE = 'Binary files are not supported';

/** Props for {@link FileTree}. */
export interface FileTreeProps {
  /** Every repo-relative file path in the project workspace. */
  paths: string[];
  /** Workspace used to classify file content (binary detection). */
  workspace: WorkspaceAdapter;
  /** Path of the active file; highlighted and marked `aria-selected`. */
  activePath: string | null;
  /** Open a file. Never called for folders or binary files. */
  onOpen: (path: string) => void;
}

/** Shared rendering and navigation state threaded through tree rows. */
interface TreeContext {
  /** Path of the active file, or null. */
  activePath: string | null;
  /** Paths classified as binary content. */
  binaryPaths: Set<string>;
  /** Article paths that have a derived blocks manifest. */
  derived: Set<string>;
  /** Path of the row carrying the roving `tabIndex={0}`. */
  tabStopPath: string | undefined;
  /** Register or clear a row's DOM element for focus management. */
  registerItem: (path: string, el: HTMLSpanElement | null) => void;
  /** Update the focused path when a row receives DOM focus. */
  onItemFocus: (path: string) => void;
  /** Handle a click on a row. */
  onItemClick: (item: FlatItem) => void;
}

/**
 * Render one tree node as a `treeitem` row and, for folders, its nested
 * `group` of child rows.
 *
 * @param props - The node, its depth, and the shared {@link TreeContext}.
 */
function TreeItem({ node, depth, ctx }: { node: TreeNode; depth: number; ctx: TreeContext }) {
  const isFile = node.children === null;
  const disabled = isFile && ctx.binaryPaths.has(node.path);
  const isSelected = isFile && node.path === ctx.activePath;
  return (
    <li key={node.path}>
      <span
        ref={(el) => ctx.registerItem(node.path, el)}
        role="treeitem"
        tabIndex={node.path === ctx.tabStopPath ? 0 : -1}
        aria-expanded={isFile ? undefined : true}
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        title={disabled ? BINARY_TITLE : undefined}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onFocus={() => ctx.onItemFocus(node.path)}
        onClick={() => ctx.onItemClick({ node, depth })}
        className={`flex w-full items-center gap-1 py-1 pr-2 text-left text-sm outline-none focus-visible:bg-gray-100 ${
          isSelected ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'
        } ${disabled ? 'cursor-not-allowed text-gray-400' : 'hover:bg-gray-50'}`}
      >
        <span className="truncate">{node.name}</span>
        {ctx.derived.has(node.path) && (
          <span className="ml-1 shrink-0 rounded bg-gray-100 px-1 text-[10px] text-gray-500">
            {DERIVED_BADGE_TEXT}
          </span>
        )}
      </span>
      {node.children && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Project file tree following the WAI-ARIA tree pattern: folders before
 * files, `aria-expanded` ancestors, `aria-selected` active file, arrow-key
 * navigation with Enter to open, binary files disabled, and a "derived"
 * badge on articles whose blocks manifest exists.
 *
 * @param props - See {@link FileTreeProps}.
 */
export function FileTree({ paths, workspace, activePath, onOpen }: FileTreeProps) {
  const { onFileSelected } = useProjectDrawer();
  const roots = useMemo(() => buildTree(paths), [paths]);
  const items = useMemo(() => flatten(roots), [roots]);
  const derived = useMemo(() => findDerivedArticles(paths), [paths]);
  const binaryPaths = useBinaryPaths(paths, workspace);

  /** Open a file item: folders and binary files are ignored. */
  const openItem = useCallback(
    (item: FlatItem) => {
      if (item.node.children !== null || binaryPaths.has(item.node.path)) return;
      onOpen(item.node.path);
      onFileSelected();
    },
    [binaryPaths, onOpen, onFileSelected],
  );

  const nav = useTreeNavigation(items, activePath, openItem);

  /** Tree context shared with every row. */
  const ctx: TreeContext = {
    activePath,
    binaryPaths,
    derived,
    tabStopPath: nav.tabStopPath,
    registerItem: nav.registerItem,
    onItemFocus: nav.setFocusedPath,
    onItemClick: (item) => {
      nav.setFocusedPath(item.node.path);
      if (item.node.children === null) openItem(item);
    },
  };

  return (
    <ul
      role="tree"
      aria-label="Project files"
      onKeyDown={nav.handleKeyDown}
      className="select-none py-1"
    >
      {roots.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} ctx={ctx} />
      ))}
    </ul>
  );
}
