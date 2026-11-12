/**
 * DEO section-type presets for the block editor.
 *
 * Re-export shim: the implementation lives in `@opendraft/manuscript` so the
 * web app and the manuscript package share identical presets. See the
 * package for the preset vocabulary, role lookup and class-mapping rules.
 */
export {
  extendedSectionTypePresets,
  sectionTypeClass,
  sectionTypePresets,
  sectionTypeRole,
} from '@opendraft/manuscript';
export type { SectionTypePreset } from '@opendraft/manuscript';
