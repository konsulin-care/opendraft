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
  Redo2,
  Sigma,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
  Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ToolbarMenuItem } from './ToolbarMenu';
import type { ActiveState, BlockLevel, EditorCommands } from '../editor-commands/types';

/** Toolbar item groups, in render order; dividers sit between visible groups. */
export type ToolbarItemGroup = 'history' | 'style' | 'emphasis' | 'inline' | 'list' | 'insert';

/** Boolean ActiveState fields that can drive a button's `aria-pressed`. */
export type PressedKey = Exclude<keyof ActiveState, 'heading'>;

/** One entry of the priority-ordered toolbar item list. */
export interface ToolbarItemDef {
  /** Stable key used as the React key. */
  key: string;
  /** Accessible name rendered on the button or trigger. */
  label: string;
  /** Icon rendered inside the control and its More-menu entry. */
  icon: LucideIcon;
  /** Group used to place dividers between visible items. */
  group: ToolbarItemGroup;
  /** Pinned items are always rendered inline, never in More. */
  pinned?: boolean;
  /** ActiveState field reflected as `aria-pressed` on the button. */
  pressedKey?: PressedKey;
  /** Command invoked on activation; absent for the paragraph-style menu trigger. */
  command?: (commands: EditorCommands) => void;
}

/**
 * Flat priority-ordered list of desktop toolbar items across the six groups:
 * history, paragraph style, emphasis, inline, list, and insert. Items at the
 * end collapse into the More menu first, so the insert actions (Image, Table,
 * Code block, Rule) overflow before anything else.
 */
export const TOOLBAR_ITEMS: readonly ToolbarItemDef[] = [
  { key: 'undo', label: 'Undo', icon: Undo2, group: 'history', command: (c) => c.undo() },
  { key: 'redo', label: 'Redo', icon: Redo2, group: 'history', command: (c) => c.redo() },
  { key: 'paragraph', label: 'Paragraph style', icon: Pilcrow, group: 'style', pinned: true },
  { key: 'bold', label: 'Bold', icon: Bold, group: 'emphasis', pressedKey: 'bold', command: (c) => c.toggleBold() },
  { key: 'italic', label: 'Italic', icon: Italic, group: 'emphasis', pressedKey: 'italic', command: (c) => c.toggleItalic() },
  { key: 'strike', label: 'Strikethrough', icon: Strikethrough, group: 'emphasis', pressedKey: 'strike', command: (c) => c.toggleStrike() },
  { key: 'inline-code', label: 'Inline code', icon: Code, group: 'emphasis', pressedKey: 'inlineCode', command: (c) => c.toggleInlineCode() },
  { key: 'link', label: 'Link', icon: Link, group: 'inline', pressedKey: 'link', command: (c) => c.toggleLink() },
  { key: 'citation', label: 'Citation', icon: AtSign, group: 'inline', command: (c) => c.insertCitation() },
  { key: 'inline-math', label: 'Inline math', icon: Sigma, group: 'inline', command: (c) => c.inlineMath() },
  { key: 'bullet-list', label: 'Bullet list', icon: List, group: 'list', pressedKey: 'bulletList', command: (c) => c.bulletList() },
  { key: 'ordered-list', label: 'Numbered list', icon: ListOrdered, group: 'list', pressedKey: 'orderedList', command: (c) => c.orderedList() },
  { key: 'task-list', label: 'Task list', icon: ListTodo, group: 'list', command: (c) => c.taskList() },
  { key: 'quote', label: 'Quote', icon: TextQuote, group: 'list', pressedKey: 'blockquote', command: (c) => c.blockquote() },
  { key: 'image', label: 'Image', icon: ImagePlus, group: 'insert', command: (c) => c.image() },
  { key: 'table', label: 'Table', icon: Table, group: 'insert', command: (c) => c.table() },
  { key: 'code-block', label: 'Code block', icon: SquareCode, group: 'insert', command: (c) => c.codeBlock() },
  { key: 'rule', label: 'Rule', icon: Minus, group: 'insert', command: (c) => c.hr() },
];

/** Paragraph style menu entries: paragraph plus headings 1-3. */
const HEADINGS: Array<[level: BlockLevel, label: string, icon: LucideIcon]> = [
  [0, 'Paragraph', Pilcrow],
  [1, 'Heading 1', Heading1],
  [2, 'Heading 2', Heading2],
  [3, 'Heading 3', Heading3],
];

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

/**
 * Build the Insert menu items: image, table, code block, rule. Kept for the
 * mobile KeyboardBar, which renders its own Insert dropdown.
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
 * Build the More-menu entries for the hidden tail of the item list, in
 * priority order, each running its item's command.
 *
 * @param hidden - Items beyond the visible count, in list order.
 * @param commands - Command set bound to the active editor surface.
 * @param run - Runs a command, then refreshes the active state.
 * @returns Menu items for the More overflow menu.
 */
export function hiddenMenuItems(
  hidden: readonly ToolbarItemDef[],
  commands: EditorCommands,
  run: (action: () => void) => void,
): ToolbarMenuItem[] {
  return hidden
    .filter((item) => item.command !== undefined)
    .map((item) => ({
      label: item.label,
      icon: item.icon,
      onSelect: () => {
        const command = item.command;
        if (command) run(() => command(commands));
      },
    }));
}
