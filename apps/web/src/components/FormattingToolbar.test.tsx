import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FormattingToolbar } from './FormattingToolbar';
import { EditorToolbars } from './EditorToolbars';
import { INACTIVE_STATE } from '../editor-commands/types';
import type { ActiveState, EditorCommands } from '../editor-commands/types';

/**
 * Build a fake {@link EditorCommands} with a spy per action.
 *
 * @param active - Active state reported at the selection.
 * @param canFormat - Whether formatting actions are available.
 * @returns A command set with vi.fn() spies.
 */
function fakeCommands(active: ActiveState = INACTIVE_STATE, canFormat = true): EditorCommands {
  return {
    canFormat,
    undo: vi.fn(),
    redo: vi.fn(),
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleStrike: vi.fn(),
    toggleInlineCode: vi.fn(),
    toggleLink: vi.fn(),
    insertCitation: vi.fn(),
    inlineMath: vi.fn(),
    setHeading: vi.fn(),
    bulletList: vi.fn(),
    orderedList: vi.fn(),
    taskList: vi.fn(),
    blockquote: vi.fn(),
    codeBlock: vi.fn(),
    table: vi.fn(),
    hr: vi.fn(),
    image: vi.fn(),
    activeState: () => active,
  };
}

/** Accessible names of the toolbar buttons, in large-screen order. */
const LARGE_LAYOUT: Array<[name: string, icon: string]> = [
  ['Undo', 'lucide-undo-2'],
  ['Redo', 'lucide-redo-2'],
  ['Paragraph style', 'lucide-pilcrow'],
  ['Bold', 'lucide-bold'],
  ['Italic', 'lucide-italic'],
  ['Strikethrough', 'lucide-strikethrough'],
  ['Inline code', 'lucide-code'],
  ['Link', 'lucide-link'],
  ['Citation', 'lucide-at-sign'],
  ['Inline math', 'lucide-sigma'],
  ['Bullet list', 'lucide-list'],
  ['Numbered list', 'lucide-list-ordered'],
  ['Task list', 'lucide-list-todo'],
  ['Quote', 'lucide-text-quote'],
  ['Insert', 'lucide-plus'],
];

/** Formatting buttons disabled in source mode. */
const FORMATTING_NAMES = LARGE_LAYOUT.map(([name]) => name).filter(
  (name) => name !== 'Undo' && name !== 'Redo',
);

beforeEach(() => {
  vi.clearAllMocks();
});

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
    // Six groups separated by five dividers.
    expect(toolbar.querySelectorAll('.w-px')).toHaveLength(5);
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
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Paragraph',
      'Heading 1',
      'Heading 2',
      'Heading 3',
    ]);
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Heading 1' }));
    expect(commands.setHeading).toHaveBeenCalledWith(1);
  });

  it('Insert menu offers Image, Table, Code block, and Rule', () => {
    const commands = fakeCommands();
    render(<FormattingToolbar commands={commands} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    const icons: Array<[string, string]> = [
      ['Image', 'lucide-image-plus'],
      ['Table', 'lucide-table'],
      ['Code block', 'lucide-square-code'],
      ['Rule', 'lucide-minus'],
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

describe('Crepe selection toolbar stays enabled (source scan)', () => {
  const manuscriptSource = readFileSync(
    resolve(__dirname, 'ManuscriptEditor.tsx'),
    'utf8',
  );

  it('ManuscriptEditor.tsx does not disable Crepe.Feature.Toolbar', () => {
    expect(manuscriptSource).not.toMatch(/Crepe\.Feature\.Toolbar[^\n]*false/);
  });

  it('App.tsx passes the formattingToolbar preference to ManuscriptEditor', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    expect(appSource).toMatch(/formattingToolbar=\{formattingToolbar\}/);
  });
});
