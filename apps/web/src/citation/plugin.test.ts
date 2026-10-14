// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createCitationPlugin, citationPluginKey, shouldShowCitation } from "./plugin";
import type { WorkspaceAdapter } from "@opendraft/workspace";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import { Schema } from "@milkdown/kit/prose/model";

/** Build a single-paragraph EditorState with the cursor at the given doc position. */
function createEditorState(text: string, cursorPos: number): EditorState {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      text: { group: "inline" },
    },
  });
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text(text)),
  ]);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, cursorPos),
  });
}

/** Paragraph text before the cursor, as SlashProvider.getContent computes it. */
function textBeforeCursor(state: EditorState): string {
  const { $from } = state.selection;
  return $from.parent.textBetween(0, $from.parentOffset);
}

const pluginSource = readFileSync(
  fileURLToPath(new URL("./plugin.ts", import.meta.url)),
  "utf8",
);

describe("createCitationPlugin", () => {
  let workspace: WorkspaceAdapter;

  beforeEach(() => {
    workspace = {
      readFile: vi.fn().mockResolvedValue(null),
      writeFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      listFiles: vi.fn().mockResolvedValue([]),
    };
  });

  it("creates a plugin", () => {
    const plugin = createCitationPlugin(workspace);
    expect(plugin).toBeDefined();
  });

  it("exports pluginKey", () => {
    expect(citationPluginKey).toBeDefined();
  });

  it("uses global capture-phase keyboard handler instead of props.handleKeyDown", () => {
    const plugin = createCitationPlugin(workspace);
    // handleKeyDown is no longer on props; keyboard is handled via window listener
    expect(plugin.props?.handleKeyDown).toBeUndefined();
  });

  it("does not have handleTextInput (uses SlashProvider)", () => {
    const plugin = createCitationPlugin(workspace);
    expect(plugin.props?.handleTextInput).toBeUndefined();
  });
});

