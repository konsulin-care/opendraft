/**
 * DEO section-type presets for manuscripts.
 *
 * The vocabulary is derived from `SECTION_ROLES` and `sectionClass` in
 * `@opendraft/schema` rather than local title lists: each preset carries
 * a title title-cased from its role (`'author-contribution'` ->
 * `'Author Contribution'`), the role itself as the short name, and the
 * class returned by `sectionClass`.
 * `extendedSectionTypePresets` is the full section-level DEO role
 * vocabulary — one preset per `SECTION_ROLES` entry in the same order.
 * Non-section-level classes (DiscourseElement, Caption, Legend,
 * Reference, BibliographicReference) are excluded because they are not
 * `SECTION_ROLES` entries. `sectionTypeRole` looks a role up by short
 * name — generic and custom sections map to no role — and
 * `sectionTypeClass` maps a section type to its CSS class: vocabulary
 * short types get the DEO class `deo-<type>`, everything else —
 * including the generic `'section'` fallback — gets `doco-section`
 * (no DEO class).
 */

import { SECTION_ROLES, sectionClass } from '@opendraft/schema';

/** One DEO section-type preset. */
export interface SectionTypePreset {
  /** Human-readable section title, e.g. `'Introduction'`. */
  title: string;
  /** Short name derived from the title, e.g. `'introduction'`. */
  shortName: string;
  /** CSS class for the preset, e.g. `'deo-introduction'`. */
  class: string;
}

/** The five core rhetorical roles, in document order. */
const CORE_ROLES: readonly string[] = [
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
];

/**
 * Derive a human-readable title from a section role.
 *
 * @param role - Kebab-case section role, e.g. `'author-contribution'`.
 * @returns The role with each hyphen-separated word capitalized, e.g.
 *          `'Author Contribution'`.
 */
function titleFromRole(role: string): string {
  return role
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build a preset for a section role.
 *
 * @param role - A `SECTION_ROLES` entry.
 * @returns The preset with derived title, the role as short name and
 *          the `sectionClass` CSS class.
 */
function presetFor(role: string): SectionTypePreset {
  return { title: titleFromRole(role), shortName: role, class: sectionClass(role) };
}

/**
 * List the DEO section-type presets.
 *
 * @returns The five core presets in document order, each carrying its
 *          role-derived title, the role as short name and the
 *          `sectionClass` `deo-<role>` class.
 */
export function sectionTypePresets(): SectionTypePreset[] {
  return CORE_ROLES.map(presetFor);
}

/**
 * List the full section-level DEO role vocabulary.
 *
 * @returns One preset per `SECTION_ROLES` entry in the same order, each
 *          carrying its role-derived title, the role as short name and
 *          the `sectionClass` `deo-<role>` class. Non-section-level
 *          classes are never included.
 */
export function extendedSectionTypePresets(): SectionTypePreset[] {
  return SECTION_ROLES.map(presetFor);
}

/**
 * Look up a section-level DEO role by short name.
 *
 * @param type - Section short type, e.g. `'author-contribution'`.
 * @returns The vocabulary entry for a known `SECTION_ROLES` entry;
 *          `null` for generic (`'section'`) and custom types, which map
 *          to no DEO role.
 */
export function sectionTypeRole(type: string): SectionTypePreset | null {
  return SECTION_ROLES.includes(type) ? presetFor(type) : null;
}

/**
 * Map a section type to its CSS class.
 *
 * @param type - Section short type, e.g. `'methods'`; a generic section
 *                uses the fallback type `'section'`.
 * @returns `'deo-<type>'` when the type is a `SECTION_ROLES` entry;
 *          `'doco-section'` (no DEO class) for generic and custom
 *          types, via `sectionClass(null)`.
 */
export function sectionTypeClass(type: string): string {
  return SECTION_ROLES.includes(type) ? sectionClass(type) : sectionClass(null);
}
