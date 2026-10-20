import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FormattingToolbar } from './FormattingToolbar';
import { EditorToolbars } from './EditorToolbars';
import { INACTIVE_STATE } from '../editor-commands/types';
import type { ActiveState, EditorCommands } from '../editor-commands/types';

/** Action names on {@link EditorCommands} that get a spy. */
const ACTIONS = [
  'undo', 'redo', 'toggleBold', 'toggleItalic', 'toggleStrike', 'toggleInlineCode', 'toggleLink', 'insertCitation',
  'inlineMath', 'setHeading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'table', 'hr', 'image',
] as const;

/**
 * Build a fake {@link EditorCommands} with a spy per action.
 *
 * @param active - Active state reported at the selection.
 * @param canFormat - Whether formatting actions are available.
 * @returns A command set with vi.fn() spies.
 */
function fakeCommands(active: ActiveState = INACTIVE_STATE, canFormat = true): EditorCommands {
  const spies = Object.fromEntries(ACTIONS.map((name) => [name, vi.fn()]));
  return { ...spies, canFormat, activeState: () => active } as unknown as EditorCommands;
}

/** Accessible names of the toolbar buttons, in large-screen order. */
const LARGE_LAYOUT: Array<[name: string, icon: string]> = [
  ['Undo', 'lucide-undo-2'], ['Redo', 'lucide-redo-2'], ['Paragraph style', 'lucide-pilcrow'],
  ['Bold', 'lucide-bold'], ['Italic', 'lucide-italic'], ['Strikethrough', 'lucide-strikethrough'],
  ['Inline code', 'lucide-code'], ['Link', 'lucide-link'], ['Citation', 'lucide-at-sign'],
  ['Inline math', 'lucide-sigma'], ['Bullet list', 'lucide-list'], ['Numbered list', 'lucide-list-ordered'],
  ['Task list', 'lucide-list-todo'], ['Quote', 'lucide-text-quote'], ['Insert', 'lucide-plus'],
  // The More overflow trigger is lg:hidden but always in the DOM.
  ['More', 'lucide-ellipsis'],
];

/** Formatting buttons disabled in source mode. */
const FORMATTING_NAMES = LARGE_LAYOUT.map(([name]) => name).filter((name) => name !== 'Undo' && name !== 'Redo');

beforeEach(() => vi.clearAllMocks());