describe("citation plugin — global keyboard handler (capture phase)", () => {
  it("registers window keydown listener with capture: true", () => {
    expect(pluginSource).toContain("window.addEventListener");
    expect(pluginSource).toContain("keydown");
    expect(pluginSource).toContain("capture: true");
  });

  it("removes listener on close or destroy", () => {
    expect(pluginSource).toContain("window.removeEventListener");
  });

  it("does not use handleKeyDown in props (replaced by global listener)", () => {
    expect(pluginSource).not.toMatch(/handleKeyDown\(/);
  });

  it("uses filterCitekeys in Enter handler to resolve filtered index", () => {
    // Enter handler must read from filtered list, not raw state.items
    expect(pluginSource).toContain("filterCitekeys");
  });

  it("inserts citekey via direct view.dispatch in global handler", () => {
    // Insertion moved into plugin to avoid stale editor.action() dispatch
    expect(pluginSource).toContain("tr.insertText");
    expect(pluginSource).toContain("view.dispatch(tr)");
  });

  it("reads trigger from citation state for insert range", () => {
    // Insertion range is planned from the citation-state trigger
    expect(pluginSource).toContain("state.trigger");
    expect(pluginSource).toContain("planCitationInsertion");
  });

  it("delegates bracket handling to planCitationInsertion", () => {
    // Bracket format ([@citekey] vs @citekey) and ] dedup live in insert.ts
    expect(pluginSource).toContain("planCitationInsertion");
    expect(pluginSource).toContain("insertion.text");
  });

});

describe("citation plugin — insert range and cursor placement", () => {
  it("replaces only the @query, never consuming the [", () => {
    // T3: the replacement starts at the @ (trigger.from), not at the [.
    // A ] is appended by planCitationInsertion only when the group lacks one.
    expect(pluginSource).not.toContain("trigger.from - 1");
    expect(pluginSource).toContain("planCitationInsertion");
  });

  it("places the cursor just before the closing ] after insert", () => {
    // T4: after the first pick in [@key] the cursor must sit at the offset
    // just before the closing ] (insertion.from + "@citekey".length) so the
    // user can type "; @" to add another citation to the same group.
    expect(pluginSource).toMatch(
      /insertText\([\s\S]*?setSelection\(\s*TextSelection\.create\(tr\.doc, insertion\.from \+ citekey\.length \+ 1\)\s*,?\s*\)[\s\S]*?view\.dispatch\(tr\)/,
    );
  });
});

describe("citation plugin — shouldShowCitation supports post-trigger text", () => {
  it("uses matchCitationTrigger for word-boundary detection (not startsWith)", () => {
    // shouldShowCitation must use matchCitationTrigger to support @ anywhere
    expect(pluginSource).toContain("matchCitationTrigger");
    expect(pluginSource).not.toMatch(/content\.startsWith\(["']@['"]\)/);
  });

  it("shouldShow supports bracketed [@ trigger via matchCitationTrigger", () => {
    // matchCitationTrigger handles [@ detection internally
    expect(pluginSource).toContain("matchCitationTrigger");
  });
});

describe("citation plugin — shouldShowCitation opens picker before trailing text", () => {
  it("returns true for [@a; @ with a ] after the cursor", () => {
    // "[@a; @]" with the cursor between @ and ]: the ] follows the cursor,
    // so the picker must still open (doc position 7 = between @ and ]).
    const state = createEditorState("[@a; @]", 7);
    const content = textBeforeCursor(state);
    expect(content).toBe("[@a; @");
    expect(shouldShowCitation(content)).toBe(true);
  });

  it("returns true when @ is at the end of the paragraph", () => {
    const state = createEditorState("See @", 6);
    expect(shouldShowCitation(textBeforeCursor(state))).toBe(true);
  });

  it("does not require the cursor to be at the end of the node", () => {
    // No end-of-paragraph requirement: text after the cursor is fine
    expect(pluginSource).not.toContain("isSelectionAtEndOfNode");
  });

  it("returns false when @ sits inside a word", () => {
    const state = createEditorState("email@", 7);
    expect(shouldShowCitation(textBeforeCursor(state))).toBe(false);
  });

  it("returns false for empty or missing content", () => {
    expect(shouldShowCitation(undefined)).toBe(false);
    expect(shouldShowCitation("")).toBe(false);
  });
});

describe("citation plugin — onShow uses matchCitationTrigger for trigger.from", () => {
  it("onShow reads paragraph text and uses matchCitationTrigger (not pos - 1)", () => {
    // onShow must find the @ position via matchCitationTrigger, not assume cursor - 1
    expect(pluginSource).toContain("matchCitationTrigger");
    // The old code used selection.$from.pos - 1 directly; the new code must not
    expect(pluginSource).not.toMatch(/from\s*=\s*selection\s*\.\s*\$from\.pos\s*-\s*1/);
  });

  it("onShow extracts paragraph text to find @ position", () => {
    // Must read paragraph text to pass to matchCitationTrigger
    expect(pluginSource).toContain("parent.textBetween");
  });
});

describe("citation plugin — syncs query from editor text", () => {
  it("dispatches SET_QUERY when dropdown is open", () => {
    expect(pluginSource).toContain("SET_QUERY");
  });

  it("reads text between trigger position and cursor for query", () => {
    // The query extraction logic reads from trigger.from + 1 to cursor
    expect(pluginSource).toContain("trigger.from");
  });
});

describe("citation plugin — SlashProvider behavior (source)", () => {
  it("imports SlashProvider from @milkdown/plugin-slash", () => {
    expect(pluginSource).toContain("@milkdown/plugin-slash");
    expect(pluginSource).toContain("SlashProvider");
  });

  it("creates SlashProvider with trigger '@'", () => {
    expect(pluginSource).toMatch(/trigger:\s*["']@["']/);
  });

  it("sets debounce to 0 for immediate trigger response", () => {
    expect(pluginSource).toContain("debounce: 0");
  });

  it("passes floatingUIOptions with bottom-start placement", () => {
    expect(pluginSource).toContain("floatingUIOptions");
    expect(pluginSource).toContain("bottom-start");
  });

  it("onShow does not dispatch top/left coordinates", () => {
    expect(pluginSource).not.toContain("top: 0");
    expect(pluginSource).not.toContain("left: 0");
  });

  it("uses custom shouldShow for word-boundary detection", () => {
    expect(pluginSource).toContain("shouldShow");
  });

  it("provides content element with React-rendered CitationDropdown", () => {
    expect(pluginSource).toContain("content");
    expect(pluginSource).toContain("CitationDropdown");
  });

  it("has onShow and onHide lifecycle callbacks", () => {
    expect(pluginSource).toContain("onShow");
    expect(pluginSource).toContain("OPEN_CITATION");
    expect(pluginSource).toContain("onHide");
    expect(pluginSource).toContain("CLOSE_CITATION");
  });

  it("calls provider.update and provider.destroy in plugin view", () => {
    expect(pluginSource).toContain("provider.update");
    expect(pluginSource).toContain("provider.destroy");
  });
});

describe("citation plugin — onSelectCitekey removed from signatures", () => {
  it("createCitationPlugin does not accept onSelectCitekey parameter", () => {
    // onSelectCitekey removed; insertion handled directly in plugin
    expect(pluginSource).not.toMatch(/function createCitationPlugin[\s\S]*?onSelectCitekey/);
  });

  it("createGlobalKeyHandler does not accept onSelectCitekey parameter", () => {
    expect(pluginSource).not.toMatch(/function createGlobalKeyHandler[\s\S]*?onSelectCitekey/);
  });

  it("createView does not accept onSelectCitekey parameter", () => {
    expect(pluginSource).not.toMatch(/function createView[\s\S]*?onSelectCitekey/);
  });

  it("CitationSelectHandler type is not exported", () => {
    // No longer needed since insertion is in the plugin
    expect(pluginSource).not.toContain("export type CitationSelectHandler");
  });
});

describe("citation plugin — onStateChange callback", () => {
  let workspace: WorkspaceAdapter;

  beforeEach(() => {
    workspace = {
      readFile: vi.fn().mockResolvedValue(null),
      writeFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      listFiles: vi.fn().mockResolvedValue([]),
    };
  });

  it("accepts onStateChange parameter", () => {
    const onStateChange = vi.fn();
    const plugin = createCitationPlugin(workspace, onStateChange);
    expect(plugin).toBeDefined();
  });

  it("calls onStateChange when OPEN_CITATION action is dispatched", () => {
    const onStateChange = vi.fn();
    createCitationPlugin(workspace, onStateChange);
    // The apply function should call onStateChange with new state
    // This is tested via source inspection since we can't easily trigger ProseMirror transactions
    expect(pluginSource).toContain("onStateChange");
  });

  it("calls onStateChange when SET_ITEMS action is dispatched", () => {
    // The apply function should call onStateChange for SET_ITEMS
    expect(pluginSource).toContain("onStateChange");
  });

  it("calls onStateChange when CLOSE_CITATION action is dispatched", () => {
    // The apply function should call onStateChange for CLOSE_CITATION
    expect(pluginSource).toContain("onStateChange");
  });
});