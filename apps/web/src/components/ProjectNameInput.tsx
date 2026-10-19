import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Props for {@link ProjectNameInput}. */
export interface ProjectNameInputProps {
  /** Current project name. */
  name: string;
  /** Called with the trimmed name when the user saves via Enter or blur. */
  onRename?: (name: string) => void | Promise<void>;
}

const RENAME_ERROR = 'Could not rename the project.';

/**
 * Draft state for the inline rename: tracks the edited value, the last
 * saved name, and any save error.
 *
 * @param name - Current project name; syncs the draft when it changes.
 * @param onRename - Called with the trimmed name on save.
 * @returns The draft value, setters, error, and the save/restore actions.
 */
function useRenameDraft(
  name: string,
  onRename?: (name: string) => void | Promise<void>,
) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(name);

  useEffect(() => {
    lastSaved.current = name;
    setValue(name);
  }, [name]);

  /** Save the trimmed value, restoring the old name when it is empty. */
  const save = () => {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === lastSaved.current) {
      setValue(lastSaved.current);
      return;
    }
    setValue(trimmed);
    setError(null);
    try {
      Promise.resolve(onRename?.(trimmed)).then(
        () => {
          lastSaved.current = trimmed;
        },
        () => setError(RENAME_ERROR),
      );
    } catch {
      setError(RENAME_ERROR);
    }
  };

  /** Restore the last saved name and clear any error. */
  const restore = () => {
    setValue(lastSaved.current);
    setError(null);
  };

  return { value, setValue, error, save, restore };
}

/**
 * Inline project rename: a plain-text input with a pencil icon that
 * appears on hover or focus. Enter or blur saves the trimmed name via
 * onRename, Escape restores the previous name, an empty name is
 * rejected and restored, and a rejected save shows an inline error.
 *
 * @param props - See {@link ProjectNameInputProps}.
 */
export function ProjectNameInput({ name, onRename }: ProjectNameInputProps) {
  const { value, setValue, error, save, restore } = useRenameDraft(name, onRename);

  return (
    <span className="group flex min-w-0 items-center gap-1">
      <input
        aria-label="Project name"
        data-testid="project-name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
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
        className="min-h-11 w-full min-w-0 border-0 p-0 text-sm font-medium text-gray-900 focus:outline-none"
      />
      <Pencil
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