describe('FormattingToolbar buttons', () => {
  it('renders every button with its accessible name and icon', () => {
    render(<FormattingToolbar commands={fakeCommands()} />);
    for (const [name, icon] of LARGE_LAYOUT) {
      const button = screen.getByRole('button', { name });
      expect(button.querySelector('svg')?.getAttribute('class')).toContain(icon);
    }
  });

  it('lays the buttons out in the large-screen group order with dividers', () => {
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    const toolbar = container.querySelector('[role="toolbar"]')!;
    const names = within(toolbar as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(LARGE_LAYOUT.map(([name]) => name));
    // Six in-toolbar groups plus the compact-only More menu, separated by
    // six dividers; the last divider is hidden at the lg breakpoint and up.
    expect(toolbar.querySelectorAll('.w-px')).toHaveLength(6);
  });

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

  it('Insert menu offers Image, Table, Code block, and Rule', () => {
    const commands = fakeCommands();
    render(<FormattingToolbar commands={commands} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
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

describe('FormattingToolbar in source mode (canFormat false)', () => {
  it('disables every formatting control but keeps Undo and Redo enabled', () => {
    render(<FormattingToolbar commands={fakeCommands(INACTIVE_STATE, false)} />);
    for (const name of FORMATTING_NAMES) {
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

describe('FormattingToolbar compact layout (below the lg breakpoint)', () => {
  it('hides the inline-code button and the inline and list groups below lg', () => {
    render(<FormattingToolbar commands={fakeCommands()} />);
    const inlineCode = screen.getByRole('button', { name: 'Inline code' });
    expect(inlineCode.parentElement?.className).toContain('hidden');
    expect(inlineCode.parentElement?.className).toContain('lg:block');
    for (const name of ['Link', 'Citation', 'Inline math', 'Bullet list', 'Numbered list', 'Task list', 'Quote']) {
      const button = screen.getByRole('button', { name });
      expect(button.parentElement?.className, name).toContain('hidden');
      expect(button.parentElement?.className, name).toContain('lg:flex');
    }
  });

  it('hides the dividers around the lg-only groups below lg', () => {
    const { container } = render(<FormattingToolbar commands={fakeCommands()} />);
    const dividers = Array.from(container.querySelectorAll('.w-px'));
    // Compact order: after History, after Paragraph style, after Emphasis,
    // and before More. The two around the hidden groups are lg-only.
    expect(dividers).toHaveLength(6);
    expect(dividers[0].className).not.toContain('hidden');
    expect(dividers[1].className).not.toContain('hidden');
    expect(dividers[2].className).toContain('hidden');
    expect(dividers[2].className).toContain('lg:block');
    expect(dividers[3].className).toContain('hidden');
    expect(dividers[3].className).toContain('lg:block');
    expect(dividers[4].className).not.toContain('hidden');
    expect(dividers[5].className).toContain('lg:hidden');
  });
});

describe('FormattingToolbar menu portal', () => {
  it.each([
    ['Insert', 'image'],
    ['More', 'toggleLink'],
  ] as const)(
    '%s menu portals to document.body and closes after selecting an item',
    (triggerName, action) => {
      const commands = fakeCommands();
      const { container } = render(<FormattingToolbar commands={commands} />);
      const toolbar = container.querySelector('[role="toolbar"]')!;
      fireEvent.click(screen.getByRole('button', { name: triggerName }));
      const menu = screen.getByRole('menu');
      // Portaled to document.body so the backdrop-blur toolbar root and the
      // overflow-hidden collapse container cannot clip it.
      expect(menu.parentElement).toBe(document.body);
      expect(toolbar.contains(menu)).toBe(false);
      const item = within(menu).getAllByRole('menuitem')[0];
      fireEvent.click(item);
      expect(commands[action]).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();
    },
  );
});

describe('FormattingToolbar compact More menu', () => {
  it('shows an Ellipsis More menu below lg holding the hidden actions', () => {
    const commands = fakeCommands();
    render(<FormattingToolbar commands={commands} />);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more.parentElement?.className).toContain('lg:hidden');
    fireEvent.click(more);
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Link', 'Citation', 'Inline math', 'Inline code', 'Bullet list', 'Numbered list',
      'Task list', 'Quote', 'Code block', 'Table', 'Image', 'Rule',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Code block' }));
    expect(commands.codeBlock).toHaveBeenCalledTimes(1);
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
      const { container, rerender } = render(
        <EditorToolbars commands={fakeCommands()} formattingToolbar />,
      );
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

  it('aligns the toolbar button column to the 80% editor column', () => {
    const toolbar = readFileSync(resolve(__dirname, 'FormattingToolbar.tsx'), 'utf-8');
    expect(toolbar).toMatch(/className="[^"]*\bmx-auto\b[^"]*\bw-\[80%\][^"]*"/);
    expect(toolbar).not.toMatch(/max-w-\[70ch\]/);
  });
});

describe('Responsive header actions (source scan)', () => {
  const read = (name: string) => readFileSync(resolve(__dirname, name), 'utf-8');

  it('keeps the mode toggle and Commit hidden below md, in the overflow menu instead', () => {
    expect(read('ModeSwitch.tsx')).toMatch(/className="[^"]*\bhidden\b[^"]*\bmd:flex\b/);
    const appHeader = read('AppHeader.tsx');
    expect(appHeader).toMatch(/bg-gray-900 text-white hover:bg-gray-800[^\n]*hidden md:inline-flex/);
    expect(appHeader).toMatch(/className=\{COMMIT_BUTTON\}/);
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
