const DEFAULT_MAX = 140;

/**
 * Truncate a file name to at most `max` code points, keeping the tail.
 *
 * Names whose code-point length is <= `max` are returned unchanged. Longer
 * names are rendered as a leading ellipsis followed by the last `max - 1`
 * code points, so the total is always `max` code points. Splitting is done
 * by code points (`Array.from`) so multi-code-unit characters such as emoji
 * and accented astral-plane glyphs are never cut in half.
 *
 * @param name - The file name to format.
 * @param max - Maximum number of code points to keep (default 140).
 * @returns The unchanged name, or `'…'` plus the trailing code points.
 */
export function formatFileName(name: string, max: number = DEFAULT_MAX): string {
  const codePoints = Array.from(name);
  if (codePoints.length <= max) {
    return name;
  }
  return `…${codePoints.slice(-(max - 1)).join('')}`;
}
