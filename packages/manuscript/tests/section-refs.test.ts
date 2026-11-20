import { describe, expect, it } from 'vitest';
import { countSectionRefs, rewriteSectionRefs } from '../src/section-refs';

describe('rewriteSectionRefs', () => {
  it('rewrites cross-reference keys at Pandoc key boundaries', () => {
    expect(rewriteSectionRefs('@sec-a', 'a', 'b')).toBe('@sec-b');
    expect(rewriteSectionRefs('[-@sec-a]', 'a', 'b')).toBe('[-@sec-b]');
    expect(rewriteSectionRefs('see @sec-a.', 'a', 'b')).toBe('see @sec-b.');
    expect(rewriteSectionRefs('@Sec-a', 'a', 'b')).toBe('@Sec-b');
  });

  it('leaves partial matches, embedded refs and code untouched', () => {
    const markdown = [
      '@sec-ab @sec-a-x @sec-a_x @sec-a.b x@sec-a',
      '```',
      '@sec-a',
      '```',
      'Inline `@sec-a` stays.',
    ].join('\n');

    expect(rewriteSectionRefs(markdown, 'a', 'b')).toBe([
      '@sec-ab @sec-a-x @sec-a_x @sec-a.b x@sec-a',
      '```',
      '@sec-a',
      '```',
      'Inline `@sec-a` stays.',
    ].join('\n'));
  });

  it('escapes regex special characters in the short name', () => {
    expect(rewriteSectionRefs('@sec-a.b', 'a.b', 'c')).toBe('@sec-c');
  });
});

describe('countSectionRefs', () => {
  it('counts only boundary-matching refs outside code', () => {
    const markdown = [
      '@sec-a and @Sec-a and [-@sec-a].',
      '@sec-ab @sec-a_x x@sec-a',
      '```',
      '@sec-a',
      '```',
      'Inline `@sec-a`.',
    ].join('\n');

    expect(countSectionRefs(markdown, 'a')).toBe(3);
  });
});
