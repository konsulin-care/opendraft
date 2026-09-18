// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manuscriptSource = readFileSync(
  fileURLToPath(new URL("./components/ManuscriptEditor.tsx", import.meta.url)),
  "utf8",
);
const editorSurfaceSource = readFileSync(
  fileURLToPath(new URL("./components/EditorSurface.tsx", import.meta.url)),
  "utf8",
);
const css = readFileSync(
  fileURLToPath(new URL("./index.css", import.meta.url)),
  "utf8",
);

describe("ManuscriptEditor crepe theme integration", () => {
  it("does not import Crepe theme CSS in the component", () => {
    expect(manuscriptSource).not.toContain("@milkdown/crepe/theme/common/style.css");
    expect(manuscriptSource).not.toContain("@milkdown/crepe/theme/classic.css");
  });

  it("does not import the split prosemirror/reset sheets", () => {
    expect(manuscriptSource).not.toContain("@milkdown/crepe/theme/common/prosemirror.css");
    expect(manuscriptSource).not.toContain("@milkdown/crepe/theme/common/reset.css");
  });

  it("imports Crepe theme CSS in index.css without a cascade layer", () => {
    expect(css).not.toMatch(/@layer\s+crepe/);
    expect(css).toContain("@milkdown/crepe/theme/common/style.css");
    expect(css).toContain("@milkdown/crepe/theme/classic.css");
  });

  it("configures a static placeholder feature", () => {
    expect(manuscriptSource).toContain("Crepe.Feature.Placeholder");
    expect(manuscriptSource).toContain("PLACEHOLDER_HINT");
    expect(manuscriptSource).not.toContain("pickPlaceholderHint");
  });

  it("configures block handle at content edge", () => {
    expect(manuscriptSource).toContain("Crepe.Feature.BlockEdit");
    expect(manuscriptSource).toContain("blockHandle");
    expect(manuscriptSource).toContain("shouldShow: () => false");
  });

  it("imports and registers the block-gutter plugin", () => {
    expect(manuscriptSource).toContain("block-handle-gutter");
    expect(manuscriptSource).toContain("createBlockGutterPlugin");
  });
});

describe("ManuscriptEditor — gutter plugin registration", () => {
  it("imports $prose from @milkdown/kit/utils", () => {
    expect(manuscriptSource).toContain("$prose");
    expect(manuscriptSource).toMatch(/\$prose.*from\s+['"]@milkdown\/kit\/utils['"]|@milkdown\/kit\/utils.*\$prose/);
  });

  it("registers gutter plugin via crepe.addFeature() before create()", () => {
    expect(manuscriptSource).toContain("crepe.addFeature");
    expect(manuscriptSource).toContain("$prose(() => createBlockGutterPlugin())");
  });

  it("does not import or use prosePluginsCtx (gutter registered via addFeature)", () => {
    expect(manuscriptSource).not.toContain("prosePluginsCtx");
  });
});

describe("ManuscriptEditor — light code block theme", () => {
  it("imports EditorView from @codemirror/view", () => {
    expect(manuscriptSource).toMatch(/EditorView.*from\s+['"]@codemirror\/view['"]|@codemirror\/view.*EditorView/);
  });

  it("defines a lightCodeBlockTheme via EditorView.theme()", () => {
    expect(manuscriptSource).toMatch(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(/);
  });

  it("sets cm-activeLine background to light yellow (#fef9c3)", () => {
    expect(manuscriptSource).toContain("'.cm-activeLine'");
    expect(manuscriptSource).toContain("backgroundColor");
    expect(manuscriptSource).toContain("#fef9c3");
  });

  it("sets cm-activeLineGutter background to light yellow (#fef9c3)", () => {
    expect(manuscriptSource).toContain("'.cm-activeLineGutter'");
    expect(manuscriptSource).toContain("#fef9c3");
  });

  it("sets cm-selectionBackground background to light yellow (#fef9c3)", () => {
    expect(manuscriptSource).toContain("'.cm-selectionBackground'");
    expect(manuscriptSource).toContain("#fef9c3");
  });

  it("overrides focused selection background to light yellow (#fef9c3)", () => {
    expect(manuscriptSource).toContain("'.cm-focused .cm-selectionBackground'");
    expect(manuscriptSource).toContain("#fef9c3");
  });

  it("wires the theme into the CodeMirror feature config", () => {
    expect(manuscriptSource).toContain("Crepe.Feature.CodeMirror");
    expect(manuscriptSource).toContain("theme: lightCodeBlockTheme");
  });
});

describe("ManuscriptEditor — citation dropdown mounting", () => {
  it("imports citationPluginKey from citation plugin", () => {
    expect(manuscriptSource).toContain("citationPluginKey");
    expect(manuscriptSource).toMatch(/citationPluginKey.*from.*['"].*citation/);
  });

  it("registers citation plugin via crepe.addFeature()", () => {
    expect(manuscriptSource).toContain("createCitationPlugin");
    expect(manuscriptSource).toMatch(/\$prose.*createCitationPlugin/);
  });

  it("no longer renders CitationDropdown in EditorSurface (rendered by plugin)", () => {
    expect(editorSurfaceSource).not.toContain("<CitationDropdown");
    expect(editorSurfaceSource).not.toContain("citationState");
    expect(editorSurfaceSource).not.toContain("onCitationDispatch");
    expect(editorSurfaceSource).not.toContain("onSelectCitekey");
  });
});

describe("ManuscriptEditor — @ trigger integration", () => {
  it("imports useCitationState hook", () => {
    expect(manuscriptSource).toContain("useCitationState");
    expect(manuscriptSource).toMatch(/useCitationState.*from.*['"].*citation/);
  });

  it("uses onStateChangeRef to wire citation plugin", () => {
    expect(manuscriptSource).toContain("onStateChangeRef");
    expect(manuscriptSource).toContain("createCitationPlugin");
    expect(manuscriptSource).toContain("onStateChangeRef.current");
  });

  it("imports editorViewCtx for citation trigger detection", () => {
    expect(manuscriptSource).toContain("editorViewCtx");
    expect(manuscriptSource).toMatch(/editorViewCtx.*from.*['"]@milkdown\/kit\/core['"]/);
  });
});

describe("ManuscriptEditor — citekey insertion", () => {
  it("gets trigger from citationPluginKey state", () => {
    expect(manuscriptSource).toContain("citationPluginKey.getState");
    expect(manuscriptSource).toContain("state.trigger");
  });

  it("inserts bracketed citation [@citekey] when trigger.bracketed is true", () => {
    expect(manuscriptSource).toContain("bracketed");
    expect(manuscriptSource).toMatch(/\[@\$\{citekey\}\]/);
  });

  it("inserts inline citation @citekey when trigger.bracketed is false", () => {
    expect(manuscriptSource).toMatch(/@\$\{citekey\}/);
  });

  it("replaces from @ position through cursor (not just @ char)", () => {
    // Must replace trigger.from to cursor, not from+1, so query text is also removed
    expect(manuscriptSource).toContain("insertText");
    expect(manuscriptSource).not.toMatch(/from\s*,\s*from\s*\+\s*1/);
    expect(manuscriptSource).toContain("cursorPos");
  });

  it("closes citation dropdown after insertion", () => {
    expect(manuscriptSource).toContain("CLOSE_CITATION");
  });
});