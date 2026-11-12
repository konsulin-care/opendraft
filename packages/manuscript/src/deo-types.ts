/**
 * DEO section-type presets for manuscripts.
 *
 * `sectionTypePresets` lists the five core rhetorical section types in
 * document order, each with a human-readable title, a short name derived
 * from the title (lowercased, hyphenated) and its CSS class.
 * `extendedSectionTypePresets` is the full section-level DEO role
 * vocabulary: the five core roles first, then every remaining
 * section-level DEO role. Non-section-level classes (DiscourseElement,
 * Caption, Legend, Reference, BibliographicReference) are excluded.
 * `sectionTypeRole` looks a role up by short name — generic and custom
 * sections map to no role — and `sectionTypeClass` maps a section type to
 * its CSS class: vocabulary short types get the DEO class `deo-<type>`,
 * everything else — including the generic `'section'` fallback — gets
 * `doco-section` (no DEO class).
 */

/** One DEO section-type preset. */
export interface SectionTypePreset {
  /** Human-readable section title, e.g. `'Introduction'`. */
  title: string;
  /** Short name derived from the title, e.g. `'introduction'`. */
  shortName: string;
  /** CSS class for the preset, e.g. `'deo-introduction'`. */
  class: string;
}

/** Preset titles in document order. */
const PRESET_TITLES = [
  'Introduction',
  'Methods',
  'Results',
  'Discussion',
  'Conclusion',
] as const;

/** Titles of the remaining section-level DEO roles, alphabetically. */
const EXTENDED_ROLE_TITLES = [
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
] as const;

/** CSS class of a section without a rhetorical preset type. */
const GENERIC_SECTION_CLASS = 'doco-section';

/**
 * Derive a short name from a section title.
 *
 * @param title - Human-readable section title.
 * @returns The lowercased title with whitespace runs replaced by hyphens.
 */
function deriveShortName(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-');
}

/**
 * List the DEO section-type presets.
 *
 * @returns The five presets in document order, each carrying its title,
 *          derived short name and `deo-<shortName>` class.
 */
export function sectionTypePresets(): SectionTypePreset[] {
  return PRESET_TITLES.map((title) => {
    const shortName = deriveShortName(title);
    return { title, shortName, class: `deo-${shortName}` };
  });
}

/**
 * List the full section-level DEO role vocabulary.
 *
 * @returns The five core presets in document order followed by every
 *          remaining section-level DEO role, each carrying its title,
 *          derived kebab-case short name and `deo-<shortName>` class.
 *          Non-section-level classes are never included.
 */
export function extendedSectionTypePresets(): SectionTypePreset[] {
  const titles: readonly string[] = [...PRESET_TITLES, ...EXTENDED_ROLE_TITLES];
  return titles.map((title) => {
    const shortName = deriveShortName(title);
    return { title, shortName, class: `deo-${shortName}` };
  });
}

/**
 * Look up a section-level DEO role by short name.
 *
 * @param type - Section short type, e.g. `'author-contribution'`.
 * @returns The vocabulary entry for a known section-level role;
 *          `null` for generic (`'section'`) and custom types, which map
 *          to no DEO role.
 */
export function sectionTypeRole(type: string): SectionTypePreset | null {
  return (
    extendedSectionTypePresets().find((role) => role.shortName === type) ??
    null
  );
}

/**
 * Map a section type to its CSS class.
 *
 * @param type - Section short type, e.g. `'methods'`; a generic section
 *                uses the fallback type `'section'`.
 * @returns `'deo-<type>'` when the type is a section-level DEO role short
 *          name; `'doco-section'` (no DEO class) for generic and custom
 *          types.
 */
export function sectionTypeClass(type: string): string {
  return sectionTypeRole(type) ? `deo-${type}` : GENERIC_SECTION_CLASS;
}
