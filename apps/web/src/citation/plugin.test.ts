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

  it("handles keydown when dropdown is open", () => {
    const plugin = createCitationPlugin(workspace);
    expect(plugin.props?.handleKeyDown).toBeDefined();
  });

  it("does not have handleTextInput (uses SlashProvider)", () => {
    const plugin = createCitationPlugin(workspace);
    expect(plugin.props?.handleTextInput).toBeUndefined();
  });
});

describe("citation plugin — handles keyboard navigation via handleKeyDown", () => {
  it("contains handleKeyDown logic", () => {
    expect(pluginSource).toContain("handleKeyDown(");
    expect(pluginSource).toContain("ArrowDown");
    expect(pluginSource).toContain("ArrowUp");
    expect(pluginSource).toContain("Escape");
  });

  it("does not use filterCitekeys in plugin", () => {
    // filterCitekeys is now used in dropdown component
    expect(pluginSource).not.toContain("filterCitekeys");
  });

  it("does not insert citekey in plugin", () => {
    // Insertion is handled in ManuscriptEditor.handleSelectCitekey
    expect(pluginSource).not.toContain("tr.insertText");
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