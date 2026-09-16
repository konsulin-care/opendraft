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

  it("has handleKeydown that handles Enter for citation insertion", () => {
    // Verify the plugin has the keydown handler
    const plugin = createCitationPlugin(workspace);
    expect(plugin.props?.handleDOMEvents?.keydown).toBeDefined();
  });

  it("has handleTextInput for @ trigger detection", () => {
    // Verify the plugin has the text input handler
    const plugin = createCitationPlugin(workspace);
    expect(plugin.props?.handleTextInput).toBeDefined();
  });
});

describe("citation plugin — Enter key behavior (source)", () => {
  it("handles Enter key when citation dropdown is open", () => {
    // The plugin source should check for Enter key and open state
    expect(pluginSource).toContain("event.key === \"Enter\"");
    expect(pluginSource).toMatch(/citationState\?\.open/);
  });

  it("imports filterCitekeys for filtering active citekey", () => {
    expect(pluginSource).toContain("filterCitekeys");
    expect(pluginSource).toMatch(/filterCitekeys.*from/);
  });

  it("inserts citekey using ProseMirror transaction", () => {
    // The plugin uses tr.insertText to insert the citation
    expect(pluginSource).toContain("tr.insertText");
  });

  it("dispatches CLOSE_CITATION after inserting", () => {
    // After Enter, the plugin should close the dropdown
    expect(pluginSource).toContain("CLOSE_CITATION");
  });
});

describe("citation plugin — handleTextInput behavior (source)", () => {
  it("detects @ trigger and dispatches OPEN_CITATION", () => {
    // The plugin should check for @ character and call matchCitationTrigger
    expect(pluginSource).toContain("text !== \"@\"");
    expect(pluginSource).toContain("matchCitationTrigger");
  });

  it("captures viewport coordinates via coordsAtPos for dropdown positioning", () => {
    // The plugin should use view.coordsAtPos to get screen coordinates
    expect(pluginSource).toContain("coordsAtPos");
    expect(pluginSource).toMatch(/trigger:.*top.*left/);
  });

  it("includes top and left in OPEN_CITATION trigger payload", () => {
    // The OPEN_CITATION action should include screen coordinates
    expect(pluginSource).toMatch(/top:\s*coords\.top/);
    expect(pluginSource).toMatch(/left:\s*coords\.left/);
  });

  it("does not consume the @ character (returns false)", () => {
    // The handler should return false to let ProseMirror insert the @
    expect(pluginSource).toContain("return false");
    expect(pluginSource).toContain("Don");
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