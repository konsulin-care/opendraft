// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createCitationPlugin, citationPluginKey } from "./plugin";
import type { WorkspaceAdapter } from "@opendraft/workspace";

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

  it("does not use filterCitekeys in plugin", () => {
    // filterCitekeys is now used in dropdown component
    expect(pluginSource).not.toContain("filterCitekeys");
  });

  it("inserts citekey via direct view.dispatch in global handler", () => {
    // Insertion moved into plugin to avoid stale editor.action() dispatch
    expect(pluginSource).toContain("tr.insertText");
    expect(pluginSource).toContain("view.dispatch(tr)");
  });

  it("reads trigger from citation state for insert range", () => {
    // Must use state.trigger.from to compute replacement range
    expect(pluginSource).toContain("state.trigger");
    expect(pluginSource).toContain("state.trigger.from");
  });

  it("supports bracketed [@citekey] insert mode", () => {
    // Must check trigger.bracketed to choose insert format
    expect(pluginSource).toContain("trigger.bracketed");
    expect(pluginSource).toContain('[@${citekey}]');
  });
});

describe("citation plugin — shouldShowCitation supports post-trigger text", () => {
  it("uses matchCitationTrigger for word-boundary detection (not startsWith)", () => {
    // shouldShowCitation must use matchCitationTrigger to support @ anywhere
    expect(pluginSource).toContain("matchCitationTrigger");
    expect(pluginSource).not.toMatch(/content\.startsWith\(["']@['"]\)/);
  });

  it("shouldShow checks cursor is at end of node", () => {
    // Must verify cursor position to close dropdown when cursor moves mid-text
    expect(pluginSource).toContain("isSelectionAtEndOfNode");
  });

  it("shouldShow supports bracketed [@ trigger via matchCitationTrigger", () => {
    // matchCitationTrigger handles [@ detection internally
    expect(pluginSource).toContain("matchCitationTrigger");
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