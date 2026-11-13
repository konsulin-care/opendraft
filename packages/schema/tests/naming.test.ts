import { describe, it, expect } from 'vitest';
import {
  MANUSCRIPT_ID_PATTERN,
  SHORT_NAME_PATTERN,
  blockFileName,
  parseBlockFileName,
  legacyBlockShort,
  includeLine,
  BLOCK_INCLUDE_RE,
  sectionAnchor,
  SECTION_ROLES,
  sectionClass,
} from '../src/naming.js';

/** The 26 section-level DEO roles in contract order. */
const EXPECTED_ROLES = [
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'acknowledgements',
  'author-contribution',
  'background',
  'biography',
  'contribution',
  'data',
  'dataset-description',
  'dedication',
  'epilogue',
  'evaluation',
  'external-resource-description',
  'future-work',
  'materials',
  'model',
  'motivation',
  'postscript',
  'problem-statement',
  'prologue',
  'related-work',
  'scenario',
  'supplementary-information-description',
];

describe('naming: patterns', () => {
  it('MANUSCRIPT_ID_PATTERN accepts lowercase kebab ids only', () => {
    expect(MANUSCRIPT_ID_PATTERN.test('my-article-2')).toBe(true);
    expect(MANUSCRIPT_ID_PATTERN.test('a')).toBe(true);
    expect(MANUSCRIPT_ID_PATTERN.test('My-Article')).toBe(false);
    expect(MANUSCRIPT_ID_PATTERN.test('-lead')).toBe(false);
    expect(MANUSCRIPT_ID_PATTERN.test('trail-')).toBe(false);
    expect(MANUSCRIPT_ID_PATTERN.test('double--hyphen')).toBe(false);
  });

  it('SHORT_NAME_PATTERN caps length at 40 with no edge hyphen', () => {
    expect(SHORT_NAME_PATTERN.test('intro')).toBe(true);
    expect(SHORT_NAME_PATTERN.test('a')).toBe(true);
    expect(SHORT_NAME_PATTERN.test('a-b')).toBe(true);
    expect(SHORT_NAME_PATTERN.test('a'.repeat(40))).toBe(true);
    expect(SHORT_NAME_PATTERN.test('a'.repeat(41))).toBe(false);
    expect(SHORT_NAME_PATTERN.test('-intro')).toBe(false);
    expect(SHORT_NAME_PATTERN.test('intro-')).toBe(false);
    expect(SHORT_NAME_PATTERN.test('Intro')).toBe(false);
    expect(SHORT_NAME_PATTERN.test('under_score')).toBe(false);
  });
});

describe('naming: block file names', () => {
  it('blockFileName prefixes the underscore', () => {
    expect(blockFileName('introduction')).toBe('_introduction.qmd');
  });

  it('includeLine builds the Quarto include shortcode', () => {
    expect(includeLine('introduction')).toBe('{{< include blocks/_introduction.qmd >}}');
  });

  it('parseBlockFileName returns the short for valid prefixed names', () => {
    expect(parseBlockFileName('_intro.qmd')).toBe('intro');
    expect(parseBlockFileName('_a.qmd')).toBe('a');
  });

  it('parseBlockFileName rejects names that are not a valid _<short>.qmd', () => {
    expect(parseBlockFileName('intro.qmd')).toBeNull();
    expect(parseBlockFileName('_-intro.qmd')).toBeNull();
    expect(parseBlockFileName('_Intro.qmd')).toBeNull();
    expect(parseBlockFileName(`_${'a'.repeat(41)}.qmd`)).toBeNull();
    expect(parseBlockFileName('_.qmd')).toBeNull();
    expect(parseBlockFileName('_intro.md')).toBeNull();
  });

  it('legacyBlockShort matches only unprefixed legacy names', () => {
    expect(legacyBlockShort('intro.qmd')).toBe('intro');
    expect(legacyBlockShort('_intro.qmd')).toBeNull();
    expect(legacyBlockShort('Intro.qmd')).toBeNull();
    expect(legacyBlockShort(`${'a'.repeat(41)}.qmd`)).toBeNull();
    expect(legacyBlockShort('intro.md')).toBeNull();
  });
});

describe('naming: BLOCK_INCLUDE_RE', () => {
  it('captures the short from a prefixed include on its own line', () => {
    const match = BLOCK_INCLUDE_RE.exec('{{< include blocks/_intro.qmd >}}');
    expect(match?.[1]).toBe('intro');
    expect(BLOCK_INCLUDE_RE.test('{{< include blocks/_supplementary-information-description.qmd >}}')).toBe(true);
  });

  it('rejects unprefixed, embedded, and invalid includes', () => {
    expect(BLOCK_INCLUDE_RE.test('{{< include blocks/intro.qmd >}}')).toBe(false);
    expect(BLOCK_INCLUDE_RE.test('x {{< include blocks/_intro.qmd >}}')).toBe(false);
    expect(BLOCK_INCLUDE_RE.test('{{< include blocks/_Intro.qmd >}}')).toBe(false);
    expect(BLOCK_INCLUDE_RE.test(`{{< include blocks/_${'a'.repeat(41)}.qmd >}}`)).toBe(false);
    expect(BLOCK_INCLUDE_RE.test('{{< include blocks/_-intro.qmd >}}')).toBe(false);
  });
});

describe('naming: sections', () => {
  it('sectionAnchor prefixes sec-', () => {
    expect(sectionAnchor('introduction')).toBe('sec-introduction');
    expect(sectionAnchor('a-b')).toBe('sec-a-b');
  });

  it('sectionClass maps roles to deo- classes and null to doco-section', () => {
    expect(sectionClass('introduction')).toBe('deo-introduction');
    expect(sectionClass('supplementary-information-description')).toBe(
      'deo-supplementary-information-description',
    );
    expect(sectionClass(null)).toBe('doco-section');
  });

  it('SECTION_ROLES lists the 26 section-level DEO roles in kebab case', () => {
    expect(SECTION_ROLES).toEqual(EXPECTED_ROLES);
    expect(SECTION_ROLES).toHaveLength(26);
    expect(SECTION_ROLES[0]).toBe('introduction');
    expect(SECTION_ROLES[SECTION_ROLES.length - 1]).toBe('supplementary-information-description');
    for (const role of SECTION_ROLES) {
      expect(role).toMatch(SHORT_NAME_PATTERN);
      expect(role).toBe(role.toLowerCase());
    }
  });
});
