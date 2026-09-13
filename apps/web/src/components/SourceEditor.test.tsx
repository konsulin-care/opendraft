import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';

// @vitest-environment jsdom

afterEach(cleanup);

describe('SourceEditor', () => {
  it('renders a CodeMirror editor with the initial value', () => {
    const { container } = render(
      <SourceEditor value="# Hello" onChange={vi.fn()} />,
    );
    const cmEditor = container.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();
    expect(cmEditor!.textContent).toContain('# Hello');
  });

  it('fires onChange when the document changes', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <SourceEditor value="initial" onChange={onChange} />,
    );
    const cmEditor = container.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();

    // Simulate a keystroke via CodeMirror's view
    const cmElement = cmEditor as HTMLElement & { cmView?: { view: EditorView } };
    const view = cmElement.cmView?.view;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: 0, insert: 'X' },
      });
      expect(onChange).toHaveBeenCalled();
    }
  });

  it('exposes imperative methods via ref', () => {
    let ref: SourceEditorHandle | null = null;
    render(
      <SourceEditor
        value="test"
        onChange={vi.fn()}
        ref={(r) => { ref = r; }}
      />,
    );
    expect(ref).not.toBeNull();
    expect(typeof ref!.getCursor).toBe('function');
    expect(typeof ref!.setCursor).toBe('function');
    expect(typeof ref!.getScrollTop).toBe('function');
    expect(typeof ref!.setScrollTop).toBe('function');
  });
});
