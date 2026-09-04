/** Uplifting hints shown on an empty manuscript, picked one at random. */
export const PLACEHOLDER_HINTS = [
  "The first sentence is the hardest, let's write it now...",
  'Take a breath. Your first draft only needs to exist...',
  'Your ideas deserve to be written down, start here...',
  'Every discovery begins with one typed line...',
  'Every publication starts as a blank page like this one...',
] as const;

/**
 * Pick a placeholder hint at random.
 *
 * @param random - RNG returning a value in [0, 1); injectable for tests.
 * @returns One of {@link PLACEHOLDER_HINTS}.
 */
export function pickPlaceholderHint(random: () => number = Math.random): string {
  const index = Math.floor(random() * PLACEHOLDER_HINTS.length);
  return PLACEHOLDER_HINTS[Math.min(index, PLACEHOLDER_HINTS.length - 1)];
}