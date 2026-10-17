import { AtSign, List, Pilcrow, Plus, Redo2, Undo2 } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarMenu } from './ToolbarMenu';
import { headingItems, insertItems } from './FormattingToolbar';
import { useActiveState } from '../hooks/useActiveState';
import type { ActiveState, EditorCommands } from '../editor-commands/types';

/** Props for {@link KeyboardBar}. */
export interface KeyboardBarProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** True while the on-screen keyboard is open; the bar renders nothing otherwise. */
  open: boolean;
  /** `innerHeight` minus `visualViewport.height`; the bar is fixed this far from the bottom. */
  bottomOffset: number;
  /** Formatting-toolbar visibility preference from the app shell. */
  formattingToolbar: boolean;
}

/** Props for {@link FormattingControls}. */
interface FormattingControlsProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** Formatting state at the current selection. */
  active: ActiveState;
  /** Runs a command, then re-reads the active state. */
  run: (action: () => void) => void;
}

/**
 * Paragraph style, Bullet list, Citation, and Insert controls. Disabled in
 * source mode (`canFormat` false) while reporting toggle state via aria.
 *
 * @param props - See {@link FormattingControlsProps}.
 * @returns The formatting controls fragment.
 */
function FormattingControls({ commands, active, run }: FormattingControlsProps) {
  const disabled = !commands.canFormat;
  return (
    <>
      <ToolbarMenu
        label="Paragraph style"
        icon={Pilcrow}
        items={headingItems(active.heading, (level) => run(() => commands.setHeading(level)))}
        disabled={disabled}
      />
      <ToolbarButton
        label="Bullet list"
        icon={List}
        pressed={active.bulletList}
        disabled={disabled}
        onClick={() => run(commands.bulletList)}
      />
      <ToolbarButton
        label="Citation"
        icon={AtSign}
        disabled={disabled}
        onClick={() => run(commands.insertCitation)}
      />
      <ToolbarMenu label="Insert" icon={Plus} items={insertItems(commands, run)} disabled={disabled} />
    </>
  );
}

/**
 * On-screen keyboard action bar for mobile. Fixed at the bottom of the layout
 * viewport, `bottomOffset` pixels up so it sits above the software keyboard.
 * Renders Undo, Redo, Paragraph style, Bullet list, Citation, and Insert when
 * the formatting-toolbar preference is on; only Undo and Redo when it is off.
 * In source mode (`canFormat` false) formatting controls are disabled while
 * Undo and Redo stay enabled. Renders nothing while the keyboard is closed.
 *
 * @param props - See {@link KeyboardBarProps}.
 * @returns The bar element, or null when the keyboard is closed.
 */
export function KeyboardBar({
  commands,
  open,
  bottomOffset,
  formattingToolbar,
}: KeyboardBarProps) {
  const [active, refresh] = useActiveState(commands);

  /** Run a command, then re-read the active state so pressed states update. */
  const run = (action: () => void): void => {
    action();
    refresh();
  };

  if (!open) return null;

  return (
    <div
      role="toolbar"
      aria-label="Keyboard bar"
      className="inset-x-0 z-40 flex items-center gap-1 border-t border-gray-200 bg-white px-2 py-1.5"
      style={{ position: 'fixed', bottom: bottomOffset }}
    >
      <ToolbarButton label="Undo" icon={Undo2} onClick={() => run(commands.undo)} />
      <ToolbarButton label="Redo" icon={Redo2} onClick={() => run(commands.redo)} />
      {formattingToolbar && <FormattingControls commands={commands} active={active} run={run} />}
    </div>
  );
}
