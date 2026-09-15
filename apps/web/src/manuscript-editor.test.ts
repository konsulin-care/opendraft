// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manuscriptSource = readFileSync(
  fileURLToPath(new URL('./components/ManuscriptEditor.tsx', import.meta.url)),
  'utf8',
);
const editorSurfaceSource = readFileSync(
  fileURLToPath(new URL('./components/EditorSurface.tsx', import.meta.url)),
  'utf8',
);
const css = readFileSync(
  fileURLToPath(new URL('./index.css', import.meta.url)),
  'utf8',
);

describe('ManuscriptEditor crepe theme integration', () => {
  it('does not import Crepe theme CSS in the component', () => {
    expect(manuscriptSource).not.toContain('@milkdown/crepe/theme/common/style.css');
    expect(manuscriptSource).not.toContain('@milkdown/crepe/theme/classic.css');
  });

  it('does not import the split prosemirror/reset sheets', () => {
    expect(manuscriptSource).not.toContain('@milkdown/crepe/theme/common/prosemirror.css');
    expect(manuscriptSource).not.toContain('@milkdown/crepe/theme/common/reset.css');
  });

  it('imports Crepe theme CSS in index.css without a cascade layer', () => {
    expect(css).not.toMatch(/@layer\s+crepe/);
    expect(css).toContain('@milkdown/crepe/theme/common/style.css');
    expect(css).toContain('@milkdown/crepe/theme/classic.css');
  });

  it('configures a static placeholder feature', () => {
    expect(manuscriptSource).toContain('Crepe.Feature.Placeholder');
    expect(manuscriptSource).toContain('PLACEHOLDER_HINT');
    expect(manuscriptSource).not.toContain('pickPlaceholderHint');
  });

  it('configures block handle at content edge', () => {
    expect(manuscriptSource).toContain('Crepe.Feature.BlockEdit');
    expect(manuscriptSource).toContain('blockHandle');
    expect(manuscriptSource).toContain('shouldShow: () => false');
  });

  it('imports and registers the block-gutter plugin', () => {
    expect(manuscriptSource).toContain('block-handle-gutter');
    expect(manuscriptSource).toContain('createBlockGutterPlugin');
  });
});

describe('ManuscriptEditor — gutter plugin registration', () => {
  it('imports $prose from @milkdown/kit/utils', () => {
    expect(manuscriptSource).toContain('$prose');
    expect(manuscriptSource).toMatch(/\$prose.*from\s+['"]@milkdown\/kit\/utils['"]|@milkdown\/kit\/utils.*\$prose/);
  });

  it('registers gutter plugin via crepe.addFeature() before create()', () => {
    expect(manuscriptSource).toContain('crepe.addFeature');
    expect(manuscriptSource).toContain('$prose(() => createBlockGutterPlugin())');
  });

  it('does not import or use prosePluginsCtx (gutter registered via addFeature)', () => {
    expect(manuscriptSource).not.toContain('prosePluginsCtx');
  });
});

describe('ManuscriptEditor — light code block theme', () => {
  it('imports EditorView from @codemirror/view', () => {
    expect(manuscriptSource).toMatch(/EditorView.*from\s+['"]@codemirror\/view['"]|@codemirror\/view.*EditorView/);
  });

  it('defines a lightCodeBlockTheme via EditorView.theme()', () => {
    expect(manuscriptSource).toMatch(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(/);
  });

  it('sets cm-activeLine background to light yellow (#fef9c3)', () => {
    expect(manuscriptSource).toContain("'.cm-activeLine'");
    expect(manuscriptSource).toContain('backgroundColor');
    expect(manuscriptSource).toContain('#fef9c3');
  });

  it('sets cm-activeLineGutter background to light yellow (#fef9c3)', () => {
    expect(manuscriptSource).toContain("'.cm-activeLineGutter'");
    expect(manuscriptSource).toContain('#fef9c3');
  });

  it('sets cm-selectionBackground background to light yellow (#fef9c3)', () => {
    expect(manuscriptSource).toContain("'.cm-selectionBackground'");
    expect(manuscriptSource).toContain('#fef9c3');
  });

  it('overrides focused selection background to light yellow (#fef9c3)', () => {
    expect(manuscriptSource).toContain("'.cm-focused .cm-selectionBackground'");
    expect(manuscriptSource).toContain('#fef9c3');
  });

  it('wires the theme into the CodeMirror feature config', () => {
    expect(manuscriptSource).toContain('Crepe.Feature.CodeMirror');
    expect(manuscriptSource).toContain('theme: lightCodeBlockTheme');
  });
});

describe('ManuscriptEditor — citation dropdown mounting', () => {
  it('imports CitationDropdown from citation module', () => {
    expect(editorSurfaceSource).toContain('CitationDropdown');
    expect(editorSurfaceSource).toMatch(/CitationDropdown.*from.*['"].*citation/);
  });

  it('imports citationPluginKey from citation plugin', () => {
    expect(manuscriptSource).toContain('citationPluginKey');
    expect(manuscriptSource).toMatch(/citationPluginKey.*from.*['"].*citation/);
  });

  it('registers citation plugin via crepe.addFeature()', () => {
    expect(manuscriptSource).toContain('createCitationPlugin');
    expect(manuscriptSource).toMatch(/\$prose.*createCitationPlugin/);
  });

  it('renders CitationDropdown component', () => {
    expect(editorSurfaceSource).toContain('<CitationDropdown');
  });

  it('positions CitationDropdown absolutely over the editor', () => {
    expect(editorSurfaceSource).toMatch(/position:\s*['"]relative['"]|position:\s*relative/);
  });

  it('passes citation state to CitationDropdown', () => {
    expect(editorSurfaceSource).toMatch(/CitationDropdown[^>]*state[=\s]/);
  });

  it('passes dispatch function to CitationDropdown', () => {
    expect(editorSurfaceSource).toMatch(/CitationDropdown[^>]*dispatch[=\s]/);
  });

  it('handles onSelectCitekey to insert citation and close', () => {
    expect(editorSurfaceSource).toContain('onSelectCitekey');
  });
});
