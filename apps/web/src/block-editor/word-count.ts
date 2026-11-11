/**
 * Word counting shared by the block list and the block body editor.
 *
 * The collapsed header is seeded from the block file at list-load time
 * while the mounted editor reports live counts; both go through
 * {@link countWords} so one section shows one consistent number before
 * and after its editor mounts.
 */

/**
 * Count whitespace-separated words in a text body.
 *
 * Leading and trailing whitespace is ignored and any whitespace run
 * separates words; markdown punctuation stays attached to its word, so
 * the count matches what the live editor reports for the same body.
 *
 * @param text - Text to measure, typically a block body without its heading.
 * @returns The number of words; 0 for blank text.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
