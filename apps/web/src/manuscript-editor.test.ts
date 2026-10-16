import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryWorkspace } from "@opendraft/workspace";
import { MilkdownProvider } from "@milkdown/react";
import { EditorView } from "@codemirror/view";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ManuscriptEditor } from "./components/ManuscriptEditor";
import type { EditorTestApi } from "./components/ManuscriptEditor";
import { EditorToolbars } from "./components/EditorToolbars";
import { INACTIVE_STATE } from "./editor-commands/types";
import type { EditorCommands } from "./editor-commands/types";
import { readPreferences, writePreferences } from "./preferences";
import { saveManuscript } from "./persistence";
vi.mock("./persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./persistence")>();
  return { ...actual, saveManuscript: vi.fn().mockResolvedValue(undefined) };
});
const manuscriptSource = readFileSync(
  resolve(__dirname, "./components/ManuscriptEditor.tsx"),
  "utf8",
);
const editorSurfaceSource = readFileSync(
  resolve(__dirname, "./components/EditorSurface.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "./index.css"), "utf8");
/** No-op {@link EditorCommands} set for toolbar rendering tests. */
const stubCommands: EditorCommands = {
  canFormat: false,
  undo: () => {},
  redo: () => {},
  toggleBold: () => {},
  toggleItalic: () => {},
  toggleStrike: () => {},
  toggleInlineCode: () => {},
  toggleLink: () => {},
  insertCitation: () => {},
  inlineMath: () => {},
  setHeading: () => {},
  bulletList: () => {},
  orderedList: () => {},
  taskList: () => {},
  blockquote: () => {},
  codeBlock: () => {},
  table: () => {},
  hr: () => {},
  image: () => {},
  activeState: () => INACTIVE_STATE,
};
/** Render {@link EditorToolbars} with stub commands and an open keyboard. */
function renderToolbars(mode: "wysiwyg" | "source") {
  return render(
    createElement(EditorToolbars, {
      commands: stubCommands,
      formattingToolbar: true,
      mode,
      open: true,
      bottomOffset: 0,
    }),
  );
}
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
});
describe("ManuscriptEditor — block gutter removed", () => {
  it("does not reference the block-gutter plugin in the component source", () => {
    expect(manuscriptSource).not.toContain("block-handle-gutter");
    expect(manuscriptSource).not.toContain("createBlockGutterPlugin");
  });
  it("renders no .block-gutter-container or .block-gutter-handle elements", async () => {
    const workspace = new MemoryWorkspace();
    let api: EditorTestApi | null = null;
    render(createElement(MilkdownProvider, null, createElement(ManuscriptEditor, {
      workspace, defaultValue: "# Title\n\nSome text.", onEditorReady: (r) => { api = r; }, mode: "wysiwyg" as const,
    })));
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    expect(document.querySelector(".block-gutter-container, .block-gutter-handle")).toBeNull();
  }, 20000);
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

describe("ManuscriptEditor — effective formatting toolbar visibility", () => {
  it("hides the toolbar in source mode without changing the stored preference, and shows it again in wysiwyg", async () => {
    writePreferences({ formattingToolbar: true, editorMode: "source" });
    const workspace = new MemoryWorkspace();
    const props = {
      workspace,
      defaultValue: "# Title\n\nSome text.",
      formattingToolbar: readPreferences().formattingToolbar,
    };
    const result = render(
      createElement(MilkdownProvider, null, createElement(ManuscriptEditor, { ...props, mode: "source" })),
    );

    // Source mode: the effective toolbar is hidden even though the
    // stored preference is true.
    await waitFor(() => expect(document.querySelector(".editor-toolbar-collapse")).not.toBeNull());
    expect(document.querySelector(".editor-toolbar-collapse")!.className).toContain("is-closed");
    expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
    expect(readPreferences().formattingToolbar).toBe(true);

    // Switching back to wysiwyg shows the toolbar again; the mode switch
    // must not rewrite the stored preference.
    result.rerender(
      createElement(MilkdownProvider, null, createElement(ManuscriptEditor, { ...props, mode: "wysiwyg" })),
    );
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatting" })).not.toBeNull());
    expect(document.querySelector(".editor-toolbar-collapse")!.className).toContain("is-open");
    expect(readPreferences().formattingToolbar).toBe(true);
  }, 20000);
});

describe("EditorToolbars — mobile keyboard bar and source mode", () => {
  it("renders no keyboard bar in source mode even when the keyboard is open", () => {
    const { container } = renderToolbars("source");
    expect(screen.queryByRole("toolbar", { name: "Keyboard bar" })).toBeNull();
    expect(container.querySelector('[aria-label="Keyboard bar"]')).toBeNull();
  });
  it("renders the keyboard bar in wysiwyg mode when the keyboard is open", () => {
    renderToolbars("wysiwyg");
    expect(
      screen.queryByRole("toolbar", { name: "Keyboard bar" }),
    ).not.toBeNull();
  });
});

/** Render {@link ManuscriptEditor} in source mode; return workspace and view. */
function renderSourceEditor(defaultValue: string) {
  const workspace = new MemoryWorkspace();
  const rendered = render(
    createElement(MilkdownProvider, null, createElement(ManuscriptEditor, {
      workspace,
      defaultValue,
      mode: "source",
    })),
  );
  const cmEditor = document.querySelector(".source-editor .cm-editor") as HTMLElement;
  expect(cmEditor).not.toBeNull();
  const view = EditorView.findFromDOM(cmEditor);
  expect(view).not.toBeNull();
  return { ...rendered, workspace, view: view! };
}

describe("ManuscriptEditor — source editor autosave", () => {
  it("schedules the debounced save with the new source markdown on source edits", async () => {
    vi.mocked(saveManuscript).mockClear();
    const { workspace, view } = renderSourceEditor("# Title\n\nSome text.");
    const newMarkdown = "# Title\n\nEdited in source.";
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newMarkdown } }));

    // The save is debounced; after the window it must persist the new text.
    await waitFor(() => expect(saveManuscript).toHaveBeenCalledWith(workspace, newMarkdown), { timeout: 3000 });
  }, 20000);

  it("saves the pending markdown on flush (unmount) instead of discarding it", async () => {
    vi.mocked(saveManuscript).mockClear();
    const { unmount, workspace, view } = renderSourceEditor("# Title\n\nSome text.");
    const pendingMarkdown = "# Title\n\nEdited right before unmount.";
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: pendingMarkdown } }));

    // Unmount while the debounce is still pending: flush must save, not drop.
    unmount();
    await waitFor(() => expect(saveManuscript).toHaveBeenCalledWith(workspace, pendingMarkdown));
  }, 20000);
});

