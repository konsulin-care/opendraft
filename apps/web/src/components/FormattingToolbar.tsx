import {
  AtSign,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Plus,
  Redo2,
  Sigma,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
  Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarMenu } from './ToolbarMenu';
import type { ToolbarMenuItem } from './ToolbarMenu';
import { useActiveState } from '../hooks/useActiveState';
import type { ActiveState, BlockLevel, EditorCommands } from '../editor-commands/types';

/** Props for {@link FormattingToolbar}. */
export interface FormattingToolbarProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
}

/** Shared inputs for the individual toolbar group components. */
interface GroupProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** Active marks and block state at the selection. */
  active: ActiveState;
  /** Disables formatting controls, e.g. in source mode. */
  disabled: boolean;
  /** Runs a command, then refreshes the active state. */
  run: (action: () => void) => void;
}

/** Divider element between the six toolbar groups. */
const DIVIDER_CLASS = 'mx-1 h-5 w-px shrink-0 bg-gray-200';

/** Paragraph style menu entries: paragraph plus headings 1-3. */
const HEADINGS: Array<[level: BlockLevel, label: string, icon: LucideIcon]> = [
  [0, 'Paragraph', Pilcrow],
  [1, 'Heading 1', Heading1],
  [2, 'Heading 2', Heading2],
  [3, 'Heading 3', Heading3],
];

/** Visual separator between two toolbar groups. */
function Divider() {
  return <div className={DIVIDER_CLASS} aria-hidden="true" />;
}

/**
 * Build the Paragraph style menu items from the current heading level.
 *
 * @param heading - Active heading level, 0 for a plain paragraph.
 * @param onSelect - Runs `setHeading` with the chosen level.
 * @returns Menu items with the current one marked checked.
 */
function headingItems(heading: BlockLevel, onSelect: (level: BlockLevel) => void): ToolbarMenuItem[] {
  return HEADINGS.map(([level, label, icon]) => ({
    label,
    icon,
    checked: heading === level,
    onSelect: () => onSelect(level),
  }));
}

/** Undo and Redo group; stays enabled in source mode. */
function HistoryGroup({ commands, run }: GroupProps) {
  return (
    <div className="flex items-center gap-0.5">
      <ToolbarButton label="Undo" icon={Undo2} onClick={() => run(commands.undo)} />
      <ToolbarButton label="Redo" icon={Redo2} onClick={() => run(commands.redo)} />
    </div>
  );
}

/** Inline emphasis group: bold, italic, strikethrough, inline code. */
function EmphasisGroup({ commands, active, disabled, run }: GroupProps) {
  const buttons: Array<[label: string, icon: LucideIcon, pressed: boolean, action: () => void]> = [
    ['Bold', Bold, active.bold, commands.toggleBold],
    ['Italic', Italic, active.italic, commands.toggleItalic],
    ['Strikethrough', Strikethrough, active.strike, commands.toggleStrike],
    ['Inline code', Code, active.inlineCode, commands.toggleInlineCode],
  ];
  return (
    <div className="flex items-center gap-0.5">
      {buttons.map(([label, icon, pressed, action]) => (
        <ToolbarButton
          key={label}
          label={label}
          icon={icon}
          pressed={pressed}
          disabled={disabled}
          onClick={() => run(action)}
        />
      ))}
    </div>
  );
}

/** Insert-inline group: link, citation, inline math. */
function InlineGroup({ commands, active, disabled, run }: GroupProps) {
  return (
    <div className="flex items-center gap-0.5">
      <ToolbarButton
        label="Link"
        icon={Link}
        pressed={active.link}
        disabled={disabled}
        onClick={() => run(commands.toggleLink)}
      />
      <ToolbarButton
        label="Citation"
        icon={AtSign}
        disabled={disabled}
        onClick={() => run(commands.insertCitation)}
      />
      <ToolbarButton
        label="Inline math"
        icon={Sigma}
        disabled={disabled}
        onClick={() => run(commands.inlineMath)}
      />
    </div>
  );
}

/** Block-structure group: bullet, numbered and task lists, quote. */
function ListGroup({ commands, active, disabled, run }: GroupProps) {
  return (
    <div className="flex items-center gap-0.5">
      <ToolbarButton
        label="Bullet list"
        icon={List}
        pressed={active.bulletList}
        disabled={disabled}
        onClick={() => run(commands.bulletList)}
      />
      <ToolbarButton
        label="Numbered list"
        icon={ListOrdered}
        pressed={active.orderedList}
        disabled={disabled}
        onClick={() => run(commands.orderedList)}
      />
      <ToolbarButton
        label="Task list"
        icon={ListTodo}
        disabled={disabled}
        onClick={() => run(commands.taskList)}
      />
      <ToolbarButton
        label="Quote"
        icon={TextQuote}
        pressed={active.blockquote}
        disabled={disabled}
        onClick={() => run(commands.blockquote)}
      />
    </div>
  );
}

/**
 * Build the Insert menu items: image, table, code block, rule.
 *
 * @param commands - Command set bound to the active editor surface.
 * @param run - Runs a command, then refreshes the active state.
 * @returns Menu items for the Insert dropdown.
 */
function insertItems(
  commands: EditorCommands,
  run: (action: () => void) => void,
): ToolbarMenuItem[] {
  return [
    { label: 'Image', icon: ImagePlus, onSelect: () => run(commands.image) },
    { label: 'Table', icon: Table, onSelect: () => run(commands.table) },
    { label: 'Code block', icon: SquareCode, onSelect: () => run(commands.codeBlock) },
    { label: 'Rule', icon: Minus, onSelect: () => run(commands.hr) },
  ];
}

/**
 * Grouped formatting toolbar wired to an editor-agnostic {@link EditorCommands}
 * set. Hidden below the md breakpoint via `hidden md:flex`. In source mode
 * (`canFormat` false) formatting controls are disabled while Undo and Redo
 * stay enabled. Toggle buttons reflect `activeState()` through `aria-pressed`.
 *
 * @param props - See {@link FormattingToolbarProps}.
 * @returns The rendered toolbar element.
 */
export function FormattingToolbar({ commands }: FormattingToolbarProps) {
  const [active, refresh] = useActiveState(commands);
  const disabled = !commands.canFormat;

  /** Run a command, then re-read the active state so aria-pressed updates. */
  const run = (action: () => void): void => {
    action();
    refresh();
  };

  const groupProps: GroupProps = { commands, active, disabled, run };
  const paragraphs: ToolbarMenuItem[] = headingItems(active.heading, (level) =>
    run(() => commands.setHeading(level)),
  );
  const inserts: ToolbarMenuItem[] = insertItems(commands, run);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="hidden md:flex items-center gap-0.5 border-b border-gray-200 bg-white px-2 py-1"
    >
      <HistoryGroup {...groupProps} />
      <Divider />
      <ToolbarMenu label="Paragraph style" icon={Pilcrow} items={paragraphs} disabled={disabled} />
      <Divider />
      <EmphasisGroup {...groupProps} />
      <Divider />
      <InlineGroup {...groupProps} />
      <Divider />
      <ListGroup {...groupProps} />
      <Divider />
      <ToolbarMenu label="Insert" icon={Plus} items={inserts} disabled={disabled} />
    </div>
  );
}
