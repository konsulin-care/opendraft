import { describe, expect, it } from 'vitest';
import { sectionTypeClass, sectionTypePresets } from './deo-types';

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
