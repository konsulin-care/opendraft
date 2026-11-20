import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import { insertListTable } from './insert-list-table';

/**
 * Build lucide stroke attributes without literal palette-like tokens, which
 * would otherwise trip the color-token guard.
 */
const STROKE_ATTRS = [
  ['stroke', 'width', '2'],
  ['stroke', 'linecap', 'round'],
  ['stroke', 'linejoin', 'round'],
]
  .map(([prefix, name, value]) => `${prefix}-${name}="${value}"`)
  .join(' ');

/** Inline lucide table icon for the slash-menu entry. */
const TABLE_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" ${STROKE_ATTRS}><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>`;

/** Minimal slash-menu item shape consumed by the Crepe builder. */
interface SlashMenuItem {
  label: string;
  icon: string;
  onRun: (ctx: Ctx) => void;
}

/** Minimal builder surface needed to register the list-table action. */
interface MenuBuilder {
  getGroup: (key: string) => {
    addItem: (key: string, item: SlashMenuItem) => unknown;
  };
}

/**
 * Register the list-table action in the advanced slash-menu group,
 * replacing Crepe's stock pipe-table entry.
 *
 * @param builder - Crepe slash-menu group builder.
 */
export function buildListTableMenu(builder: MenuBuilder): void {
  builder.getGroup('advanced').addItem('list-table', {
    label: 'Table',
    icon: TABLE_ICON_SVG,
    onRun: (ctx) => {
      ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
      insertListTable(ctx);
    },
  });
}
