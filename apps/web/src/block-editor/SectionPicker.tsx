/**
 * Section picker: the five core DEO role chips create a section in one
 * click, the 'More options' disclosure reveals the extended
 * section-level DEO roles, and 'Custom section' opens the custom path.
 * Used-role marks and accent styling are applied elsewhere; this
 * component only reports the pick.
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
}

/** Shared styling for the pill-shaped role chips. */
const CHIP_CLASS = 'rounded-full border px-3 py-1 text-sm hover:bg-gray-50';

/** Shared styling for the disclosure and entry buttons. */
const BUTTON_CLASS =
  'rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50';

/**
 * One role chip; clicking it creates the section immediately.
 *
 * @param props - The preset supplying label and draft fields, plus the
 *                create handler.
 * @returns The chip button element.
 */
function RoleChip({
  preset,
  onCreate,
}: {
  /** Preset supplying the title, short name and role. */
  preset: SectionTypePreset;
  /** Receives the draft when the chip is clicked. */
  onCreate: (draft: SectionDraft) => void;
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
      className={CHIP_CLASS}
    >
      {preset.title}
    </button>
  );
}

/**
 * Section picker: core role chips that create immediately, a 'More
 * options' disclosure revealing the extended section-level DEO roles,
 * and the 'Custom section' entry point.
 *
 * @param props - See {@link SectionPickerProps}.
 */
export function SectionPicker({ onCreate, onCustom }: SectionPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const core = sectionTypePresets();
  const coreNames = new Set(core.map((preset) => preset.shortName));
  const extended = extendedSectionTypePresets().filter(
    (preset) => !coreNames.has(preset.shortName),
  );

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {core.map((preset) => (
          <li key={preset.shortName}>
            <RoleChip preset={preset} onCreate={onCreate} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className={BUTTON_CLASS}
      >
        More options
      </button>
      {expanded && (
        <ul aria-label="Extended DEO roles" className="flex flex-wrap gap-2">
          {extended.map((preset) => (
            <li key={preset.shortName}>
              <RoleChip preset={preset} onCreate={onCreate} />
            </li>
          ))}
        </ul>
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
