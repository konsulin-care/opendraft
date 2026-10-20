import { Fragment, useMemo } from 'react';
import { Ellipsis } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarMenu } from './ToolbarMenu';
import type { ToolbarMenuItem } from './ToolbarMenu';
import { TOOLBAR_ITEMS, headingItems, hiddenFormatActive, hiddenMenuItems, insertItems } from './toolbar-items';
import type { ToolbarItemDef } from './toolbar-items';
import { useActiveState } from '../hooks/useActiveState';
import { useOverflowCount } from './use-overflow-count';
import type { ActiveState, EditorCommands } from '../editor-commands/types';

/** Props for {@link FormattingToolbar}. */
export interface FormattingToolbarProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
}

export { headingItems, insertItems };

/** Divider element between two adjacent visible toolbar groups. */
const DIVIDER_CLASS = 'mx-1 h-5 w-px shrink-0 bg-gray-200';

/** Visual separator between two visible groups; absent at row ends. */
function Divider() {
  return <div className={DIVIDER_CLASS} aria-hidden="true" />;
}

/** Props for a single inline {@link ItemControl}. */
interface ItemControlProps {
  /** Item definition from the priority-ordered list. */
  item: ToolbarItemDef;
  /** Index of the item, used for the measurement ref. */
  index: number;
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** Active marks and block state at the selection. */
  active: ActiveState;
  /** Disables formatting controls, e.g. in source mode. */
  disabled: boolean;
  /** Runs a command, then refreshes the active state. */
  run: (action: () => void) => void;
  /** Builds a measurement ref callback for the item at `index`. */
  setItemRef: (index: number) => (element: HTMLElement | null) => void;
}

/**
 * Render one inline toolbar item: the pinned Paragraph style menu trigger, or
 * an icon button wired to its command with the pressed state from the
 * selection. Undo and Redo stay enabled in source mode.
 */
function ItemControl({ item, index, commands, active, disabled, run, setItemRef }: ItemControlProps) {
  if (item.group === 'style') {
    return (
      <ToolbarMenu
        label={item.label}
        icon={item.icon}
        items={headingItems(active.heading, (level) => run(() => commands.setHeading(level)))}
        disabled={disabled}
        measureRef={setItemRef(index)}
      />
    );
  }
  const command = item.command;
  return (
    <ToolbarButton
      label={item.label}
      icon={item.icon}
      pressed={item.pressedKey ? active[item.pressedKey] : undefined}
      disabled={item.group === 'history' ? false : disabled}
      measureRef={setItemRef(index)}
      onClick={() => command && run(() => command(commands))}
    />
  );
}

/** Props for {@link ToolbarRow}. */
interface ToolbarRowProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** Disables formatting controls, e.g. in source mode. */
  disabled: boolean;
}

/**
 * Measured toolbar row: renders the visible prefix of items inline with
 * dividers only between adjacent groups, then an always-rendered More menu
 * holding the hidden tail. The row spans its container (`w-full`) so it
 * tracks the editor column rather than a viewport breakpoint.
 *
 * @param props - See {@link ToolbarRowProps}.
 * @returns The inner row element with inline items and the More trigger.
 */
function ToolbarRow({ commands, disabled }: ToolbarRowProps) {
  const [active, refresh] = useActiveState(commands);

  /** Run a command, then re-read the active state so aria-pressed updates. */
  const run = (action: () => void): void => { action(); refresh(); };

  const pinned = useMemo(() => TOOLBAR_ITEMS.map((item) => Boolean(item.pinned)), []);
  const { visibleCount, rowRef, moreRef, setItemRef } = useOverflowCount({
    itemCount: TOOLBAR_ITEMS.length,
    pinned,
  });

  // Pinned items stay inline even when the measured count would exclude them.
  const lastPinned = TOOLBAR_ITEMS.reduce((last, item, index) => (item.pinned ? index : last), -1);
  const inlineCount = Math.max(visibleCount, lastPinned + 1);
  const visible = TOOLBAR_ITEMS.slice(0, inlineCount);
  const hidden = TOOLBAR_ITEMS.slice(inlineCount);
  const moreEntries: ToolbarMenuItem[] = hiddenMenuItems(hidden, commands, run);
  // The More trigger shows an active state while a collapsed item's format is on.
  const moreActive = hiddenFormatActive(hidden, active);

  return (
    <div ref={rowRef} className="mx-auto flex w-full items-center gap-0.5 px-2 py-1">
      {visible.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 && visible[index - 1].group !== item.group && <Divider />}
          <ItemControl
            item={item}
            index={index}
            commands={commands}
            active={active}
            disabled={disabled}
            run={run}
            setItemRef={setItemRef}
          />
        </Fragment>
      ))}
      <ToolbarMenu
        label="More"
        icon={Ellipsis}
        items={moreEntries}
        pressed={moreActive}
        disabled={disabled}
        measureRef={(element) => { moreRef.current = element; }}
      />
    </div>
  );
}

/**
 * Grouped formatting toolbar wired to an editor-agnostic {@link EditorCommands}
 * set. Spans the full editor column (`w-full`) with a frosted-glass
 * background and a 1px stone divider to the editor below. Items come from one
 * priority-ordered list; the first {@link useOverflowCount} items render
 * inline based on measured widths, and the rest collapse into an always
 * rendered More menu, so the Insert trigger lives only in the mobile
 * KeyboardBar. Dividers render only between adjacent visible groups. The
 * Paragraph style trigger is pinned inline. In source mode (`canFormat`
 * false) formatting controls are disabled while Undo and Redo stay enabled.
 *
 * @param props - See {@link FormattingToolbarProps}.
 * @returns The rendered toolbar element.
 */
export function FormattingToolbar({ commands }: FormattingToolbarProps) {
  const disabled = !commands.canFormat;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="hidden md:flex w-full border-b border-stone-200 bg-white/70 backdrop-blur-md saturate-150"
    >
      <ToolbarRow commands={commands} disabled={disabled} />
    </div>
  );
}
