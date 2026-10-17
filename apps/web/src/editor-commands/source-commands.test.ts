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
    commands.table();
    commands.hr();
    commands.image();
    expect(getText()).toBe('plain text');
  });

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
