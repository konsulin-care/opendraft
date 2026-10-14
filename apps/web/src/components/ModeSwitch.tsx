import { FileCode, FileText } from 'lucide-react';

/** Editing mode controlled by the header's segmented control. */
export type EditorMode = 'wysiwyg' | 'source';

/** Props for {@link ModeSwitch}. */
export interface ModeSwitchProps {
  /** Current editing mode; the matching segment is pressed. */
  mode: EditorMode;
  /** Called when the user picks an editing mode. */
  onSelectMode: (mode: EditorMode) => void;
}

const SEGMENT =
  'inline-flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500 first:rounded-l-md last:rounded-r-md';

const SEGMENT_ACTIVE = 'bg-gray-900 text-white hover:bg-gray-800';

/**
 * Visual/Source segmented control. Shown from the md breakpoint up; on
 * smaller screens the same actions live in the header overflow menu.
 *
 * @param props - See {@link ModeSwitchProps}.
 */
export function ModeSwitch({ mode, onSelectMode }: ModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Editor mode"
      className="hidden items-center rounded-md border border-gray-200 md:flex"
    >
      <button
        type="button"
        aria-label="Visual"
        title="Visual"
        aria-pressed={mode === 'wysiwyg'}
        onClick={() => onSelectMode('wysiwyg')}
        className={`${SEGMENT} ${mode === 'wysiwyg' ? SEGMENT_ACTIVE : ''}`}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Source"
        title="Source"
        aria-pressed={mode === 'source'}
        onClick={() => onSelectMode('source')}
        className={`${SEGMENT} ${mode === 'source' ? SEGMENT_ACTIVE : ''}`}
      >
        <FileCode className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
