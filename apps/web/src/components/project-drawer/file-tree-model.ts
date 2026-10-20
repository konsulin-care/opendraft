/** Node of the rendered file tree; `children` is null for files. */
export interface TreeNode {
  /** Display name (single path segment). */
  name: string;
  /** Repo-relative path of this node. */
  path: string;
  /** Sorted child nodes for folders, null for files. */
  children: TreeNode[] | null;
}

/** Mutable insertion node used while building the tree. */
interface MutableNode {
  name: string;
  path: string;
  isDir: boolean;
  children: Map<string, MutableNode>;
}

/** A tree node paired with its nesting depth for indentation. */
export interface FlatItem {
  /** The node being rendered. */
  node: TreeNode;
  /** Nesting depth, starting at 0 for the root level. */
  depth: number;
}

/**
 * Recursively convert mutable insertion nodes into sorted tree nodes.
 *
 * @param node - Parent node whose children should be converted.
 * @returns The parent's children, folders first then alphabetically.
 */
function sortChildren(node: MutableNode): TreeNode[] {
  return [...node.children.values()]
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    })
    .map((child) => ({
      name: child.name,
      path: child.path,
      children: child.isDir ? sortChildren(child) : null,
    }));
}

/**
 * Build a folder tree from repo-relative file paths. Folders sort before
 * files at every level, each group ordered alphabetically.
 *
 * @param paths - Repo-relative file paths.
 * @returns Sorted root-level nodes.
 */
export function buildTree(paths: string[]): TreeNode[] {
  const root: MutableNode = { name: '', path: '', isDir: true, children: new Map() };
  for (const path of paths) {
    const segments = path.split('/').filter(Boolean);
    let node = root;
    segments.forEach((segment, index) => {
      let child = node.children.get(segment);
      if (!child) {
        child = {
          name: segment,
          path: segments.slice(0, index + 1).join('/'),
          isDir: index < segments.length - 1,
          children: new Map(),
        };
        node.children.set(segment, child);
      }
      node = child;
    });
  }
  return sortChildren(root);
}

/**
 * Flatten a tree into pre-order visible items for keyboard navigation.
 *
 * @param nodes - Nodes to flatten.
 * @param depth - Current nesting depth.
 * @param out - Accumulator for the flat list.
 * @returns Every visible node paired with its depth.
 */
export function flatten(nodes: TreeNode[], depth = 0, out: FlatItem[] = []): FlatItem[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children) flatten(node.children, depth + 1, out);
  }
  return out;
}

/**
 * Paths of `article.qmd` files that have a sibling `blocks/manifest.json`.
 *
 * @param paths - Every repo-relative file path in the workspace.
 * @returns Set of article paths whose blocks have been derived.
 */
export function findDerivedArticles(paths: string[]): Set<string> {
  const pathSet = new Set(paths);
  const derived = new Set<string>();
  for (const path of paths) {
    if (path.split('/').pop() !== 'article.qmd') continue;
    const dir = path.slice(0, path.lastIndexOf('/'));
    const manifest = dir ? `${dir}/blocks/manifest.json` : 'blocks/manifest.json';
    if (pathSet.has(manifest)) derived.add(path);
  }
  return derived;
}
