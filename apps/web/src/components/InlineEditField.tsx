import { SquarePen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

/** Props for {@link InlineEditField}. */
export interface InlineEditFieldProps {
  /**
   * Current text value. Syncs the draft only when the field holds no
   * unsaved typing, so an external update cannot discard what the user
   * is typing; the new value becomes the Escape restore target.
   */
  value: string;
  /** Accessible label for the input. */
  label: string;
  /** Optional test id for the input element. */
  testId?: string;
  /** Called with the trimmed value when the user saves via Enter or blur. */
  onSave?: (value: string) => void | Promise<void>;
  /** Extra classes appended after the base layout and typography classes. */
  inputClassName?: string;
  /**
   * Typography classes that replace the default `text-sm font-medium leading-tight`.
   * Use it when the field doubles as a heading and needs a larger font size;
   * passing nothing keeps the default.
   */
  textClassName?: string;
}

const SAVE_ERROR = 'Could not rename.';

const INPUT_CLASS =
  'field-sizing-content min-w-0 border-0 p-0 text-gray-900 focus:outline-none';

const DEFAULT_TEXT_CLASS = 'text-sm font-medium leading-tight';

/**
 * Compose the input's class list from the layout base, the typography
 * classes (caller override or the default) and any extra caller classes.
 *
 * @param inputClassName - Extra classes appended last.
 * @param textClassName - Typography override replacing the default.
 * @returns The space-separated class list.
 */
function composeInputClass(inputClassName?: string, textClassName?: string): string {
  return [INPUT_CLASS, textClassName ?? DEFAULT_TEXT_CLASS, inputClassName].filter(Boolean).join(' ');
}

/**
 * Build the input key handler: Enter saves, Escape restores, both with
 * the default action prevented.
 *
 * @param save - Commit the draft value.
 * @param restore - Revert to the last saved value.
 * @returns The keydown handler.
 */
function editKeyHandler(save: () => void, restore: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      restore();
    }
  };
}

/**
 * Keep the draft in step with external value changes without discarding
 * unsaved typing.
 *
 * @param value - Current external value.
 * @param dirty - Ref marking unsaved typing.
 * @param lastSaved - Ref holding the last saved value.
 * @param setDraft - Draft setter.
 */
function useValueSync(
  value: string,
  dirty: RefObject<boolean>,
  lastSaved: RefObject<string>,
  setDraft: (next: string) => void,
): void {
  useEffect(() => {
    // Mount and post-save echoes carry the value already held: nothing to
    // sync. Skipping them removes the race where a late mount effect
    // overwrote text typed before the effect flushed.
    if (value === lastSaved.current) return;
    lastSaved.current = value;
    // Keep unsaved typing; the new value becomes the Escape target.
    if (dirty.current) return;
    setDraft(value);
  }, [value, dirty, lastSaved, setDraft]);
}

/**
 * Draft state for the inline edit: tracks the edited value, the last
 * saved value, and any save error.
 *
 * @param value - Current value; syncs the draft only while the field holds
 *   no unsaved typing.
 * @param onSave - Called with the trimmed value on save.
 * @returns The draft value, the edit wrapper, error, and the save/restore actions.
 */
/**
 * Commit the draft: ignore empty or unchanged values, guard against
 * overlapping saves, and report a rejected save through the error setter.
 *
 * @param draft - Current draft text.
 * @param onSave - Save handler; called with the trimmed value.
 * @param refs - Last-saved, in-flight and dirty refs of the field.
 * @param setters - Draft and error setters.
 */
function commitDraft(
  draft: string,
  onSave: ((value: string) => void | Promise<void>) | undefined,
  refs: { lastSaved: RefObject<string>; saving: RefObject<boolean>; dirty: RefObject<boolean> },
  setters: { setDraft: (next: string) => void; setError: (next: string | null) => void },
): void {
  const { lastSaved, saving, dirty } = refs;
  const { setDraft, setError } = setters;
  if (saving.current) return;
  const trimmed = draft.trim();
  if (trimmed === '' || trimmed === lastSaved.current) {
    dirty.current = false;
    setDraft(lastSaved.current);
    return;
  }
  setDraft(trimmed);
  setError(null);
  saving.current = true;
  dirty.current = false;
  try {
    Promise.resolve(onSave?.(trimmed))
      .then(() => {
        lastSaved.current = trimmed;
      })
      .catch(() => setError(SAVE_ERROR))
      .finally(() => {
        saving.current = false;
      });
  } catch {
    setError(SAVE_ERROR);
    saving.current = false;
  }
}

/**
 * Draft state for the inline edit: tracks the edited value, the last
 * saved value, and any save error.
 *
 * @param value - Current value; syncs the draft only while the field holds
 *   no unsaved typing.
 * @param onSave - Called with the trimmed value on save.
 * @returns The draft value, the edit wrapper, error, and the save/restore actions.
 */
function useEditDraft(value: string, onSave?: (value: string) => void | Promise<void>) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(value);
  const saving = useRef(false);
  /** True while the user has typed text not yet saved, restored or synced. */
  const dirty = useRef(false);

  useValueSync(value, dirty, lastSaved, setDraft);

  /** Record user typing and mark the draft dirty. */
  const edit = (next: string) => {
    dirty.current = true;
    setDraft(next);
  };

  /** Save the trimmed value; ignored while a save is in flight. */
  const save = () => commitDraft(draft, onSave, { lastSaved, saving, dirty }, { setDraft, setError });

  /** Restore the last saved value and clear any error. */
  const restore = () => {
    dirty.current = false;
    setDraft(lastSaved.current);
    setError(null);
  };

  return { draft, edit, error, save, restore };
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
export function InlineEditField({
  value,
  label,
  testId,
  onSave,
  inputClassName,
  textClassName,
}: InlineEditFieldProps) {
  const { draft, edit, error, save, restore } = useEditDraft(value, onSave);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputClass = composeInputClass(inputClassName, textClassName);

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
        size={Math.max(draft.length, 1)}
        onChange={(event) => edit(event.target.value)}
        onFocus={moveCaretToEnd}
        onClick={moveCaretToEnd}
        onKeyDown={editKeyHandler(save, restore)}
        onBlur={save}
        className={inputClass}
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
