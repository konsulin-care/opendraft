/**
 * Extract the bare package name from a module id emitted by Rollup.
 *
 * Uses the last `/node_modules/` segment so that pnpm's nested layout
 * (`.pnpm/<pkg>@<ver>/node_modules/<pkg>/…`) resolves to the real package.
 *
 * @param id - Absolute or relative module id.
 * @returns The package name, or undefined when the id is not a dependency.
 */
function packageName(id: string): string | undefined {
  const marker = '/node_modules/';
  const index = id.lastIndexOf(marker);
  if (index === -1) return undefined;

  const rest = id.slice(index + marker.length);
  const segments = rest.split('/');
  if (segments.length === 0 || segments[0] === '') return undefined;

  if (segments[0].startsWith('@')) {
    return segments.length > 1 ? `${segments[0]}/${segments[1]}` : segments[0];
  }
  return segments[0];
}

const CORE_CODEMIRROR = new Set([
  '@codemirror/state',
  '@codemirror/view',
  '@codemirror/language',
  '@codemirror/commands',
  '@codemirror/autocomplete',
  '@codemirror/search',
  '@codemirror/lang-markdown',
  '@codemirror/theme-one-dark',
]);

const CORE_LEZER = new Set([
  '@lezer/common',
  '@lezer/highlight',
  '@lezer/lr',
  '@lezer/markdown',
]);

const VENDOR_REACT = new Set(['react', 'react-dom', 'scheduler']);

/**
 * Decide whether a package belongs to a language-mode (non-core) chunk.
 *
 * @param pkg - Bare package name.
 * @returns True for `@codemirror/legacy-modes` and non-markdown `@codemirror/lang-*`.
 */
function isLanguageMode(pkg: string | undefined): boolean {
  if (!pkg) return false;
  if (pkg === '@codemirror/legacy-modes') return true;
  return pkg.startsWith('@codemirror/lang-') && pkg !== '@codemirror/lang-markdown';
}

/**
 * Map a module id to a vendor chunk name for Rollup `manualChunks`.
 *
 * @param id - Module id emitted by Rollup.
 * @returns The chunk name, or undefined to leave the module in its default chunk.
 */
export function vendorChunk(id: string): string | undefined {
  const pkg = packageName(id);
  if (!pkg) return undefined;

  if (VENDOR_REACT.has(pkg)) return 'vendor-react';

  if (
    pkg.startsWith('@milkdown/') ||
    pkg.startsWith('prosemirror-') ||
    pkg.startsWith('@prosemirror-adapter/')
  ) {
    return 'vendor-milkdown';
  }

  if (CORE_CODEMIRROR.has(pkg) || CORE_LEZER.has(pkg)) {
    return 'vendor-codemirror';
  }

  if (pkg === 'katex') return 'vendor-katex';

  return undefined;
}

/**
 * Choose the output filename pattern for a chunk.
 *
 * Chunks made only of language-mode packages are emitted under `@assets/lang/`;
 * every other chunk uses the default `@assets/` location.
 *
 * @param chunk - Chunk descriptor with the module ids it contains.
 * @returns The Rollup `chunkFileNames` pattern.
 */
export function chunkFileName(chunk: { moduleIds: string[] }): string {
  const ids = chunk.moduleIds;
  const langOnly =
    ids.length > 0 && ids.every((id) => isLanguageMode(packageName(id)));

  return langOnly
    ? '@assets/lang/[name]-[hash].js'
    : '@assets/[name]-[hash].js';
}
