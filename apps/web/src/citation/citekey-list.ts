import type { Reference } from '@opendraft/references';

/**
 * Filter citekeys by query string.
 *
 * Matches against citekey, author, and title fields.
 * Case-insensitive matching.
 *
 * @param items - Array of references to filter.
 * @param query - Search query string.
 * @returns Filtered array of references matching the query.
 */
export function filterCitekeys(items: Reference[], query: string): Reference[] {
  if (!query) return items;

  const lowerQuery = query.toLowerCase();

  return items.filter((item) => {
    // Match against citekey
    if (item.citeKey.toLowerCase().includes(lowerQuery)) return true;

    // Match against author field
    const author = item.fields.author ?? '';
    if (author.toLowerCase().includes(lowerQuery)) return true;

    // Match against title field
    const title = item.fields.title ?? '';
    if (title.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
}
