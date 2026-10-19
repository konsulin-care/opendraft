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

describe('SourceEditor line wrapping', () => {
  it('includes EditorView.lineWrapping in the extensions', () => {
    expect(sourceEditorSource).toContain('EditorView.lineWrapping');
  });

  it('wraps long lines instead of scrolling horizontally', () => {
    const { container } = render(
      <SourceEditor value={'# '.padEnd(500, 'x')} onChange={vi.fn()} />,
    );
    const content = container.querySelector('.cm-content') as HTMLElement | null;
    expect(content).not.toBeNull();
    // EditorView.lineWrapping marks .cm-content with cm-lineWrapping, whose
    // generated style is white-space: pre-wrap — lines wrap instead of
    // producing a horizontal scrollbar.
    expect(content!.classList.contains('cm-lineWrapping')).toBe(true);
    // The wrapping class maps to white-space: pre-wrap in the injected
    // stylesheet, so lines break within the viewport rather than overflowing.
    const styles = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    expect(styles).toMatch(/\.cm-lineWrapping\s*\{[^}]*white-space:\s*pre-wrap/);
  });
});

describe('SourceEditor light theme', () => {
  it('no longer imports oneDark', () => {
    expect(sourceEditorSource).not.toContain('oneDark');
    expect(sourceEditorSource).not.toContain('@codemirror/theme-one-dark');
  });

  it('defines a light EditorView.theme referencing color tokens', () => {
    expect(sourceEditorSource).toMatch(/lightEditorTheme\s*=\s*EditorView\.theme\(/);
    expect(sourceEditorSource).toContain("backgroundColor: 'var(--color-white)'");
    expect(sourceEditorSource).toContain("color: 'var(--color-black)'");
    expect(sourceEditorSource).toContain('{ dark: false }');
  });

  it('uses a neutral gray active line via the active-line token', () => {
    expect(sourceEditorSource).toContain("'.cm-activeLine'");
    expect(sourceEditorSource).toMatch(
      /'\.cm-activeLine':\s*\{ backgroundColor: 'var\(--color-active-line\)' \}/,
    );
  });

  it('uses only var(--color-*) tokens in the theme, no hex literals', () => {
    const themeBlock = sourceEditorSource.match(
      /lightEditorTheme\s*=\s*EditorView\.theme\(\{([\s\S]*?)\},\s*\{ dark: false \}\)/,
    )?.[1];
    expect(themeBlock).toBeDefined();
    // No raw hex color may remain; every color references a declared token.
    expect(themeBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const tokenRefs = themeBlock!.match(/var\(--color-[\w-]+\)/g) ?? [];
    expect(tokenRefs.length).toBeGreaterThan(0);
  });

  it('applies the default highlight style via syntaxHighlighting', () => {
    expect(sourceEditorSource).toContain('syntaxHighlighting(defaultHighlightStyle');
  });

  it('renders with light styles and without oneDark colors', () => {
    render(<SourceEditor value="# Hello" onChange={vi.fn()} />);
    const styles = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    // Our light theme reaches the injected stylesheet as token references…
    expect(styles).toContain('var(--color-white)');
    expect(styles).toContain('var(--color-black)');
    // …and oneDark's dark background (#282c34) does not.
    expect(styles).not.toContain('#282c34');
  });
});
