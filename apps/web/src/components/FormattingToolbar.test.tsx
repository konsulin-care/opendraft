import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FormattingToolbar } from './FormattingToolbar';
import { TOOLBAR_ITEMS } from './toolbar-items';
import { EditorToolbars } from './EditorToolbars';
import { INACTIVE_STATE } from '../editor-commands/types';
import type { ActiveState, EditorCommands } from '../editor-commands/types';

/** Controllable visible count returned by the mocked overflow hook. */
const { overflow } = vi.hoisted(() => ({ overflow: { visibleCount: 6 } }));

// jsdom measures every width as 0, so tests mock the hook and set the count directly.
vi.mock('./use-overflow-count', () => ({
  useOverflowCount: ({ itemCount }: { itemCount: number }) => ({
    visibleCount: Math.min(overflow.visibleCount, itemCount),
    rowRef: { current: null }, moreRef: { current: null }, setItemRef: () => () => undefined,
  }),
}));

/** Action names on {@link EditorCommands} that get a spy. */
const ACTIONS = ['undo', 'redo', 'toggleBold', 'toggleItalic', 'toggleStrike', 'toggleInlineCode', 'toggleLink',
  'insertCitation', 'inlineMath', 'setHeading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock',
  'table', 'hr', 'image'] as const;

/** Inline item labels when the visible count is 6, in row order. */
const INLINE_6 = ['Undo', 'Redo', 'Paragraph style', 'Bold', 'Italic', 'Strikethrough'];
/** Hidden item labels when the visible count is 6, in More-menu order. */
const HIDDEN_6 = ['Inline code', 'Link', 'Citation', 'Inline math', 'Bullet list', 'Numbered list',
  'Task list', 'Quote', 'Image', 'Table', 'Code block', 'Rule'];

/** Build a fake EditorCommands with a vi.fn() spy per action. */
function fakeCommands(active: ActiveState = INACTIVE_STATE, canFormat = true): EditorCommands {
  const spies = Object.fromEntries(ACTIONS.map((name) => [name, vi.fn()]));
  return { ...spies, canFormat, activeState: () => active } as unknown as EditorCommands;
}

/** Accessible aria-label of every inline row button, More trigger included. */
function inlineNames(container: HTMLElement): Array<string | null> {
  const toolbar = container.querySelector('[role="toolbar"]')!;
  return within(toolbar as HTMLElement).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
}

/** The inner row div holding the inline items and the More trigger. */
function rowOf(container: HTMLElement): HTMLElement {
  return container.querySelector('[role="toolbar"] > div') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  overflow.visibleCount = 6;
});

describe('FormattingToolbar inline row (visible count 6)', () => {
  it('renders the first six items inline in priority order, then More', () => {
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    const names = inlineNames(container);
    expect(names.slice(0, 6)).toEqual(INLINE_6);
    expect(names[names.length - 1]).toBe('More');
  });

  it('renders a More trigger and no Insert trigger', () => {
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Insert' })).toBeNull();
    expect(inlineNames(container)).toHaveLength(7);
  });
});

