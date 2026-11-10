import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryWorkspace } from "@opendraft/workspace";
import { EditorView } from "@codemirror/view";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ManuscriptEditor } from "./components/ManuscriptEditor";
import { EditorToolbars } from "./components/EditorToolbars";
import { INACTIVE_STATE } from "./editor-commands/types";
import type { EditorCommands } from "./editor-commands/types";
import { saveFile } from "./persistence";
import type { SaveStatus } from "./components/AppHeader";

vi.mock("./persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./persistence")>();
  return { ...actual, saveFile: vi.fn().mockResolvedValue(undefined) };
});

/** Manuscript block path: opens in the source-only editor. */
const DOC_PATH = "manuscripts/p/blocks/01hxyz000000000000000000000000.qmd";
/** Manuscript assembly path: opens in the source-only editor. */
const ARTICLE_PATH = "manuscripts/p/article.qmd";
/** Every workspace file type under test: assembly, block, config, loose files. */
const SOURCE_ONLY_PATHS = [ARTICLE_PATH, DOC_PATH, "opendraft.yml", "article.qmd", "manuscript.md", "notes.qmd", "refs.bib"];
/** Source text of the modules under test, for source-scan assertions. */
const manuscriptSource = readFileSync(resolve(__dirname, "./components/ManuscriptEditor.tsx"), "utf8");
const crepeConfigSource = readFileSync(resolve(__dirname, "./components/crepe-config.ts"), "utf8");
const caretSwitchSource = readFileSync(resolve(__dirname, "./caret-mode-switch.ts"), "utf8");
const css = readFileSync(resolve(__dirname, "./index.css"), "utf8");
/** Wait in real time; outlives the 800ms autosave debounce. */
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
/** Render {@link ManuscriptEditor} over a fresh MemoryWorkspace. */
function renderEditor(options: {
  path: string; defaultValue?: string; onSaveStatusChange?: (status: SaveStatus) => void;
}) {
  const workspace = new MemoryWorkspace();
  const rendered = render(createElement(ManuscriptEditor, {
    workspace, defaultValue: options.defaultValue ?? "# Title\n\nSome text.", path: options.path,
    onSaveStatusChange: options.onSaveStatusChange,
  }));
  return { ...rendered, workspace };
}
/** Wait for the source editor's CodeMirror view and return it. */
async function sourceView(): Promise<EditorView> {
  let view: EditorView | null = null;
  await waitFor(() => {
    const content = document.querySelector(".source-editor .cm-content") as HTMLElement | null;
    view = content ? EditorView.findFromDOM(content) : null;
    expect(view).not.toBeNull();
  }, { timeout: 10000 });
  return view!;
}
/** Render the source-only editor and return its workspace and CodeMirror view. */
async function renderSourceEditor(defaultValue: string) {
  const base = renderEditor({ path: DOC_PATH, defaultValue });
  return { ...base, view: await sourceView() };
}
/** Dispatch Cmd/Ctrl+S (or another chord) on window; returns whether the browser default was blocked. */
function pressSave(init: KeyboardEventInit): boolean {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "KeyS", key: "s", ...init });
  act(() => { window.dispatchEvent(event); });
  return event.defaultPrevented;
}
const CMD_S = { metaKey: true } as const;

describe("ManuscriptEditor — source-only editor for every file", () => {
  it.each(SOURCE_ONLY_PATHS)(
    "renders %s in the source-only editor without a metadata panel",
    async (path) => {
      renderEditor({ path });
      await waitFor(() => expect(document.querySelector(".source-editor .cm-editor")).not.toBeNull(), { timeout: 10000 });
      expect(screen.getByTestId("manuscript-editor")).not.toBeNull();
      expect(screen.queryByTestId("metadata-panel")).toBeNull();
      expect(document.querySelector("[data-milkdown-root]")).toBeNull();
      expect(document.querySelector(".ProseMirror")).toBeNull();
      // The article assembly view never renders — not even for article.qmd.
      expect(screen.queryByTestId("article-assembly")).toBeNull();
      expect(screen.queryByText("Edit assembly source")).toBeNull();
    },
    20000,
  );
});

