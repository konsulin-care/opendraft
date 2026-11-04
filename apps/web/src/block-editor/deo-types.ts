/**
 * DEO section-type presets for the block editor.
 *
 * `sectionTypePresets` lists the five rhetorical section types in document
 * order, each with a human-readable title, a short name derived from the
 * title (lowercased, hyphenated) and its CSS class. `sectionTypeClass`
 * maps a section type to its CSS class: preset short types get the DEO
 * class `deo-<type>`, everything else — including the generic `'section'`
 * fallback — gets `doco-section`.
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
 * Map a section type to its CSS class.
 *
 * @param type - Section short type, e.g. `'methods'`; a generic section
 *                uses the fallback type `'section'`.
 * @returns `'deo-<type>'` when the type is a preset short name;
 *          `'doco-section'` for any non-preset (generic) type.
 */
export function sectionTypeClass(type: string): string {
  const isPreset = PRESET_TITLES.some((title) => deriveShortName(title) === type);
  return isPreset ? `deo-${type}` : GENERIC_SECTION_CLASS;
}
