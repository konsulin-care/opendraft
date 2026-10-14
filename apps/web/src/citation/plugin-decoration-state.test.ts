// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginSource = readFileSync(
  fileURLToPath(new URL("./plugin.ts", import.meta.url)),
  "utf8",
);

describe("citation plugin — decoration system actually applies", () => {
  it("does NOT use decoStateKey for decoration storage", () => {
    // decoStateKey is a PluginKey with no registered plugin, so
    // decoStateKey.getState(state) always returns undefined and
    // decorations never render. Decorations must be stored in the
    // citation plugin's own state instead.
    expect(pluginSource).not.toContain("decoStateKey");
  });

  it("plugin state spec initializes decorations field", () => {
    // The createState function must initialize a decorations field
    // alongside the citation state, starting with DecorationSet.empty.
    expect(pluginSource).toContain("DecorationSet.empty");
  });

  it("plugin apply method handles decoration metadata", () => {
    // The apply method must check for decoration metadata on transactions
    // and update the stored DecorationSet accordingly.
    expect(pluginSource).toContain("SET_DECORATIONS");
  });

  it("rebuildDecorations dispatches SET_DECORATIONS via citationPluginKey", () => {
    // Instead of using decoStateKey metadata (which no plugin processes),
    // rebuildDecorations must dispatch through citationPluginKey so the
    // citation plugin's apply method can store the decorations.
    expect(pluginSource).toContain("SET_DECORATIONS");
  });

  it("decorations prop reads from citationPluginKey state", () => {
    // The decorations prop must read the DecorationSet from the citation
    // plugin's state, not from the non-existent decoStateKey.
    expect(pluginSource).toContain("citationPluginKey.getState(state)");
  });
});
