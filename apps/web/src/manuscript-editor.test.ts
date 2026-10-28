import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryWorkspace } from "@opendraft/workspace";
import { MilkdownProvider } from "@milkdown/react";
import { EditorView } from "@codemirror/view";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ManuscriptEditor, type EditorTestApi } from "./components/ManuscriptEditor";
import { EditorToolbars } from "./components/EditorToolbars";
import { INACTIVE_STATE } from "./editor-commands/types";
import type { EditorCommands } from "./editor-commands/types";
import { readPreferences, writePreferences } from "./preferences";
import { saveFile } from "./persistence";
import type { SaveStatus } from "./components/AppHeader";
vi.mock("./persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./persistence")>();
  return { ...actual, saveFile: vi.fn().mockResolvedValue(undefined) };
});
const DOC_PATH = "manuscripts/p/blocks/01hxyz00000000000000000000.qmd";
const NON_BLOCK_PATHS = ["opendraft.yml", "article.qmd", "manuscript.md", "notes.qmd", "refs.bib"];
/** Source text of the modules under test, for source-scan assertions. */
const manuscriptSource = readFileSync(resolve(__dirname, "./components/ManuscriptEditor.tsx"), "utf8");
const crepeConfigSource = readFileSync(resolve(__dirname, "./components/crepe-config.ts"), "utf8");
const editorSurfaceSource = readFileSync(resolve(__dirname, "./components/EditorSurface.tsx"), "utf8");
const caretSwitchSource = readFileSync(resolve(__dirname, "./caret-mode-switch.ts"), "utf8");
const css = readFileSync(resolve(__dirname, "./index.css"), "utf8");
/** Wait in real time; outlives the listener (200ms) and save (800ms) debounces. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** No-op {@link EditorCommands} set for toolbar rendering tests. */
const noop = () => {};
const stubCommands: EditorCommands = {
  canFormat: false, undo: noop, redo: noop, toggleBold: noop, toggleItalic: noop, toggleStrike: noop,
  toggleInlineCode: noop, toggleLink: noop, insertCitation: noop, inlineMath: noop, setHeading: noop,
  bulletList: noop, orderedList: noop, taskList: noop, blockquote: noop, codeBlock: noop, table: noop,
  hr: noop, image: noop, activeState: () => INACTIVE_STATE,
};
/** Render {@link EditorToolbars} with stub commands and an open keyboard. */
function renderToolbars(mode: "wysiwyg" | "source") {
  return render(createElement(EditorToolbars, { commands: stubCommands, formattingToolbar: true, mode, open: true, bottomOffset: 0 }));
}
/** Render {@link ManuscriptEditor} in a MilkdownProvider over a fresh MemoryWorkspace. */
function renderEditor(options: {
  path: string; defaultValue?: string; mode?: "wysiwyg" | "source";
  onEditorReady?: (api: EditorTestApi) => void; onSaveStatusChange?: (status: SaveStatus) => void;
}) {
  const workspace = new MemoryWorkspace();
  let api: EditorTestApi | null = null;
  const rendered = render(createElement(MilkdownProvider, null, createElement(ManuscriptEditor, {
    workspace, defaultValue: options.defaultValue ?? "# Title\n\nSome text.", path: options.path,
    onEditorReady: (r: EditorTestApi) => { api = r; options.onEditorReady?.(r); },
    mode: options.mode ?? "wysiwyg", onSaveStatusChange: options.onSaveStatusChange,
  })));
  return { ...rendered, workspace, getApi: () => api };
}
describe("ManuscriptEditor crepe theme integration", () => {
  it("does not import Crepe theme CSS in the component", () => {
    expect(manuscriptSource).not.toMatch(/@milkdown\/crepe\/theme\/(common\/style\.css|classic\.css)/);
  });
  it("does not import the split prosemirror/reset sheets", () => {
    expect(manuscriptSource).not.toMatch(/@milkdown\/crepe\/theme\/common\/(prosemirror|reset)\.css/);
  });
  it("imports Crepe theme CSS in index.css without a cascade layer", () => {
    expect(css).not.toMatch(/@layer\s+crepe/); expect(css).toContain("@milkdown/crepe/theme/common/style.css"); expect(css).toContain("@milkdown/crepe/theme/classic.css");
  });
  it("configures a static placeholder feature", () => {
    expect(crepeConfigSource).toContain("Crepe.Feature.Placeholder"); expect(crepeConfigSource).toContain("PLACEHOLDER_HINT"); expect(crepeConfigSource).not.toContain("pickPlaceholderHint");
  });
  it("configures block handle at content edge", () => {
    expect(crepeConfigSource).toContain("Crepe.Feature.BlockEdit"); expect(crepeConfigSource).toContain("blockHandle"); expect(crepeConfigSource).toContain("shouldShow: () => false");
  });
});
describe("ManuscriptEditor — block-only visual editor mount", () => {
  it("mounts the Crepe editor for a manuscript block file", async () => {
    const { getApi } = renderEditor({ path: DOC_PATH });
    await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
    expect(document.querySelector("[data-milkdown-root]")).not.toBeNull(); expect(document.querySelector(".ProseMirror")).not.toBeNull();
  }, 20000);
  it.each(NON_BLOCK_PATHS)("opens %s in source mode with no Milkdown root", async (path) => {
    const { getApi } = renderEditor({ path });
    await waitFor(() => expect(document.querySelector(".source-editor .cm-editor")).not.toBeNull(), { timeout: 10000 });
    // Give any lazily created Crepe instance time to mount, then assert none exists.
    await sleep(300);
    expect(document.querySelector("[data-milkdown-root]")).toBeNull(); expect(document.querySelector(".ProseMirror")).toBeNull(); expect(getApi()).toBeNull();
  }, 20000);
});
describe("ManuscriptEditor — block gutter removed", () => {
  it("does not reference the block-gutter plugin in the editor sources", () => {
    expect(manuscriptSource + crepeConfigSource).not.toContain("block-handle-gutter"); expect(manuscriptSource + crepeConfigSource).not.toContain("createBlockGutterPlugin");
  });
  it("renders no .block-gutter-container or .block-gutter-handle elements", async () => {
    const { getApi } = renderEditor({ path: DOC_PATH });
    await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
    expect(document.querySelector(".block-gutter-container, .block-gutter-handle")).toBeNull();
  }, 20000);
});
describe("ManuscriptEditor — light code block theme", () => {
  it("imports EditorView from @codemirror/view", () => {
    expect(crepeConfigSource).toMatch(/EditorView.*from\s+['"]@codemirror\/view['"]|@codemirror\/view.*EditorView/);
  });
  it("defines a lightCodeBlockTheme via EditorView.theme()", () => {
    expect(crepeConfigSource).toMatch(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(/);
  });
  it("sets active line and gutter backgrounds via the yellow token", () => {
    expect(crepeConfigSource).toContain("'.cm-activeLine'"); expect(crepeConfigSource).toContain("'.cm-activeLineGutter'"); expect(crepeConfigSource).toContain("backgroundColor: 'var(--color-yellow-200)'");
  });
  it("sets selection backgrounds via the yellow token", () => {
    expect(crepeConfigSource).toMatch(/\.cm-selectionBackground'.*\.cm-focused \.cm-selectionBackground/s); expect(crepeConfigSource).toContain("var(--color-yellow-200)");
  });
  it("uses only var(--color-*) tokens in the code block theme, no hex literals", () => {
    const themeBlock = crepeConfigSource.match(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(\{([\s\S]*?)\}\)/)?.[1];
    expect(themeBlock).toBeDefined(); expect(themeBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); expect(themeBlock).toMatch(/var\(--color-[\w-]+\)/);
  });
  it("wires the theme into the CodeMirror feature config", () => {
    expect(crepeConfigSource).toContain("Crepe.Feature.CodeMirror"); expect(crepeConfigSource).toContain("theme: lightCodeBlockTheme");
  });
});
describe("ManuscriptEditor — effective formatting toolbar visibility", () => {
  it("hides the toolbar in source mode without changing the stored preference, and shows it again in wysiwyg", async () => {
    writePreferences({ formattingToolbar: true, editorMode: "source" });
    const props = { workspace: new MemoryWorkspace(), defaultValue: "# Title\n\nSome text.", path: DOC_PATH, formattingToolbar: readPreferences().formattingToolbar };
    const result = render(createElement(MilkdownProvider, null, createElement(ManuscriptEditor, { ...props, mode: "source" })));
    // Source mode: the effective toolbar is hidden even though the stored preference is true.
    await waitFor(() => expect(document.querySelector(".editor-toolbar-collapse")).not.toBeNull());
    expect(document.querySelector(".editor-toolbar-collapse")!.className).toContain("is-closed"); expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull(); expect(readPreferences().formattingToolbar).toBe(true);
    // Switching back to wysiwyg shows the toolbar again; the mode switch must not rewrite the preference.
    result.rerender(createElement(MilkdownProvider, null, createElement(ManuscriptEditor, { ...props, mode: "wysiwyg" })));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatting" })).not.toBeNull());
    expect(document.querySelector(".editor-toolbar-collapse")!.className).toContain("is-open"); expect(readPreferences().formattingToolbar).toBe(true);
  }, 20000);
});
describe("EditorToolbars — mobile keyboard bar and source mode", () => {
  it("renders no keyboard bar in source mode even when the keyboard is open", () => {
    const { container } = renderToolbars("source");
    expect(screen.queryByRole("toolbar", { name: "Keyboard bar" })).toBeNull(); expect(container.querySelector('[aria-label="Keyboard bar"]')).toBeNull();
  });
  it("renders the keyboard bar in wysiwyg mode when the keyboard is open", () => {
    renderToolbars("wysiwyg"); expect(screen.queryByRole("toolbar", { name: "Keyboard bar" })).not.toBeNull();
  });
});
/** Render {@link ManuscriptEditor} in source mode; return workspace and view. */
function renderSourceEditor(defaultValue: string) {
  const base = renderEditor({ path: DOC_PATH, defaultValue, mode: "source" });
  const cmEditor = document.querySelector(".source-editor .cm-editor") as HTMLElement; expect(cmEditor).not.toBeNull();
  const view = EditorView.findFromDOM(cmEditor); expect(view).not.toBeNull();
  return { ...base, view: view! };
}
describe("ManuscriptEditor — source editor autosave", () => {
  it("schedules the debounced save with the new source markdown on source edits", async () => {
    vi.mocked(saveFile).mockClear();
    const { workspace, view } = renderSourceEditor("# Title\n\nSome text.");
    const newMarkdown = "# Title\n\nEdited in source.";
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newMarkdown } }));
    // The save is debounced; after the window it must persist the new text.
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(workspace, DOC_PATH, newMarkdown), { timeout: 3000 });
  }, 20000);
  it("saves the pending markdown on flush (unmount) instead of discarding it", async () => {
    vi.mocked(saveFile).mockClear();
    const { unmount, workspace, view } = renderSourceEditor("# Title\n\nSome text.");
    const pendingMarkdown = "# Title\n\nEdited right before unmount.";
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: pendingMarkdown } }));
    unmount(); // Unmount while the debounce is still pending: flush must save, not drop.
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(workspace, DOC_PATH, pendingMarkdown));
  }, 20000);
});
describe("ManuscriptEditor — no autosave on load", () => {
  it("does not write for an unedited block file after mount", async () => {
    vi.mocked(saveFile).mockClear();
    const { getApi } = renderEditor({ path: DOC_PATH });
    await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
    // Wait past the listener debounce (200ms) and the autosave debounce (800ms).
    await sleep(1500); expect(saveFile).not.toHaveBeenCalled();
  }, 20000);
  it("does not write for an unedited non-block file after mount", async () => {
    vi.mocked(saveFile).mockClear();
    renderEditor({ path: "opendraft.yml", defaultValue: "title: draft" });
    await waitFor(() => expect(document.querySelector(".source-editor .cm-editor")).not.toBeNull(), { timeout: 10000 });
    await sleep(1500); expect(saveFile).not.toHaveBeenCalled();
  }, 20000);
});
describe("ManuscriptEditor — list bullet preservation", () => {
  it("serializes a user edit with '-' bullets, not '*'", async () => {
    vi.mocked(saveFile).mockClear();
    const initial = "# Title\n\n- item one\n- item two\n";
    const { getApi } = renderEditor({ path: DOC_PATH, defaultValue: initial });
    await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
    // A user-originated change: replace the document with the same list.
    act(() => { getApi()!.setMarkdown("# Title\n\n- item one\n- item two\n"); });
    await waitFor(() => expect(saveFile).toHaveBeenCalled(), { timeout: 5000 });
    const markdown = vi.mocked(saveFile).mock.calls.at(-1)![2];
    expect(markdown).toContain("- item one"); expect(markdown).toContain("- item two"); expect(markdown).not.toMatch(/^\* /m);
  }, 20000);
});
describe("ManuscriptEditor — citation dropdown mounting", () => {
  it("does not import citationPluginKey (insertion moved to plugin)", () => {
    expect(manuscriptSource + crepeConfigSource).not.toContain("citationPluginKey");
  });
  it("registers citation plugin via crepe.addFeature()", () => {
    expect(crepeConfigSource).toContain("crepe.addFeature"); expect(crepeConfigSource).toContain("createCitationPlugin"); expect(crepeConfigSource).toMatch(/\$prose.*createCitationPlugin/);
  });
  it("no longer renders CitationDropdown in EditorSurface (rendered by plugin)", () => {
    expect(editorSurfaceSource).not.toMatch(/<CitationDropdown|citationState|onCitationDispatch|onSelectCitekey/);
  });
});
describe("ManuscriptEditor — @ trigger integration", () => {
  it("does not import useCitationState (citation dispatch removed)", () => {
    expect(manuscriptSource).not.toContain("useCitationState");
  });
  it("uses onStateChangeRef to wire citation plugin", () => {
    expect(crepeConfigSource).toContain("onStateChangeRef"); expect(crepeConfigSource).toContain("createCitationPlugin"); expect(crepeConfigSource).toContain("onStateChangeRef.current");
  });
  it("test API module imports editorViewCtx (not a citation trigger in the component)", () => {
    // createTestApi moved to caret-mode-switch.ts; editorViewCtx lives there for caret placement, and the component itself no longer touches it.
    expect(caretSwitchSource).toContain("editorViewCtx"); expect(caretSwitchSource).toMatch(/editorViewCtx.*from.*['"]@milkdown\/kit\/core['"]/); expect(manuscriptSource + crepeConfigSource).not.toContain("editorViewCtx");
  });
});
describe("ManuscriptEditor — citekey insertion removed (now in plugin)", () => {
  it.each([
    "createSelectCitekeyHandler", "citationDispatchRef", "handleSelectCitekey",
    "useCitationState", "onSelectCitekey", "CitationSelectHandler",
  ])("does not contain %s", (token) => {
    expect(manuscriptSource + crepeConfigSource).not.toContain(token);
  });
});
describe("ManuscriptEditor — editor wiring happens exactly once", () => {
  it("wires once across re-renders so one markdown update schedules one autosave", async () => {
    vi.mocked(saveFile).mockClear();
    const workspace = new MemoryWorkspace();
    const onReady = vi.fn(); let api: EditorTestApi | null = null;
    onReady.mockImplementation((ready: EditorTestApi) => { api = ready; });
    const app = () => createElement(MilkdownProvider, null, createElement(ManuscriptEditor, {
      workspace, defaultValue: "# Title\n\nSome text.", path: DOC_PATH, onEditorReady: onReady, mode: "wysiwyg" as const,
    }));
    const result = render(app());
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    // Force several re-renders; the wire effect must not stack listeners.
    for (let i = 0; i < 3; i++) result.rerender(app());
    expect(onReady).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    try {
      act(() => { (api as unknown as EditorTestApi).setMarkdown("# Title\n\nEdited exactly once."); });
      await act(async () => {});
      act(() => { vi.advanceTimersByTime(1000); });
      await act(async () => {});
      expect(saveFile).toHaveBeenCalledTimes(1); expect(saveFile).toHaveBeenCalledWith(workspace, DOC_PATH, expect.stringContaining("Edited exactly once."));
    } finally {
      vi.useRealTimers();
    }
  }, 20000);
});
/** Dispatch Cmd/Ctrl+S (or another chord) on window; returns whether the browser default was blocked. */
function pressSave(init: KeyboardEventInit): boolean {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "KeyS", key: "s", ...init });
  act(() => { window.dispatchEvent(event); });
  return event.defaultPrevented;
}
const CMD_S = { metaKey: true } as const;
describe("ManuscriptEditor — Cmd/Ctrl+S flushes pending saves", () => {
  it("writes a pending rich-editor edit to the workspace before the 800ms debounce", async () => {
    vi.mocked(saveFile).mockClear();
    const statuses: SaveStatus[] = [];
    const { workspace, getApi } = renderEditor({ path: DOC_PATH, onSaveStatusChange: (s: SaveStatus) => { statuses.push(s); } });
    await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
    act(() => { getApi()!.setMarkdown("# Title\n\nSaved via shortcut."); });
    // schedule() reports 'saving' once the pending edit is registered; wait for it.
    await waitFor(() => expect(statuses).toContain("saving"), { timeout: 3000 });
    expect(saveFile).not.toHaveBeenCalled();
    expect(pressSave(CMD_S)).toBe(true);
    // The flush must land well before the 800ms debounce would have fired.
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(workspace, DOC_PATH, expect.stringContaining("Saved via shortcut.")), { timeout: 400 });
  }, 20000);
  it("writes a pending source-only edit to the workspace before the 800ms debounce", async () => {
    vi.mocked(saveFile).mockClear();
    const { workspace } = renderEditor({ path: "opendraft.yml", defaultValue: "title: draft" });
    await waitFor(() => expect(document.querySelector(".source-editor .cm-editor")).not.toBeNull(), { timeout: 10000 });
    const view = EditorView.findFromDOM(document.querySelector(".source-editor .cm-editor") as HTMLElement)!;
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "title: edited" } }));
    pressSave({ ctrlKey: true });
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(workspace, "opendraft.yml", "title: edited"), { timeout: 400 });
  }, 20000);
});
describe("ManuscriptEditor — Cmd/Ctrl+S blocks without writing", () => {
  it("performs no workspace write when no edit is pending (silent block)", async () => {
    vi.mocked(saveFile).mockClear();
    const { getApi } = renderEditor({ path: DOC_PATH });
    await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
    expect(pressSave(CMD_S)).toBe(true);
    await sleep(1000); expect(saveFile).not.toHaveBeenCalled();
  }, 20000);
  it("does not prevent other editor shortcuts such as Cmd+B", async () => {
    const { getApi } = renderEditor({ path: DOC_PATH });
    await waitFor(() => expect(getApi()).not.toBeNull(), { timeout: 10000 });
    expect(pressSave({ metaKey: true, code: "KeyB", key: "b" })).toBe(false);
  }, 20000);
});
