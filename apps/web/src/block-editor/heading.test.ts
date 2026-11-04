import { describe, expect, it } from 'vitest';
import { joinHeading, splitHeading } from './heading';

describe('splitHeading', () => {
  it("splits '# Methods {#sec-methods .deo-methods}' into title, anchor, type and body", () => {
    const text = '# Methods {#sec-methods .deo-methods}\n\nIntro paragraph.';
    const { title, anchor, type, body } = splitHeading(text);
    expect(title).toBe('Methods');
    expect(anchor).toBe('sec-methods');
    expect(type).toBe('methods');
    expect(body).toBe('\nIntro paragraph.');
  });

  it('treats a file with no leading heading as body-only with no title', () => {
    const text = 'Just prose.\n\nMore prose.';
    const { title, anchor, type, body } = splitHeading(text);
    expect(title).toBeNull();
    expect(anchor).toBeNull();
    expect(type).toBeNull();
    expect(body).toBe(text);
  });

  it('keeps H2 and deeper headings inside the body unchanged', () => {
    const text =
      '# Methods {#sec-methods .deo-methods}\n\n## Sub section\n\nText.\n\n### Deeper point\n\nMore.';
    const { title, body } = splitHeading(text);
    expect(title).toBe('Methods');
    expect(body).toBe('\n## Sub section\n\nText.\n\n### Deeper point\n\nMore.');
    const rejoined = joinHeading(
      { title: 'Methods', anchor: 'sec-methods', type: 'methods' },
      body,
    );
    expect(rejoined).toBe(text);
  });
});

describe('joinHeading', () => {
  it("joins a body with its heading so the file's first line is the canonical heading", () => {
    const joined = joinHeading(
      { title: 'Methods', anchor: 'sec-methods', type: 'methods' },
      'Intro paragraph.',
    );
    expect(joined.split('\n')[0]).toBe('# Methods {#sec-methods .deo-methods}');
  });
});
