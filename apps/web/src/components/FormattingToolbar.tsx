import {
  AtSign,
  Bold,
  Code,
  Ellipsis,
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
function Divider({ className = '' }: { className?: string }) {
  return <div className={`${DIVIDER_CLASS} ${className}`.trim()} aria-hidden="true" />;
}

/**
 * Build the Paragraph style menu items from the current heading level.
 *
 * @param heading - Active heading level, 0 for a plain paragraph.
 * @param onSelect - Runs `setHeading` with the chosen level.
 * @returns Menu items with the current one marked checked.
 */
export function headingItems(heading: BlockLevel, onSelect: (level: BlockLevel) => void): ToolbarMenuItem[] {
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

/** Inline emphasis group: bold, italic, strikethrough; inline code is lg+. */
function EmphasisGroup({ commands, active, disabled, run }: GroupProps) {
  const buttons: Array<[label: string, icon: LucideIcon, pressed: boolean, action: () => void]> = [
    ['Bold', Bold, active.bold, commands.toggleBold],
    ['Italic', Italic, active.italic, commands.toggleItalic],
    ['Strikethrough', Strikethrough, active.strike, commands.toggleStrike],
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
      <span className="hidden lg:block">
        <ToolbarButton
          label="Inline code"
          icon={Code}
          pressed={active.inlineCode}
          disabled={disabled}
          onClick={() => run(commands.toggleInlineCode)}
        />
      </span>
    </div>
  );
}

/** Insert-inline group: link, citation, inline math; lg and up only. */
function InlineGroup({ commands, active, disabled, run }: GroupProps) {
  return (
    <div className="hidden lg:flex items-center gap-0.5">
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

/** Block-structure group: bullet, numbered and task lists, quote; lg and up only. */
function ListGroup({ commands, active, disabled, run }: GroupProps) {
  return (
    <div className="hidden lg:flex items-center gap-0.5">
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
export function insertItems(
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
 * Build the More overflow-menu items shown below the lg breakpoint: the
 * inline, list, and block-insert actions that the compact toolbar hides.
 *
 * @param commands - Command set bound to the active editor surface.
 * @param run - Runs a command, then refreshes the active state.
 * @returns Menu items for the More overflow menu.
 */
export function moreItems(
  commands: EditorCommands,
  run: (action: () => void) => void,
): ToolbarMenuItem[] {
  return [
    { label: 'Link', icon: Link, onSelect: () => run(commands.toggleLink) },
    { label: 'Citation', icon: AtSign, onSelect: () => run(commands.insertCitation) },
    { label: 'Inline math', icon: Sigma, onSelect: () => run(commands.inlineMath) },
    { label: 'Inline code', icon: Code, onSelect: () => run(commands.toggleInlineCode) },
    { label: 'Bullet list', icon: List, onSelect: () => run(commands.bulletList) },
    { label: 'Numbered list', icon: ListOrdered, onSelect: () => run(commands.orderedList) },
    { label: 'Task list', icon: ListTodo, onSelect: () => run(commands.taskList) },
    { label: 'Quote', icon: TextQuote, onSelect: () => run(commands.blockquote) },
    { label: 'Code block', icon: SquareCode, onSelect: () => run(commands.codeBlock) },
    { label: 'Table', icon: Table, onSelect: () => run(commands.table) },
    { label: 'Image', icon: ImagePlus, onSelect: () => run(commands.image) },
    { label: 'Rule', icon: Minus, onSelect: () => run(commands.hr) },
  ];
}

/**
 * Grouped formatting toolbar wired to an editor-agnostic {@link EditorCommands}
 * set. Spans the full editor width with a frosted-glass background
 * (translucent white, backdrop blur, saturate) and a 1px stone divider to the
 * editor below; the button column stays inside the same centered reading
 * column as the editor surface. Hidden below the md breakpoint via
 * `hidden md:flex`. Below the lg breakpoint the inline-code button and the
 * inline and list groups collapse into a More overflow menu. In source mode
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
  const mores: ToolbarMenuItem[] = moreItems(commands, run);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="hidden md:flex w-full border-b border-stone-200 bg-white/70 backdrop-blur-md saturate-150"
    >
      <div className="mx-auto flex w-[80%] items-center gap-0.5 px-2 py-1">
        <HistoryGroup {...groupProps} />
        <Divider />
        <ToolbarMenu label="Paragraph style" icon={Pilcrow} items={paragraphs} disabled={disabled} />
        <Divider />
        <EmphasisGroup {...groupProps} />
        {/* The two dividers around the lg-only groups vanish below lg so the
            compact toolbar shows one divider per visible group. */}
        <Divider className="hidden lg:block" />
        <InlineGroup {...groupProps} />
        <Divider className="hidden lg:block" />
        <ListGroup {...groupProps} />
        <Divider />
        <ToolbarMenu label="Insert" icon={Plus} items={inserts} disabled={disabled} />
        <Divider className="lg:hidden" />
        <ToolbarMenu
          label="More"
          icon={Ellipsis}
          items={mores}
          disabled={disabled}
          wrapClassName="lg:hidden"
        />
      </div>
    </div>
  );
}
