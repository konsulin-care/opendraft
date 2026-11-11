import { describe, expect, it } from 'vitest';
import {
  extendedSectionTypePresets,
  sectionTypeClass,
  sectionTypePresets,
  sectionTypeRole,
} from './deo-types';

describe('sectionTypePresets', () => {
  it('returns the preset list Introduction, Methods, Results, Discussion, Conclusion with a title, short name and class for each', () => {
    const presets = sectionTypePresets();
    expect(presets.map((preset) => preset.title)).toEqual([
      'Introduction',
      'Methods',
      'Results',
      'Discussion',
      'Conclusion',
    ]);
    for (const preset of presets) {
      expect(typeof preset.title).toBe('string');
      expect(typeof preset.shortName).toBe('string');
      expect(typeof preset.class).toBe('string');
    }
  });

  it("derives each preset's short name as the lowercased hyphenated title", () => {
    for (const preset of sectionTypePresets()) {
      const expected = preset.title.toLowerCase().replace(/\s+/g, '-');
      expect(preset.shortName).toBe(expected);
    }
  });
});

describe('sectionTypeClass', () => {
  it("maps a preset type to the class 'deo-<type>'", () => {
    for (const preset of sectionTypePresets()) {
      expect(sectionTypeClass(preset.shortName)).toBe(`deo-${preset.shortName}`);
    }
    expect(sectionTypeClass('methods')).toBe('deo-methods');
  });

  it("maps a generic section to 'doco-section'", () => {
    expect(sectionTypeClass('section')).toBe('doco-section');
  });
});

const EXTENDED_ROLE_TITLES = [
  'Introduction',
  'Methods',
  'Results',
  'Discussion',
  'Conclusion',
  'Acknowledgements',
  'Author Contribution',
  'Background',
  'Biography',
  'Contribution',
  'Data',
  'Dataset Description',
  'Dedication',
  'Epilogue',
  'Evaluation',
  'External Resource Description',
  'Future Work',
  'Materials',
  'Model',
  'Motivation',
  'Postscript',
  'Problem Statement',
  'Prologue',
  'Related Work',
  'Scenario',
  'Supplementary Information Description',
];

describe('extendedSectionTypePresets', () => {
  it('lists the five core roles in document order followed by every remaining section-level DEO role', () => {
    expect(extendedSectionTypePresets().map((role) => role.title)).toEqual(EXTENDED_ROLE_TITLES);
  });

  it('gives every role a kebab-case short name and a deo- class', () => {
    for (const role of extendedSectionTypePresets()) {
      expect(role.shortName).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(role.class).toBe(`deo-${role.shortName}`);
    }
  });

  it('excludes the non-section-level DEO classes', () => {
    const titles = extendedSectionTypePresets().map((role) => role.title);
    for (const excluded of [
      'DiscourseElement',
      'Caption',
      'Legend',
      'Reference',
      'BibliographicReference',
    ]) {
      expect(titles).not.toContain(excluded);
    }
  });
});

describe('sectionTypeRole', () => {
  it('maps generic and custom sections to no DEO role and no DEO class', () => {
    for (const type of ['section', 'custom-section', 'my-notes']) {
      expect(sectionTypeRole(type)).toBeNull();
      expect(sectionTypeClass(type)).toBe('doco-section');
    }
  });

  it('maps a section-level role short name to its vocabulary entry and DEO class', () => {
    const role = sectionTypeRole('author-contribution');
    expect(role?.title).toBe('Author Contribution');
    expect(sectionTypeClass('author-contribution')).toBe('deo-author-contribution');
  });
});
