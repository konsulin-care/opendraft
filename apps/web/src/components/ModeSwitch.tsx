import { FileCode, FileText } from 'lucide-react';

/** Editing mode controlled by the header's mode toggle. */
export type EditorMode = 'wysiwyg' | 'source';

/** Props for {@link ModeSwitch}. */
export interface ModeSwitchProps {
  /** Current editing mode; the toggle shows this mode's icon. */
  mode: EditorMode;
  /** Called with the opposite mode when the toggle is activated. */
  onSelectMode: (mode: EditorMode) => void;
}

const TOGGLE =
  'inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

const MODE_NAME: Record<EditorMode, string> = { wysiwyg: 'visual', source: 'source' };

/**
 * Single icon button that shows the current mode's icon (FileText in visual
 * mode, FileCode in source mode) and switches to the other mode on click.
 * The title and aria-label name the target mode. Hidden below the md
 * breakpoint; on smaller screens the same action lives in the header
 * overflow menu.
 *
 * @param props - See {@link ModeSwitchProps}.
 */
export function ModeSwitch({ mode, onSelectMode }: ModeSwitchProps) {
  const target: EditorMode = mode === 'wysiwyg' ? 'source' : 'wysiwyg';
  const label = `Switch to ${MODE_NAME[target]}`;
  const Icon = mode === 'wysiwyg' ? FileText : FileCode;
  return (
    <div className="hidden items-center md:flex">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => onSelectMode(target)}
        className={TOGGLE}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
