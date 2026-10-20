import { SquarePen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Props for {@link InlineEditField}. */
export interface InlineEditFieldProps {
  /** Current text value; syncs the draft when it changes. */
  value: string;
  /** Accessible label for the input. */
  label: string;
  /** Optional test id for the input element. */
  testId?: string;
  /** Called with the trimmed value when the user saves via Enter or blur. */
  onSave?: (value: string) => void | Promise<void>;
  /** Extra classes appended after the base input classes. */
  inputClassName?: string;
}

const SAVE_ERROR = 'Could not rename.';

const INPUT_CLASS =
  'w-full min-w-0 border-0 p-0 text-sm font-medium leading-tight text-gray-900 focus:outline-none';

/**
 * Draft state for the inline edit: tracks the edited value, the last
 * saved value, and any save error.
 *
 * @param value - Current value; syncs the draft when it changes.
 * @param onSave - Called with the trimmed value on save.
 * @returns The draft value, setters, error, and the save/restore actions.
 */
function useEditDraft(value: string, onSave?: (value: string) => void | Promise<void>) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(value);

  useEffect(() => {
    lastSaved.current = value;
    setDraft(value);
  }, [value]);

  /** Save the trimmed value, restoring the old value when it is empty. */
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === lastSaved.current) {
      setDraft(lastSaved.current);
      return;
    }
    setDraft(trimmed);
    setError(null);
    try {
      Promise.resolve(onSave?.(trimmed)).then(
        () => {
          lastSaved.current = trimmed;
        },
        () => setError(SAVE_ERROR),
      );
    } catch {
      setError(SAVE_ERROR);
    }
  };

  /** Restore the last saved value and clear any error. */
  const restore = () => {
    setDraft(lastSaved.current);
    setError(null);
  };

  return { draft, setDraft, error, save, restore };
}

/**
 * Shared inline-edit field: a plain-text input with a SquarePen icon
 * that appears on hover or focus, and a caret placed at the end of the
 * text on click or focus. Enter or blur saves the trimmed value via
 * onSave (empty values are ignored), Escape restores the previous
 * value, and a rejected save shows an inline error.
 *
 * @param props - See {@link InlineEditFieldProps}.
 */
export function InlineEditField({ value, label, testId, onSave, inputClassName }: InlineEditFieldProps) {
  const { draft, setDraft, error, save, restore } = useEditDraft(value, onSave);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Place the caret at the end of the current text. */
  const moveCaretToEnd = () => {
    const input = inputRef.current;
    if (input == null) return;
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };

  return (
    <span className="group flex min-w-0 items-center gap-1">
      <input
        ref={inputRef}
        aria-label={label}
        data-testid={testId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={moveCaretToEnd}
        onClick={moveCaretToEnd}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            save();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            restore();
          }
        }}
        onBlur={save}
        className={inputClassName ? `${INPUT_CLASS} ${inputClassName}` : INPUT_CLASS}
      />
      <SquarePen
        className="h-3.5 w-3.5 shrink-0 text-gray-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        aria-hidden="true"
      />
      {error !== null && (
        <span role="alert" className="shrink-0 text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
