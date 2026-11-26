/**
 * Desktop-only draft state chip.
 *
 * The header shows the draft state (e.g. "Draft" or "Sent for review") right
 * before the main draft action from `md` up, where the details panel is not
 * rendered. Below `md` the panel carries the same information, so the chip
 * stays hidden instead of competing for the narrow row.
 */

/** Props for {@link DraftStateChip}. */
export interface DraftStateChipProps {
  /** Draft state text, including any pending-saves suffix. */
  label: string;
}

const CHIP =
  'hidden min-h-6 max-w-[16rem] shrink-0 items-center truncate rounded-full border border-gray-300 bg-gray-100 px-2 text-xs font-medium text-gray-700 md:inline-flex';

/**
 * Render the draft state as a small read-only chip.
 *
 * @param props - See {@link DraftStateChipProps}.
 * @returns The draft state chip.
 */
export function DraftStateChip({ label }: DraftStateChipProps) {
  return (
    <span data-testid="draft-state" title={label} className={CHIP}>
      {label}
    </span>
  );
}

export default DraftStateChip;