describe('FormattingToolbar dividers (visible groups only)', () => {
  it('renders dividers only between adjacent visible groups, never at row ends', () => {
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    const dividerIndexes = Array.from(rowOf(container).children)
      .map((element, index) => (element.className.includes('w-px') ? index : -1))
      .filter((index) => index >= 0);
    // Between Redo and Paragraph style, and between Paragraph style and Bold.
    expect(dividerIndexes).toEqual([2, 4]);
  });

  it('renders one divider between the two visible groups, none for empty groups', () => {
    overflow.visibleCount = 1;
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    // Pinned Paragraph style forces three inline items: one divider, none at row ends.
    expect(rowOf(container).querySelectorAll('.w-px')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();
  });
});

describe('FormattingToolbar More menu', () => {
  it('lists the hidden items by aria-label when opened', () => {
    render(<FormattingToolbar commands={fakeCommands()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(HIDDEN_6);
  });

  it('reaches Image, Table, Code block, and Rule through More when they overflow', () => {
    const commands = fakeCommands();
    render(<FormattingToolbar commands={commands} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const icons: Array<[string, string]> = [
      ['Image', 'lucide-image-plus'], ['Table', 'lucide-table'],
      ['Code block', 'lucide-square-code'], ['Rule', 'lucide-minus'],
    ];
    for (const [name, icon] of icons) {
      const item = screen.getByRole('menuitem', { name });
      expect(item.querySelector('svg')?.getAttribute('class')).toContain(icon);
    }
    fireEvent.click(screen.getByRole('menuitem', { name: 'Table' }));
    expect(commands.table).toHaveBeenCalledTimes(1);
  });
});

describe('FormattingToolbar More menu overflow entries', () => {
  it('shows Strikethrough inline but Citation and Inline math in More', () => {
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    const strike = screen.getByRole('button', { name: 'Strikethrough' });
    expect(strike.querySelector('svg')?.getAttribute('class')).toContain('lucide-strikethrough');
    expect(rowOf(container).contains(strike)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    for (const [name, icon] of [['Citation', 'lucide-at-sign'], ['Inline math', 'lucide-sigma']] as const) {
      const item = screen.getByRole('menuitem', { name });
      expect(item.querySelector('svg')?.getAttribute('class')).toContain(icon);
    }
  });

  it('portals to document.body and closes after selecting an item', () => {
    const commands = fakeCommands();
    const { container } = render(<FormattingToolbar commands={commands} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(container.querySelector('[role="toolbar"]')!.contains(menu)).toBe(false);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Code block' }));
    expect(commands.codeBlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('still renders the More trigger when every item fits inline', () => {
    overflow.visibleCount = TOOLBAR_ITEMS.length;
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    expect(inlineNames(container)).toHaveLength(TOOLBAR_ITEMS.length + 1);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(within(screen.getByRole('menu')).queryAllByRole('menuitem')).toHaveLength(0);
  });
});

describe('FormattingToolbar button behavior', () => {
  it('clicking Bold calls toggleBold', () => {
    const commands = fakeCommands();
    render(<FormattingToolbar commands={commands} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(commands.toggleBold).toHaveBeenCalledTimes(1);
  });

  it('marks Bold pressed when the active state reports bold', () => {
    render(<FormattingToolbar commands={fakeCommands({ ...INACTIVE_STATE, bold: true })} />);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('prevents the default on mousedown and pointerdown', () => {
    render(<FormattingToolbar commands={fakeCommands()} />);
    const bold = screen.getByRole('button', { name: 'Bold' });
    // fireEvent returns false when preventDefault() was called.
    expect(fireEvent.mouseDown(bold)).toBe(false);
    expect(fireEvent.pointerDown(bold)).toBe(false);
  });
});

describe('FormattingToolbar menus', () => {
  it('Paragraph style menu offers Paragraph and H1-H3 and runs setHeading', () => {
    const commands = fakeCommands();
    render(<FormattingToolbar commands={commands} />);
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph style' }));
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['Paragraph', 'Heading 1', 'Heading 2', 'Heading 3']);
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Heading 1' }));
    expect(commands.setHeading).toHaveBeenCalledWith(1);
  });
});

describe('FormattingToolbar in source mode (canFormat false)', () => {
  it('disables visible formatting controls but keeps Undo and Redo enabled', () => {
    render(<FormattingToolbar commands={fakeCommands(INACTIVE_STATE, false)} />);
    for (const name of [...INLINE_6.slice(2), 'More']) {
      expect(screen.getByRole('button', { name }), name).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
  });
});

describe('FormattingToolbar visibility and responsiveness', () => {
  it('is not rendered when the formattingToolbar preference is off', () => {
    const { container } = render(<EditorToolbars commands={fakeCommands()} formattingToolbar={false} />);
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it('is rendered through EditorToolbars when the preference is on', () => {
    const { container } = render(<EditorToolbars commands={fakeCommands()} formattingToolbar={true} />);
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
  });

  it('hides below the md breakpoint via hidden md:flex classes', () => {
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    const toolbar = container.querySelector('[role="toolbar"]')!;
    expect(toolbar.className).toContain('hidden');
    expect(toolbar.className).toContain('md:flex');
  });
});

describe('FormattingToolbar collapse transition', () => {
  it('wraps the toolbar in the collapse container, open when the preference is on', () => {
    const { container } = render(<EditorToolbars commands={fakeCommands()} formattingToolbar />);
    const wrap = container.querySelector('.editor-toolbar-collapse')!;
    expect(wrap.className).toContain('is-open');
    expect(wrap.querySelector('[role="toolbar"]')).not.toBeNull();
  });

  it('collapses over 150 ms: mounted while closing, unmounted after the timer', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<EditorToolbars commands={fakeCommands()} formattingToolbar />);
      rerender(<EditorToolbars commands={fakeCommands()} formattingToolbar={false} />);
      const wrap = container.querySelector('.editor-toolbar-collapse')!;
      expect(wrap.className).toContain('is-closed');
      // Still mounted so the max-height/opacity transition can run.
      expect(wrap.querySelector('[role="toolbar"]')).not.toBeNull();
      act(() => vi.advanceTimersByTime(150));
      expect(container.querySelector('.editor-toolbar-collapse [role="toolbar"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('index.css responsive layout (source scan)', () => {
  const css = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');
  const toolbar = readFileSync(resolve(__dirname, 'FormattingToolbar.tsx'), 'utf-8');
  const menu = readFileSync(resolve(__dirname, 'ToolbarMenu.tsx'), 'utf-8');

  it('transitions the toolbar collapse on max-height and opacity over 150 ms', () => {
    expect(css).toMatch(/\.editor-toolbar-collapse\s*\{[^}]*transition:[^}]*max-height 150ms/);
    expect(css).toMatch(/\.editor-toolbar-collapse\s*\{[^}]*transition:[^}]*opacity 150ms/);
  });

  it('collapses to zero height and transparent when closed', () => {
    const closed = css.slice(css.indexOf('.editor-toolbar-collapse.is-closed'));
    expect(closed).toContain('max-height: 0');
    expect(closed).toContain('opacity: 0');
  });

  it('drops the transition under prefers-reduced-motion', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/\.editor-toolbar-collapse\s*\{[^}]*transition:\s*none/);
  });

  it('sets the editor reading column to 80% width', () => {
    expect(css).toMatch(/\.manuscript-editor \.editor\s*\{[^}]*width:\s*80%/);
    expect(css).toMatch(/\.manuscript-editor \.source-editor\s*\{[^}]*width:\s*80%/);
  });

  it('fills the editor column with w-full and no lg-only visibility classes', () => {
    expect(toolbar).toMatch(/className="[^"]*\bmx-auto\b[^"]*\bw-full\b/);
    expect(toolbar).not.toContain('w-[80%]');
    expect(toolbar).not.toMatch(/"[^"]*lg:/);
    expect(menu).not.toMatch(/"[^"]*lg:/);
  });
});

describe('Responsive header actions (source scan)', () => {
  const read = (name: string) => readFileSync(resolve(__dirname, name), 'utf-8');

  it('keeps the mode toggle and Commit hidden below md, in the overflow menu instead', () => {
    expect(read('ModeSwitch.tsx')).toMatch(/className="[^"]*\bhidden\b[^"]*\bmd:flex\b/);
    expect(read('AppHeader.tsx')).toMatch(/bg-gray-900 text-white hover:bg-gray-800[^\n]*hidden md:inline-flex/);
    expect(read('AppHeader.tsx')).toMatch(/className=\{COMMIT_BUTTON\}/);
    expect(read('HeaderOverflowMenu.tsx')).toMatch(/className="relative md:hidden"/);
  });
});

describe('Crepe selection toolbar stays enabled (source scan)', () => {
  const crepeConfigSource = readFileSync(resolve(__dirname, 'crepe-config.ts'), 'utf8');

  it('crepe-config.ts does not disable Crepe.Feature.Toolbar', () => {
    expect(crepeConfigSource).not.toMatch(/Crepe\.Feature\.Toolbar[^\n]*false/);
  });

  it('App.tsx passes the formattingToolbar preference to ManuscriptEditor', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    expect(appSource).toMatch(/formattingToolbar=\{formattingToolbar\}/);
  });
});
