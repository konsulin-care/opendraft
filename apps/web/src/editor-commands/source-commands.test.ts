import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import type { EditorView } from '@codemirror/view';
import { SourceEditor, type SourceEditorHandle } from '../components/SourceEditor';
import { createSourceCommands } from './source-commands';
import { INACTIVE_STATE, type EditorCommands } from './types';

// @vitest-environment jsdom

afterEach(cleanup);

/** A mounted SourceEditor bound to a source command set. */
interface MountedSource {
  commands: EditorCommands;
  getView: () => EditorView | null;
  getText: () => string;
  type: (text: string) => void;
}

/**
 * Render a real SourceEditor and bind createSourceCommands to its view.
 *
 * @param initial - Initial document text.
 * @returns The command set plus helpers to inspect and edit the document.
 */
function mountSource(initial: string): MountedSource {
  let handle: SourceEditorHandle | null = null;
  render(
    createElement(SourceEditor, {
      value: initial,
      onChange: () => {},
      ref: (r: SourceEditorHandle | null) => {
        handle = r;
      },
    }),
  );
  const commands = createSourceCommands(() => handle?.getView());
  const getView = () => handle?.getView() ?? null;
  return {
    commands,
    getView,
    getText: () => getView()?.state.doc.toString() ?? '',
    type: (text: string) => {
      const view = getView();
      if (!view) throw new Error('view not mounted');
      view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
    },
  };
}

describe('createSourceCommands', () => {
  it('reports canFormat false and INACTIVE_STATE', () => {
    const { commands } = mountSource('text');
    expect(commands.canFormat).toBe(false);
    expect(commands.activeState()).toEqual(INACTIVE_STATE);
  });

  it('leaves the document unchanged for every formatting method', () => {
    const { commands, getText } = mountSource('plain text');
    commands.toggleBold();
    commands.toggleItalic();
    commands.toggleStrike();
    commands.toggleInlineCode();
    commands.toggleLink();
    commands.insertCitation();
    commands.inlineMath();
    commands.setHeading(1);
    commands.setHeading(0);
    commands.bulletList();
    commands.orderedList();
    commands.taskList();
    commands.blockquote();
    commands.codeBlock();
    commands.hr();
    commands.image();
    expect(getText()).toBe('plain text');
  });
});

describe('createSourceCommands table()', () => {
  it('table() inserts the list-table template on its own lines at the cursor', () => {
    const { commands, getText, getView } = mountSource('plain text');
    getView()?.dispatch({ selection: { anchor: 0 } });
    commands.table();
    expect(getText()).toBe('::: {.list-table}\n\n:::\nplain text');
  });

  it('after table() the source cursor sits on the blank body line', () => {
    const { commands, getView } = mountSource('');
    getView()?.dispatch({ selection: { anchor: 0 } });
    commands.table();
    const view = getView();
    if (!view) throw new Error('view not mounted');
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    expect(line.number).toBe(2);
    expect(line.text).toBe('');
  });

  it('the source editor shows the list-table placeholder on the empty body after table()', () => {
    const { commands, getText, getView } = mountSource('');
    getView()?.dispatch({ selection: { anchor: 0 } });
    commands.table();
    const view = getView();
    if (!view) throw new Error('view not mounted');
    expect(view.dom.querySelector('.cm-list-table-placeholder')).not.toBeNull();
    expect(getText()).not.toContain('Insert your table caption here');
  });
});

describe('createSourceCommands history', () => {
  it('undo restores the previous text and redo reapplies the typed text', () => {
    const { commands, getText, type } = mountSource('');
    type('hello');
    expect(getText()).toBe('hello');
    commands.undo();
    expect(getText()).toBe('');
    commands.redo();
    expect(getText()).toBe('hello');
  });
});
