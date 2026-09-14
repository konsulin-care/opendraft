// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('./components/ManuscriptEditor.tsx', import.meta.url)),
  'utf8',
);

const css = readFileSync(
  fileURLToPath(new URL('./index.css', import.meta.url)),
  'utf8',
);

describe('ManuscriptEditor crepe theme integration', () => {
  it('does not import Crepe theme CSS in the component', () => {
    expect(source).not.toContain('@milkdown/crepe/theme/common/style.css');
    expect(source).not.toContain('@milkdown/crepe/theme/classic.css');
  });

  it('does not import the split prosemirror/reset sheets', () => {
    expect(source).not.toContain('@milkdown/crepe/theme/common/prosemirror.css');
    expect(source).not.toContain('@milkdown/crepe/theme/common/reset.css');
  });

  it('imports Crepe theme CSS in index.css without a cascade layer', () => {
    expect(css).not.toMatch(/@layer\s+crepe/);
    expect(css).toContain('@milkdown/crepe/theme/common/style.css');
    expect(css).toContain('@milkdown/crepe/theme/classic.css');
  });

  it('configures a static placeholder feature', () => {
    expect(source).toContain('Crepe.Feature.Placeholder');
    expect(source).toContain('PLACEHOLDER_HINT');
    expect(source).not.toContain('pickPlaceholderHint');
  });

  it('configures block handle at content edge', () => {
    expect(source).toContain('Crepe.Feature.BlockEdit');
    expect(source).toContain('blockHandle');
    expect(source).toContain('getOffset: () => 0');
    expect(source).toContain("getPlacement: () => 'left-start'");
  });
});

describe('ManuscriptEditor — light code block theme', () => {
  it('imports EditorView from @codemirror/view', () => {
    expect(source).toMatch(/EditorView.*from\s+['"]@codemirror\/view['"]|@codemirror\/view.*EditorView/);
  });

  it('defines a lightCodeBlockTheme via EditorView.theme()', () => {
    expect(source).toMatch(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(/);
  });

  it('sets cm-activeLine background to light yellow (#fef9c3)', () => {
    expect(source).toContain("'.cm-activeLine'");
    expect(source).toContain('backgroundColor');
    expect(source).toContain('#fef9c3');
  });

  it('sets cm-activeLineGutter background to light yellow (#fef9c3)', () => {
    expect(source).toContain("'.cm-activeLineGutter'");
    expect(source).toContain('#fef9c3');
  });

  it('sets cm-selectionBackground background to light yellow (#fef9c3)', () => {
    expect(source).toContain("'.cm-selectionBackground'");
    expect(source).toContain('#fef9c3');
  });

  it('overrides focused selection background to light yellow (#fef9c3)', () => {
    expect(source).toContain("'.cm-focused .cm-selectionBackground'");
    expect(source).toContain('#fef9c3');
  });

  it('wires the theme into the CodeMirror feature config', () => {
    expect(source).toContain('Crepe.Feature.CodeMirror');
    expect(source).toContain('theme: lightCodeBlockTheme');
  });
});
