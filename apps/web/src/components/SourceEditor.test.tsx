import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';

// @vitest-environment jsdom

afterEach(cleanup);

const sourceEditorSource = readFileSync(resolve(__dirname, 'SourceEditor.tsx'), 'utf8');

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

describe('SourceEditor light theme', () => {
  it('no longer imports oneDark', () => {
    expect(sourceEditorSource).not.toContain('oneDark');
    expect(sourceEditorSource).not.toContain('@codemirror/theme-one-dark');
  });

  it('defines a light EditorView.theme with white background and dark foreground', () => {
    expect(sourceEditorSource).toMatch(/lightEditorTheme\s*=\s*EditorView\.theme\(/);
    expect(sourceEditorSource).toContain("backgroundColor: '#ffffff'");
    expect(sourceEditorSource).toContain("color: '#212529'");
    expect(sourceEditorSource).toContain('{ dark: false }');
  });

  it('uses a neutral gray active line', () => {
    expect(sourceEditorSource).toContain("'.cm-activeLine'");
    expect(sourceEditorSource).toMatch(/'\.cm-activeLine':\s*\{ backgroundColor: '#f2f2f2' \}/);
  });

  it('applies the default highlight style via syntaxHighlighting', () => {
    expect(sourceEditorSource).toContain('syntaxHighlighting(defaultHighlightStyle');
  });

  it('renders with light styles and without oneDark colors', () => {
    render(<SourceEditor value="# Hello" onChange={vi.fn()} />);
    const styles = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    // Our light theme colors reach the injected stylesheet…
    expect(styles).toContain('#ffffff');
    expect(styles).toContain('#212529');
    // …and oneDark's dark background (#282c34) does not.
    expect(styles).not.toContain('#282c34');
  });
});
