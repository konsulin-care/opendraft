// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginSource = readFileSync(
  fileURLToPath(new URL("./plugin.ts", import.meta.url)),
  "utf8",
);

describe("citation plugin — rebuildDecorations avoids re-entrant update", () => {
  it("does NOT call rebuildDecorations synchronously inside update()", () => {
    // Calling rebuildDecorations synchronously inside update() dispatches a
    // new transaction, causing a re-entrant update() that disrupts the
    // SlashProvider's debounced #onUpdate flow and breaks @ trigger detection.
    // The rebuild must be deferred via setTimeout or requestAnimationFrame.
    const updateBlock = pluginSource.match(/update\(editorView[\s\S]*?^\s{6}}/m);
    expect(updateBlock).not.toBeNull();
    // Must NOT contain a bare rebuildDecorations call (without setTimeout/rAF)
    const hasSyncRebuild =
      /rebuildDecorations\(/.test(updateBlock![0]) &&
      !/setTimeout|requestAnimationFrame/.test(updateBlock![0]);
    expect(hasSyncRebuild).toBe(false);
  });

  it("defers rebuildDecorations via setTimeout or requestAnimationFrame", () => {
    // When document changes, the decoration rebuild must be deferred to avoid
    // dispatching inside the same synchronous update cycle.
    expect(pluginSource).toMatch(
      /(?:setTimeout|requestAnimationFrame)\s*\(\s*(?:\(\)\s*=>|function)/,
    );
  });

  it("still rebuilds decorations when document changes", () => {
    // The rebuild must still happen, just deferred
    expect(pluginSource).toContain("rebuildDecorations");
    expect(pluginSource).toContain("editorView.state.doc !== prevState.doc");
  });
});
