/**
 * Section picker: the five core DEO role chips create a section in one
 * click, the 'More options' disclosure reveals the extended
 * section-level DEO roles, and 'Custom section' opens the custom path.
 * Roles already used show a check mark but stay clickable, and chips
 * use the black/secondary accent tokens with no native select element.
 */
import { useState } from 'react';
import { extendedSectionTypePresets, sectionTypePresets } from './deo-types';
import type { SectionTypePreset } from './deo-types';

/** Draft handed to {@link SectionPickerProps.onCreate} when a chip is clicked. */
export interface SectionDraft {
  /** Trimmed heading title, e.g. `'Methods'`. */
  title: string;
  /** Short name for the heading anchor, e.g. `'methods'`. */
  short: string;
  /** DEO role short name; omitted for custom sections with no role. */
  role?: string;
}

/** Props for {@link SectionPicker}. */
export interface SectionPickerProps {
  /** Create the section from the picked draft, without further input. */
  onCreate: (draft: SectionDraft) => void;
  /** Open the custom-section view; the picker still works without it. */
  onCustom?: () => void;
  /** Role short names already used; their chips show a check mark. */
  usedRoles?: ReadonlySet<string>;
}

/** Shared chip geometry plus the black-accent hover/focus styling. */
const CHIP_BASE =
  'rounded-full px-3 py-1 text-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-black';

/** Base chip with its neutral border and black hover accent. */
const CHIP_CLASS = `${CHIP_BASE} border border-gray-300 hover:border-black`;

/** Used chip: black border and secondary fill marking a taken role. */
const CHIP_USED_CLASS = `${CHIP_BASE} border border-black bg-secondary`;

/** Shared styling for the disclosure and entry buttons. */
const BUTTON_CLASS =
  'rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-black';

/**
 * One role chip; clicking it creates the section immediately.
 *
 * @param props - The preset supplying label and draft fields, the create
 *                handler, and the used flag.
 * @returns The chip button element.
 */
function RoleChip({
  preset,
  onCreate,
  used = false,
}: {
  /** Preset supplying the title, short name and role. */
  preset: SectionTypePreset;
  /** Receives the draft when the chip is clicked. */
  onCreate: (draft: SectionDraft) => void;
  /** Whether the role is already used; the chip stays clickable. */
  used?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onCreate({
          title: preset.title,
          short: preset.shortName,
          role: preset.shortName,
        })
      }
      className={used ? CHIP_USED_CLASS : CHIP_CLASS}
    >
      {used && <span aria-hidden="true">✓ </span>}
      {preset.title}
    </button>
  );
}

/**
 * Wrapping list of role chips; each chip carries the used check mark.
 *
 * @param props - Presets to render, the create handler, the used set,
 *                and an optional list label.
 * @returns The chip list element.
 */
function ChipList({
  presets,
  onCreate,
  usedRoles,
  label,
}: {
  /** Presets rendered as chips. */
  presets: SectionTypePreset[];
  /** Receives the draft when a chip is clicked. */
  onCreate: (draft: SectionDraft) => void;
  /** Role short names already used; their chips show a check mark. */
  usedRoles?: ReadonlySet<string>;
  /** Accessible name for the list, when one is needed. */
  label?: string;
}) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label}>
      {presets.map((preset) => (
        <li key={preset.shortName}>
          <RoleChip
            preset={preset}
            onCreate={onCreate}
            used={usedRoles?.has(preset.shortName) ?? false}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Section picker: core role chips that create immediately, a 'More
 * options' disclosure revealing the extended section-level DEO roles,
 * and the 'Custom section' entry point.
 *
 * @param props - See {@link SectionPickerProps}.
 */
export function SectionPicker({
  onCreate,
  onCustom,
  usedRoles,
}: SectionPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const core = sectionTypePresets();
  const coreNames = new Set(core.map((preset) => preset.shortName));
  const extended = extendedSectionTypePresets().filter(
    (preset) => !coreNames.has(preset.shortName),
  );

  return (
    <div className="space-y-2">
      <ChipList presets={core} onCreate={onCreate} usedRoles={usedRoles} />
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className={BUTTON_CLASS}
      >
        More options
      </button>
      {expanded && (
        <ChipList
          presets={extended}
          onCreate={onCreate}
          usedRoles={usedRoles}
          label="Extended DEO roles"
        />
      )}
      <button
        type="button"
        onClick={() => onCustom?.()}
        className={BUTTON_CLASS}
      >
        Custom section
      </button>
    </div>
  );
}
