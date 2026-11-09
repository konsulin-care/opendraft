import type { WorkspaceAdapter } from '@opendraft/workspace';

/**
 * Append a BibTeX entry to the given bib file.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param bibPath - Path of the bib file.
 * @param bibtexEntry - The BibTeX entry string to append.
 */
export async function appendReference(
  workspace: WorkspaceAdapter,
  bibPath: string,
  bibtexEntry: string,
): Promise<void> {
  const existing = (await workspace.readFile(bibPath)) ?? '';
  const separator = existing.trimEnd() ? '\n\n' : '';
  await workspace.writeFile(bibPath, `${existing.trimEnd()}${separator}${bibtexEntry}\n`);
}

/**
 * Replace an existing BibTeX entry by citekey; appends when not found.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param bibPath - Path of the bib file.
 * @param citekey - The citekey to replace.
 * @param newEntry - The new BibTeX entry string.
 */
export async function replaceReference(
  workspace: WorkspaceAdapter,
  bibPath: string,
  citekey: string,
  newEntry: string,
): Promise<void> {
  const existing = (await workspace.readFile(bibPath)) ?? '';
  if (!existing) {
    await workspace.writeFile(bibPath, `${newEntry}\n`);
    return;
  }
  const entryRegex = new RegExp(
    `@[a-zA-Z]+\\s*\\{\\s*${escapeRegex(citekey)}\\s*,[\\s\\S]*?\\}`,
    'g',
  );
  if (entryRegex.test(existing)) {
    await workspace.writeFile(bibPath, existing.replace(entryRegex, newEntry));
  } else {
    await appendReference(workspace, bibPath, newEntry);
  }
}

/** Escape special regex characters. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
