/**
 * Manuscript row shared by the editor and reader details panels.
 *
 * The editor passes a rename handler, so the value is an inline editable
 * field; the reader omits it, so the value is plain read-only text. Both pass
 * a picker handler to get the trailing chevron button that opens the shared
 * manuscript picker.
 */

import type { ReactNode, RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import { InlineEditField } from '../InlineEditField';
import { DetailRow } from './detail-list';

/** Select-like wrapper around the value and the picker button. */
const SWITCH_ROW_CLASS = 'flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5';

/** Trailing chevron button opening the manuscript picker. */
const SWITCH_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black';

/** Read-only value styling used when no rename handler is given. */
const READ_ONLY_CLASS = 'block min-w-0 truncate text-sm font-medium text-gray-900';

/** Props for {@link ManuscriptDetailRow}. */
export interface ManuscriptDetailRowProps {
  /** Display name of the current manuscript. */
  name: string;
  /** Called with the trimmed name when the user renames the manuscript. */
  onRename?: (value: string) => void | Promise<void>;
  /** Called when the user asks to switch manuscript; hides the button when absent. */
  onOpenPicker?: () => void;
  /** Ref forwarded to the switch manuscript button, used to restore focus. */
  switchRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Render the manuscript row value: an editable field or read-only text.
 *
 * @param props - Name and the optional rename handler.
 * @returns The field or the plain value.
 */
function ManuscriptValue({
  name,
  onRename,
  onOpenPicker,
}: Pick<ManuscriptDetailRowProps, 'name' | 'onRename' | 'onOpenPicker'>): ReactNode {
  if (onRename === undefined) return <span className={READ_ONLY_CLASS}>{name}</span>;
  return (
    <InlineEditField
      value={name}
      label="Manuscript name"
      testId="manuscript-title"
      onSave={onRename}
      inputClassName={onOpenPicker === undefined ? undefined : 'flex-1'}
    />
  );
}

/**
 * Manuscript row of a details panel, with an optional rename field and picker.
 *
 * @param props - See {@link ManuscriptDetailRowProps}.
 * @returns The detail row.
 */
export function ManuscriptDetailRow({
  name,
  onRename,
  onOpenPicker,
  switchRef,
}: ManuscriptDetailRowProps) {
  const value = (
    <ManuscriptValue name={name} onRename={onRename} onOpenPicker={onOpenPicker} />
  );

  return (
    <DetailRow term="Manuscript ID">
      {onOpenPicker === undefined ? (
        value
      ) : (
        <div className={SWITCH_ROW_CLASS}>
          {value}
          <button
            ref={switchRef}
            type="button"
            aria-label="Choose manuscript"
            title="Choose manuscript"
            aria-haspopup="dialog"
            onClick={onOpenPicker}
            className={SWITCH_BUTTON_CLASS}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </DetailRow>
  );
}

export default ManuscriptDetailRow;
