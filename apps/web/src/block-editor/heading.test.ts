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

  it("splits a class-less heading '# Custom {#sec-custom}' into a null type", () => {
    const text = '# Custom {#sec-custom}\n\nIntro paragraph.';
    const { title, anchor, type, body } = splitHeading(text);
    expect(title).toBe('Custom');
    expect(anchor).toBe('sec-custom');
    expect(type).toBeNull();
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

describe('splitHeading generic section class', () => {
  it("parses '.doco-section' as the generic type 'section'", () => {
    const text = '# Intro {#sec-intro .doco-section}\n\nBody.';
    const { type } = splitHeading(text);
    expect(type).toBe('section');
  });

  it("parses the legacy '.deo-section' as the generic type 'section'", () => {
    const text = '# Intro {#sec-intro .deo-section}\n\nBody.';
    const { type } = splitHeading(text);
    expect(type).toBe('section');
  });
});

describe('splitHeading/joinHeading round-trip', () => {
  it("round-trips a classed heading '# Methods {#sec-methods .deo-methods}'", () => {
    const text = '# Methods {#sec-methods .deo-methods}\n\nBody text.';
    const parts = splitHeading(text);
    expect(parts.type).toBe('methods');
    const rejoined = joinHeading(
      { title: 'Methods', anchor: 'sec-methods', type: parts.type },
      parts.body,
    );
    expect(rejoined).toBe(text);
  });

  it("round-trips a class-less heading '# Custom {#sec-custom}'", () => {
    const text = '# Custom {#sec-custom}\n\nBody text.';
    const parts = splitHeading(text);
    expect(parts.type).toBeNull();
    const rejoined = joinHeading(
      { title: 'Custom', anchor: 'sec-custom', type: parts.type },
      parts.body,
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

  it("writes the generic type 'section' as '.doco-section'", () => {
    const joined = joinHeading(
      { title: 'Intro', anchor: 'sec-intro', type: 'section' },
      'Intro paragraph.',
    );
    expect(joined.split('\n')[0]).toBe('# Intro {#sec-intro .doco-section}');
  });

  it("writes a role type as '.deo-<role>'", () => {
    const joined = joinHeading(
      { title: 'Methods', anchor: 'sec-methods', type: 'methods' },
      'Intro paragraph.',
    );
    expect(joined.split('\n')[0]).toBe('# Methods {#sec-methods .deo-methods}');
  });

  it('emits no class when the heading carries no role', () => {
    const joined = joinHeading({ title: 'Custom', anchor: 'sec-custom' }, 'Intro paragraph.');
    expect(joined.split('\n')[0]).toBe('# Custom {#sec-custom}');
  });
});
