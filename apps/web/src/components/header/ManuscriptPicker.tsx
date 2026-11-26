import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { Surface } from '../surface/Surface';
import type { ManuscriptSwitcherOption } from './ManuscriptSwitcher';

/** Row button listing one manuscript. */
const ROW_CLASS =
  'flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gray-500';

/** Fixed-width column holding either the check icon or an empty spacer. */
const ICON_COLUMN = 'flex h-4 w-4 shrink-0 items-center justify-center';

/** Column stacking the title above the id. */
const TEXT_COLUMN = 'flex min-w-0 flex-col';

/** Manuscript title line. */
const TITLE_CLASS = 'truncate text-sm font-medium';

/** Manuscript id line beneath the title. */
const ID_CLASS = 'truncate font-mono text-xs text-gray-500';

/** Props for {@link ManuscriptPicker}. */
export interface ManuscriptPickerProps {
  /** Manuscripts offered by the picker. */
  manuscripts: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  currentId?: string;
  /** Called with the id of the chosen manuscript. */
  onPick: (id: string) => void;
  /** Called when the picker is dismissed without a pick. */
  onClose: () => void;
}

/** Props for {@link ManuscriptRow}. */
interface ManuscriptRowProps {
  manuscript: ManuscriptSwitcherOption;
  isCurrent: boolean;
  onPick: (id: string) => void;
  buttonRef: (element: HTMLButtonElement | null) => void;
}

/**
 * Single picker row showing the title above the id.
 *
 * @param props - See {@link ManuscriptRowProps}.
 * @returns The row list item.
 */
function ManuscriptRow({ manuscript, isCurrent, onPick, buttonRef }: ManuscriptRowProps) {
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        aria-current={isCurrent ? 'true' : undefined}
        onClick={() => onPick(manuscript.id)}
        className={ROW_CLASS}
      >
        <span className={ICON_COLUMN}>
          {isCurrent && <Check className="h-4 w-4" aria-hidden="true" />}
        </span>
        <span className={TEXT_COLUMN}>
          <span className={TITLE_CLASS}>{manuscript.title}</span>
          <span className={ID_CLASS}>{manuscript.id}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * Dialog listing manuscripts with the current one marked and focused.
 *
 * Below md it renders as a bottom sheet with a scrim; from md it is an
 * anchored popover. The list scrolls inside the surface and is capped at 80vh.
 *
 * @param props - See {@link ManuscriptPickerProps}.
 * @returns The picker surface.
 */
export function ManuscriptPicker(props: ManuscriptPickerProps) {
  const { manuscripts, currentId, onPick, onClose } = props;
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentIndex = manuscripts.findIndex((manuscript) => manuscript.id === currentId);
  const focusIndex = currentIndex === -1 ? 0 : currentIndex;

  useEffect(() => {
    rowRefs.current[focusIndex]?.focus();
  }, [focusIndex]);

  return (
    <Surface
      role="dialog"
      label="Select manuscript"
      title="Select manuscript"
      variant="bottom-sheet"
      mdVariant="popover"
      maxHeight="80vh"
      scrim="below-md"
      closeButton="always"
      closeLabel="Close manuscript picker"
      onClose={onClose}
    >
      <ul className="py-1">
        {manuscripts.map((manuscript, index) => (
          <ManuscriptRow
            key={manuscript.id}
            manuscript={manuscript}
            isCurrent={index === currentIndex}
            onPick={onPick}
            buttonRef={(element) => {
              rowRefs.current[index] = element;
            }}
          />
        ))}
      </ul>
    </Surface>
  );
}
