import { splitHeading } from './heading';
import type { BlockHeading } from './heading';

/**
 * Split a loaded block file into its canonical heading and body.
 *
 * A class-less heading stays class-less: only a file with no leading heading
 * falls back to the generic type, the fallback title and the `sec-<short>` anchor.
 *
 * @param fileText - Loaded block file text.
 * @param fallbackTitle - Title used when the file has no leading heading.
 * @param short - Short name used for the fallback anchor.
 * @param genericType - Section type given to a file with no leading heading.
 * @returns The heading to reattach on every save and the heading-less body.
 */
export function captureLoadedHeading(
  fileText: string,
  fallbackTitle: string,
  short: string,
  genericType: string,
): { heading: BlockHeading; body: string } {
  const parts = splitHeading(fileText);
  return {
    heading: {
      title: parts.title ?? fallbackTitle,
      anchor: parts.anchor ?? `sec-${short}`,
      type: parts.title === null ? genericType : parts.type,
    },
    body: parts.body,
  };
}