describe("ManuscriptEditor — citation dropdown mounting", () => {
  it("does not import citationPluginKey (insertion moved to plugin)", () => {
    expect(manuscriptSource).not.toContain("citationPluginKey");
  });
  it("registers citation plugin via crepe.addFeature()", () => {
    expect(manuscriptSource).toContain("crepe.addFeature");
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
  it("does not import useCitationState (citation dispatch removed)", () => {
    expect(manuscriptSource).not.toContain("useCitationState");
  });
  it("uses onStateChangeRef to wire citation plugin", () => {
    expect(manuscriptSource).toContain("onStateChangeRef");
    expect(manuscriptSource).toContain("createCitationPlugin");
    expect(manuscriptSource).toContain("onStateChangeRef.current");
  });
  it("imports editorViewCtx for test API (not citation trigger)", () => {
    expect(manuscriptSource).toContain("editorViewCtx");
    expect(manuscriptSource).toMatch(/editorViewCtx.*from.*['"]@milkdown\/kit\/core['"]/);
  });
});

describe("ManuscriptEditor — citekey insertion removed (now in plugin)", () => {
  it("does not contain createSelectCitekeyHandler function", () => {
    expect(manuscriptSource).not.toContain("createSelectCitekeyHandler");
  });
  it("does not contain citationDispatchRef", () => {
    expect(manuscriptSource).not.toContain("citationDispatchRef");
  });
  it("does not contain handleSelectCitekey", () => {
    expect(manuscriptSource).not.toContain("handleSelectCitekey");
  });
  it("does not import useCitationState", () => {
    expect(manuscriptSource).not.toContain("useCitationState");
  });
  it("does not pass onSelectCitekey to createCitationPlugin", () => {
    expect(manuscriptSource).not.toContain("onSelectCitekey");
  });
  it("does not import CitationSelectHandler type", () => {
    expect(manuscriptSource).not.toContain("CitationSelectHandler");
  });
});

describe("ManuscriptEditor — editor wiring happens exactly once", () => {
  it("wires once across re-renders so one markdown update schedules one autosave", async () => {
    vi.mocked(saveManuscript).mockClear();
    const workspace = new MemoryWorkspace();
    let api: EditorTestApi | null = null;
    const onReady = vi.fn((ready: EditorTestApi) => { api = ready; });
    const app = () => createElement(MilkdownProvider, null, createElement(ManuscriptEditor, {
      workspace, defaultValue: "# Title\n\nSome text.", onEditorReady: onReady, mode: "wysiwyg" as const,
    }));
    const result = render(app());
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    // Force several re-renders; the wire effect must not stack listeners.
    for (let i = 0; i < 3; i++) result.rerender(app());
    expect(onReady).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    try {
      act(() => { api!.setMarkdown("# Title\n\nEdited exactly once."); });
      await act(async () => {});
      act(() => { vi.advanceTimersByTime(1000); });
      await act(async () => {});
      expect(saveManuscript).toHaveBeenCalledTimes(1);
      expect(saveManuscript).toHaveBeenCalledWith(workspace, expect.stringContaining("Edited exactly once."));
    } finally {
      vi.useRealTimers();
    }
  }, 20000);
});