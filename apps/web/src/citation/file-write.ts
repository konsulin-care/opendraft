import type { WorkspaceAdapter } from '@opendraft/workspace';

const BIB_PATH = 'references.bib';

/**
 * Append a BibTeX entry to references.bib.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param bibtexEntry - The BibTeX entry string to append.
 */
export async function appendReference(
  workspace: WorkspaceAdapter,
  bibtexEntry: string,
): Promise<void> {
  const existing = (await workspace.readFile(BIB_PATH)) ?? '';
  const separator = existing.trimEnd() ? '\n\n' : '';
  await workspace.writeFile(BIB_PATH, `${existing.trimEnd()}${separator}${bibtexEntry}\n`);
}

/**
 * Replace an existing BibTeX entry by citekey.
 *
 * If the citekey is not found, the new entry is appended.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param citekey - The citekey to replace.
 * @param newEntry - The new BibTeX entry string.
 */
export async function replaceReference(
  workspace: WorkspaceAdapter,
  citekey: string,
  newEntry: string,
): Promise<void> {
  const existing = (await workspace.readFile(BIB_PATH)) ?? '';

  if (!existing) {
    await workspace.writeFile(BIB_PATH, `${newEntry}\n`);
    return;
  }

  // Match entry starting with @type{citekey, until the closing }
  // Handles both single-line and multi-line entries
  const entryRegex = new RegExp(
    `@[a-zA-Z]+\\s*\\{\\s*${escapeRegex(citekey)}\\s*,[\\s\\S]*?\\}`,
    'g',
  );

  if (entryRegex.test(existing)) {
    // Replace the existing entry
    const replaced = existing.replace(entryRegex, newEntry);
    await workspace.writeFile(BIB_PATH, replaced);
  } else {
    // Citekey not found, append
    await appendReference(workspace, newEntry);
  }
}

/** Escape special regex characters. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