describe("ManuscriptEditor crepe theme integration", () => {
  it("does not import Crepe theme CSS in the component", () => { expect(manuscriptSource).not.toMatch(/@milkdown\/crepe\/theme\/(common\/style\.css|classic\.css)/); });
  it("does not import the split prosemirror/reset sheets", () => { expect(manuscriptSource).not.toMatch(/@milkdown\/crepe\/theme\/common\/(prosemirror|reset)\.css/); });
  it("imports Crepe theme CSS in index.css without a cascade layer", () => { expect(css).not.toMatch(/@layer\s+crepe/); expect(css).toContain("@milkdown/crepe/theme/common/style.css"); expect(css).toContain("@milkdown/crepe/theme/classic.css"); });
  it("configures a static placeholder feature", () => { expect(crepeConfigSource).toContain("Crepe.Feature.Placeholder"); expect(crepeConfigSource).toContain("PLACEHOLDER_HINT"); expect(crepeConfigSource).not.toContain("pickPlaceholderHint"); });
  it("configures block handle at content edge", () => { expect(crepeConfigSource).toContain("Crepe.Feature.BlockEdit"); expect(crepeConfigSource).toContain("blockHandle"); expect(crepeConfigSource).toContain("shouldShow: () => false"); });
});

describe("ManuscriptEditor — block gutter removed", () => {
  it("does not reference the block-gutter plugin in the editor sources", () => { expect(manuscriptSource + crepeConfigSource).not.toContain("block-handle-gutter"); expect(manuscriptSource + crepeConfigSource).not.toContain("createBlockGutterPlugin"); });
  it("renders no .block-gutter-container or .block-gutter-handle elements", async () => {
    renderEditor({ path: DOC_PATH });
    await waitFor(() => expect(document.querySelector(".source-editor .cm-editor")).not.toBeNull(), { timeout: 10000 });
    expect(document.querySelector(".block-gutter-container, .block-gutter-handle")).toBeNull();
  }, 20000);
});

