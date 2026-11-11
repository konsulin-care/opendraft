import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { useProjectDrawer } from './ProjectDrawer';
import type { FlatItem, TreeNode } from './file-tree-model';
import { buildTree, findDerivedArticles } from './file-tree-model';
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
  /** Path of the active file or directory; highlighted and marked `aria-selected`. */
  activePath: string | null;
  /** Open a path: files open the editor, folders open the manuscript view. */
  onOpen: (path: string) => void;
}

/** Shared rendering and navigation state threaded through tree rows. */
interface TreeContext {
  /** Path of the active file or directory, or null. */
  activePath: string | null;
  /** Paths classified as binary content. */
  binaryPaths: Set<string>;
  /** Article paths that have a derived blocks manifest. */
  derived: Set<string>;
  /** Paths of folders collapsed via their chevron. */
  collapsed: ReadonlySet<string>;
  /** Path of the row carrying the roving `tabIndex={0}`. */
  tabStopPath: string | undefined;
  /** Register or clear a row's DOM element for focus management. */
  registerItem: (path: string, el: HTMLSpanElement | null) => void;
  /** Update the focused path when a row receives DOM focus. */
  onItemFocus: (path: string) => void;
  /** Handle a click on a row. */
  onItemClick: (item: FlatItem) => void;
  /** Expand or collapse a folder row via its chevron. */
  onToggleCollapse: (path: string) => void;
}

/**
 * Flatten visible tree rows in pre-order, skipping the children of
 * collapsed folders so keyboard navigation matches what is rendered.
 *
 * @param nodes - Nodes to flatten.
 * @param collapsed - Paths of folders collapsed via their chevron.
 * @param depth - Current nesting depth, starting at 0.
 * @param out - Accumulator for the flat list.
 * @returns Every visible node paired with its depth.
 */
function flattenVisible(
  nodes: TreeNode[],
  collapsed: ReadonlySet<string>,
  depth = 0,
  out: FlatItem[] = [],
): FlatItem[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children && !collapsed.has(node.path)) {
      flattenVisible(node.children, collapsed, depth + 1, out);
    }
  }
  return out;
}

/**
 * Toggle a folder path in the collapsed set.
 *
 * @param prev - Current collapsed paths.
 * @param path - Folder path to toggle.
 * @returns A new set with the path added or removed.
 */
function togglePath(prev: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const next = new Set(prev);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

/**
 * Render one tree node as a `treeitem` row and, for folders, its nested
 * `group` of child rows. A folder row carries an aria-hidden chevron that
 * toggles collapse; clicking the label opens the folder's path.
 *
 * @param props - The node, its depth, and the shared {@link TreeContext}.
 */
function TreeItem({ node, depth, ctx }: { node: TreeNode; depth: number; ctx: TreeContext }) {
  const isFile = node.children === null;
  const disabled = isFile && ctx.binaryPaths.has(node.path);
  const isSelected = node.path === ctx.activePath;
  const isCollapsed = ctx.collapsed.has(node.path);
  return (
    <li key={node.path}>
      <span
        ref={(el) => ctx.registerItem(node.path, el)}
        role="treeitem"
        tabIndex={node.path === ctx.tabStopPath ? 0 : -1}
        aria-expanded={isFile ? undefined : !isCollapsed}
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
        {!isFile && (
          <span
            aria-hidden="true"
            tabIndex={-1}
            onClick={(event) => { event.stopPropagation(); ctx.onToggleCollapse(node.path); }}
            className="shrink-0 cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
        <span className="truncate">{node.name}</span>
        {ctx.derived.has(node.path) && (
          <span className="ml-1 shrink-0 rounded bg-gray-100 px-1 text-[10px] text-gray-500">
            {DERIVED_BADGE_TEXT}
          </span>
        )}
      </span>
      {node.children && !isCollapsed && (
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
 * files, `aria-expanded` ancestors, `aria-selected` active path, arrow-key
 * navigation with Enter to open, binary files disabled, and a "derived"
 * badge on articles whose blocks manifest exists. Folder rows open on
 * label click (the manuscript view) and collapse via their chevron.
 *
 * @param props - See {@link FileTreeProps}.
 */
export function FileTree({ paths, workspace, activePath, onOpen }: FileTreeProps) {
  const { onFileSelected } = useProjectDrawer();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const roots = useMemo(() => buildTree(paths), [paths]);
  const items = useMemo(() => flattenVisible(roots, collapsed), [roots, collapsed]);
  const derived = useMemo(() => findDerivedArticles(paths), [paths]);
  const binaryPaths = useBinaryPaths(paths, workspace);

  /** Open a row: binary files are ignored, folders open the manuscript view. */
  const openItem = (item: FlatItem): void => {
    if (item.node.children === null && binaryPaths.has(item.node.path)) return;
    onOpen(item.node.path);
    onFileSelected();
  };

  /** Expand or collapse a folder row via its chevron. */
  const toggleCollapse = (path: string): void => {
    setCollapsed((prev) => togglePath(prev, path));
  };

  const nav = useTreeNavigation(items, activePath, openItem);

  /** Focus the clicked row and open it (folders navigate, files open). */
  const onItemClick = (item: FlatItem): void => {
    nav.setFocusedPath(item.node.path);
    openItem(item);
  };

  const ctx: TreeContext = {
    activePath, binaryPaths, derived, collapsed,
    tabStopPath: nav.tabStopPath, registerItem: nav.registerItem,
    onItemFocus: nav.setFocusedPath, onItemClick, onToggleCollapse: toggleCollapse,
  };

  return (
    <ul role="tree" aria-label="Project files" onKeyDown={nav.handleKeyDown} className="select-none py-1">
      {roots.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} ctx={ctx} />
      ))}
    </ul>
  );
}
