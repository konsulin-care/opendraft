import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { KeyboardBar } from './KeyboardBar';
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

/** Accessible names of the keyboard bar buttons with the toolbar preference on. */
const BAR_NAMES = ['Undo', 'Redo', 'Paragraph style', 'Bullet list', 'Citation', 'Insert'];

/** Formatting button names that must be disabled in source mode. */
const FORMATTING_NAMES = ['Paragraph style', 'Bullet list', 'Citation', 'Insert'];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KeyboardBar buttons', () => {
  it('renders Undo, Redo, Paragraph style, Bullet list, Citation, and Insert when open with the preference on', () => {
    render(<KeyboardBar commands={fakeCommands()} open bottomOffset={0} formattingToolbar />);
    const bar = screen.getByRole('toolbar', { name: 'Keyboard bar' });
    const names = within(bar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(BAR_NAMES);
  });

  it('renders only Undo and Redo when the formattingToolbar preference is off', () => {
    render(<KeyboardBar commands={fakeCommands()} open bottomOffset={0} formattingToolbar={false} />);
    const bar = screen.getByRole('toolbar', { name: 'Keyboard bar' });
    const names = within(bar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(['Undo', 'Redo']);
  });

  it('renders nothing when the keyboard is closed', () => {
    const { container } = render(
      <KeyboardBar commands={fakeCommands()} open={false} bottomOffset={250} formattingToolbar />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('is fixed at the bottom with style bottom equal to bottomOffset', () => {
    const { container } = render(
      <KeyboardBar commands={fakeCommands()} open bottomOffset={284} formattingToolbar />,
    );
    const bar = container.querySelector('[role="toolbar"]')!;
    expect(bar).toHaveStyle({ position: 'fixed', bottom: '284px' });
  });

  it('prevents the default on pointerdown for its buttons', () => {
    render(<KeyboardBar commands={fakeCommands()} open bottomOffset={0} formattingToolbar />);
    for (const name of BAR_NAMES) {
      // fireEvent returns false when preventDefault() was called.
      expect(fireEvent.pointerDown(screen.getByRole('button', { name })), name).toBe(false);
    }
  });
});

describe('KeyboardBar command wiring', () => {
  it('runs commands from its buttons and menus', () => {
    const commands = fakeCommands();
    render(<KeyboardBar commands={commands} open bottomOffset={0} formattingToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bullet list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Citation' }));
    expect(commands.undo).toHaveBeenCalledTimes(1);
    expect(commands.redo).toHaveBeenCalledTimes(1);
    expect(commands.bulletList).toHaveBeenCalledTimes(1);
    expect(commands.insertCitation).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph style' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Heading 2' }));
    expect(commands.setHeading).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Table' }));
    expect(commands.table).toHaveBeenCalledTimes(1);
  });
});

describe('KeyboardBar in source mode (canFormat false)', () => {
  it('disables formatting buttons but keeps Undo and Redo enabled', () => {
    render(
      <KeyboardBar commands={fakeCommands(INACTIVE_STATE, false)} open bottomOffset={0} formattingToolbar />,
    );
    for (const name of FORMATTING_NAMES) {
      expect(screen.getByRole('button', { name }), name).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
  });
});

describe('EditorToolbars while the keyboard is open', () => {
  it('does not render FormattingToolbar while open is true', () => {
    const { container } = render(
      <EditorToolbars commands={fakeCommands()} formattingToolbar open bottomOffset={0} />,
    );
    expect(container.querySelector('[aria-label="Formatting"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();
    expect(container.querySelector('[aria-label="Keyboard bar"]')).not.toBeNull();
  });

  it('renders FormattingToolbar while open is false', () => {
    const { container } = render(
      <EditorToolbars commands={fakeCommands()} formattingToolbar open={false} bottomOffset={0} />,
    );
    expect(container.querySelector('[aria-label="Formatting"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Keyboard bar"]')).toBeNull();
  });
});