describe("ManuscriptEditor — light code block theme", () => {
  it("imports EditorView from @codemirror/view", () => { expect(crepeConfigSource).toMatch(/EditorView.*from\s+['"]@codemirror\/view['"]|@codemirror\/view.*EditorView/); });
  it("defines a lightCodeBlockTheme via EditorView.theme()", () => { expect(crepeConfigSource).toMatch(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(/); });
  it("uses a translucent active-line token for active line and gutter", () => {
    expect(crepeConfigSource).toContain("'.cm-activeLine': { backgroundColor: 'var(--color-active-line)' }");
    expect(crepeConfigSource).toContain("'.cm-activeLineGutter': { backgroundColor: 'var(--color-active-line)' }");
    const token = css.match(/--color-active-line:\s*([^;]+);/)?.[1]?.trim() ?? "";
    expect(token, "--color-active-line must be translucent").toMatch(/^rgba\(/);
    expect(Number.parseFloat(token.match(/,\s*([0-9.]+)\s*\)$/)?.[1] ?? "1")).toBeLessThan(1);
  });
  it("sets selection backgrounds via a token distinct from the active-line token", () => {
    const block = crepeConfigSource.match(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
    expect(block).toContain("'.cm-selectionBackground'");
    expect(block).toContain("'.cm-focused .cm-selectionBackground'");
    const active = block.match(/\.cm-activeLine':\s*\{ backgroundColor: '([^']+)' \}/)?.[1];
    const selection = block.match(/\.cm-selectionBackground':\s*\{ backgroundColor: '([^']+)' \}/)?.[1];
    expect(active).toBe("var(--color-active-line)");
    expect(selection).toBeDefined();
    expect(selection).not.toBe(active);
  });
  it("uses only var(--color-*) tokens in the code block theme, no hex literals", () => { const themeBlock = crepeConfigSource.match(/lightCodeBlockTheme\s*=\s*EditorView\.theme\(\{([\s\S]*?)\}\)/)?.[1]; expect(themeBlock).toBeDefined(); expect(themeBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); expect(themeBlock).toMatch(/var\(--color-[\w-]+\)/); });
  it("wires the theme into the CodeMirror feature config", () => { expect(crepeConfigSource).toContain("Crepe.Feature.CodeMirror"); expect(crepeConfigSource).toContain("theme: lightCodeBlockTheme"); });
});

describe("ManuscriptEditor — formatting toolbar preference", () => {
  it("shows the toolbar when the preference is on and hides it when off", async () => {
    const props = { workspace: new MemoryWorkspace(), defaultValue: "# Title\n\nSome text.", path: DOC_PATH };
    const on = render(createElement(ManuscriptEditor, { ...props, formattingToolbar: true }));
    expect(screen.queryByRole("toolbar", { name: "Formatting" })).not.toBeNull();
    on.unmount();
    const off = render(createElement(ManuscriptEditor, { ...props, formattingToolbar: false }));
    await waitFor(() => expect(document.querySelector(".editor-toolbar-collapse")).not.toBeNull());
    expect(document.querySelector(".editor-toolbar-collapse")!.className).toContain("is-closed");
    expect(screen.queryByRole("toolbar", { name: "Formatting" })).toBeNull();
    off.unmount();
  }, 20000);
});

describe("EditorToolbars — mobile keyboard bar and surface mode", () => {
  it("renders no keyboard bar in source mode even when the keyboard is open", () => { const { container } = renderToolbars("source"); expect(screen.queryByRole("toolbar", { name: "Keyboard bar" })).toBeNull(); expect(container.querySelector('[aria-label="Keyboard bar"]')).toBeNull(); });
  it("renders the keyboard bar in wysiwyg mode when the keyboard is open", () => { renderToolbars("wysiwyg"); expect(screen.queryByRole("toolbar", { name: "Keyboard bar" })).not.toBeNull(); });
});

describe("ManuscriptEditor — source editor autosave", () => {
  it("schedules the debounced save with the new source markdown on source edits", async () => { vi.mocked(saveFile).mockClear(); const { workspace, view } = await renderSourceEditor("# Title\n\nSome text."); const newMarkdown = "# Title\n\nEdited in source."; act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newMarkdown } })); await waitFor(() => expect(saveFile).toHaveBeenCalledWith(workspace, DOC_PATH, newMarkdown), { timeout: 3000 }); }, 20000);
  it("saves the pending markdown on flush (unmount) instead of discarding it", async () => { vi.mocked(saveFile).mockClear(); const { unmount, workspace, view } = await renderSourceEditor("# Title\n\nSome text."); const pendingMarkdown = "# Title\n\nEdited right before unmount."; act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: pendingMarkdown } })); unmount(); await waitFor(() => expect(saveFile).toHaveBeenCalledWith(workspace, DOC_PATH, pendingMarkdown)); }, 20000);
});

describe("ManuscriptEditor — no autosave on load", () => {
  it("does not write for an unedited block file after mount", async () => { vi.mocked(saveFile).mockClear(); renderEditor({ path: DOC_PATH }); await sourceView(); await sleep(1500); expect(saveFile).not.toHaveBeenCalled(); }, 20000);
  it("does not write for an unedited non-block file after mount", async () => { vi.mocked(saveFile).mockClear(); renderEditor({ path: "opendraft.yml", defaultValue: "title: draft" }); await sourceView(); await sleep(1500); expect(saveFile).not.toHaveBeenCalled(); }, 20000);
});

describe("ManuscriptEditor — source edit saved verbatim", () => {
  it("persists a user edit with '-' bullets, not '*'", async () => {
    vi.mocked(saveFile).mockClear();
    const { workspace, view } = await renderSourceEditor("# Title\n\n* item one\n* item two\n");
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "# Title\n\n- item one\n- item two\n" } }));
    await waitFor(() => expect(saveFile).toHaveBeenCalled(), { timeout: 5000 });
    const markdown = vi.mocked(saveFile).mock.calls.at(-1)![2];
    expect(markdown).toContain("- item one");
    expect(markdown).toContain("- item two");
    expect(markdown).not.toMatch(/^\* /m);
    expect(workspace).toBeDefined();
  }, 20000);
});

