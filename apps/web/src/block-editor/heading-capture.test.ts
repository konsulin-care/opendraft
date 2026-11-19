/**
 * Heading capture tests: a loaded file's canonical heading is reused on
 * every save, keeping a class-less heading class-less and defaulting a
 * heading-less file to the fallback title, anchor and generic type.
 */
import { describe, expect, it } from 'vitest';
import { captureLoadedHeading } from './heading-capture';

describe('captureLoadedHeading', () => {
  it('keeps a class-less heading class-less with its own title and anchor', () => {
    const { heading, body } = captureLoadedHeading(
      '# Methods {#sec-methods}\nBody text.\n',
      'Fallback',
      'fallback',
      'section',
    );
    expect(heading).toEqual({ title: 'Methods', anchor: 'sec-methods', type: null });
    expect(body).toBe('Body text.\n');
  });

  it('gives a file with no leading heading the fallback title, anchor and generic type', () => {
    const { heading, body } = captureLoadedHeading(
      'Plain body text.\n',
      'Methods',
      'methods',
      'section',
    );
    expect(heading).toEqual({ title: 'Methods', anchor: 'sec-methods', type: 'section' });
    expect(body).toBe('Plain body text.\n');
  });
});
