import { describe, expect, it } from 'vitest';
import { SECTION_ROLES, sectionClass } from '@opendraft/schema';
import {
  extendedSectionTypePresets,
  sectionTypeClass,
  sectionTypePresets,
  sectionTypeRole,
} from '../src/deo-types';
import {
  extendedSectionTypePresets as webExtendedSectionTypePresets,
  sectionTypeClass as webSectionTypeClass,
  sectionTypePresets as webSectionTypePresets,
  sectionTypeRole as webSectionTypeRole,
} from '../../../apps/web/src/block-editor/deo-types';

/** The five core rhetorical roles, in document order. */
const CORE_ROLES = [
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
];

/**
 * Derive the expected title from a kebab-case role.
 *
 * @param role - Section role, e.g. `'author-contribution'`.
 * @returns Title-cased words joined by spaces.
 */
function expectedTitle(role: string): string {
  return role
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

describe('sectionTypePresets', () => {
  it('lists the five core roles in document order with derived titles and deo- classes', () => {
    const presets = sectionTypePresets();
    expect(presets.map((preset) => preset.shortName)).toEqual(CORE_ROLES);
    expect(presets.map((preset) => preset.title)).toEqual([
      'Introduction',
      'Methods',
      'Results',
      'Discussion',
      'Conclusion',
    ]);
    for (const preset of presets) {
      expect(preset.class).toBe(`deo-${preset.shortName}`);
      expect(preset.class).toBe(sectionClass(preset.shortName));
    }
  });
});

describe('extendedSectionTypePresets', () => {
  it('returns one preset per SECTION_ROLES entry in the same order, with class deo-<role>', () => {
    const presets = extendedSectionTypePresets();
    expect(presets).toHaveLength(SECTION_ROLES.length);
    expect(presets.map((preset) => preset.shortName)).toEqual([...SECTION_ROLES]);
    for (const [index, role] of SECTION_ROLES.entries()) {
      expect(presets[index].class).toBe(`deo-${role}`);
      expect(presets[index].class).toBe(sectionClass(role));
    }
  });

  it('derives each title from its role, e.g. author-contribution -> Author Contribution', () => {
    expect(sectionTypeRole('author-contribution')?.title).toBe('Author Contribution');
    for (const role of SECTION_ROLES) {
      expect(sectionTypeRole(role)?.title).toBe(expectedTitle(role));
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

describe('sectionTypeClass', () => {
  it("maps 'section' to 'doco-section' and 'related-work' to 'deo-related-work'", () => {
    expect(sectionTypeClass('section')).toBe('doco-section');
    expect(sectionTypeClass('related-work')).toBe('deo-related-work');
    expect(sectionTypeClass('methods')).toBe('deo-methods');
  });

  it('falls back to the generic class for an unknown type', () => {
    expect(sectionTypeClass('custom-section')).toBe('doco-section');
    expect(sectionTypeClass('my-notes')).toBe('doco-section');
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
    expect(role?.shortName).toBe('author-contribution');
    expect(role?.title).toBe('Author Contribution');
    expect(role?.class).toBe('deo-author-contribution');
    expect(sectionTypeClass('author-contribution')).toBe('deo-author-contribution');
  });
});

describe('apps/web block-editor deo-types shim', () => {
  it('re-exports the package presets with identical results', () => {
    expect(webSectionTypePresets()).toEqual(sectionTypePresets());
    expect(webExtendedSectionTypePresets()).toEqual(extendedSectionTypePresets());
    expect(webSectionTypeRole('author-contribution')).toEqual(
      sectionTypeRole('author-contribution'),
    );
    expect(webSectionTypeRole('section')).toBeNull();
    expect(webSectionTypeClass('methods')).toBe(sectionTypeClass('methods'));
    expect(webSectionTypeClass('section')).toBe(sectionTypeClass('section'));
    expect(webSectionTypeClass('related-work')).toBe(
      sectionTypeClass('related-work'),
    );
  });
});