describe("ManuscriptEditor — citation dropdown mounting", () => {
  it("does not import citationPluginKey (insertion moved to plugin)", () => { expect(manuscriptSource + crepeConfigSource).not.toContain("citationPluginKey"); });
  it("registers citation plugin via crepe.addFeature()", () => { expect(crepeConfigSource).toContain("crepe.addFeature"); expect(crepeConfigSource).toContain("createCitationPlugin"); expect(crepeConfigSource).toMatch(/\$prose.*createCitationPlugin/); });
  it("renders no CitationDropdown in the source-only editor (rendered by plugin)", () => { expect(manuscriptSource).not.toMatch(/<CitationDropdown|citationState|onCitationDispatch|onSelectCitekey/); });
});

describe("ManuscriptEditor — @ trigger integration", () => {
  it("does not import useCitationState (citation dispatch removed)", () => { expect(manuscriptSource).not.toContain("useCitationState"); });
  it("uses onStateChangeRef to wire citation plugin", () => { expect(crepeConfigSource).toContain("onStateChangeRef"); expect(crepeConfigSource).toContain("createCitationPlugin"); expect(crepeConfigSource).toContain("onStateChangeRef.current"); });
  it("test API module imports editorViewCtx (not a citation trigger in the component)", () => { expect(caretSwitchSource).toContain("editorViewCtx"); expect(caretSwitchSource).toMatch(/editorViewCtx.*from.*['"]@milkdown\/kit\/core['"]/); expect(manuscriptSource).not.toContain("editorViewCtx"); });
});

describe("ManuscriptEditor — citekey insertion removed (now in plugin)", () => {
  it.each(["createSelectCitekeyHandler", "citationDispatchRef", "handleSelectCitekey", "useCitationState", "onSelectCitekey", "CitationSelectHandler"])("does not contain %s", (token) => { expect(manuscriptSource + crepeConfigSource).not.toContain(token); });
});

describe("ManuscriptEditor — editor wiring happens exactly once", () => {
  it("schedules one autosave per edit across re-renders", async () => {
    vi.mocked(saveFile).mockClear();
    const workspace = new MemoryWorkspace();
    const app = () => createElement(ManuscriptEditor, {
      workspace, defaultValue: "# Title\n\nSome text.", path: DOC_PATH,
    });
    const result = render(app());
    await sourceView();
    // Force several re-renders; the wire effect must not stack listeners.
    for (let i = 0; i < 3; i++) result.rerender(app());
    const view = await sourceView();
    vi.useFakeTimers();
    try {
      act(() => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "# Title\n\nEdited exactly once." } }); });
      await act(async () => {});
      act(() => { vi.advanceTimersByTime(1000); });
      await act(async () => {});
      expect(saveFile).toHaveBeenCalledTimes(1);
      expect(saveFile).toHaveBeenCalledWith(workspace, DOC_PATH, expect.stringContaining("Edited exactly once."));
    } finally {
      vi.useRealTimers();
    }
  }, 20000);
});

describe("ManuscriptEditor — Cmd/Ctrl+S flushes pending saves", () => {
  it("writes a pending source edit to the workspace before the 800ms debounce", async () => {
    vi.mocked(saveFile).mockClear();
    const statuses: SaveStatus[] = [];
    const { workspace } = renderEditor({ path: DOC_PATH, onSaveStatusChange: (s: SaveStatus) => { statuses.push(s); } });
    const view = await sourceView();
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "# Title\n\nSaved via shortcut." } }));
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
    const view = await sourceView();
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "title: edited" } }));
    pressSave({ ctrlKey: true });
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(workspace, "opendraft.yml", "title: edited"), { timeout: 400 });
  }, 20000);
});

describe("ManuscriptEditor — Cmd/Ctrl+S blocks without writing", () => {
  it("performs no workspace write when no edit is pending (silent block)", async () => {
    vi.mocked(saveFile).mockClear();
    renderEditor({ path: DOC_PATH });
    await sourceView();
    expect(pressSave(CMD_S)).toBe(true);
    await sleep(1000); expect(saveFile).not.toHaveBeenCalled();
  }, 20000);
  it("does not prevent other editor shortcuts such as Cmd+B", async () => {
    renderEditor({ path: DOC_PATH });
    await sourceView();
    expect(pressSave({ metaKey: true, code: "KeyB", key: "b" })).toBe(false);
  }, 20000);
});
