// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pluginSource = readFileSync(
  fileURLToPath(new URL("./plugin.ts", import.meta.url)),
  "utf8",
);

describe("citation plugin — click handler via DOM delegation (not handleDOMEvents)", () => {
  it("does NOT use handleDOMEvents in plugin props", () => {
    // The handleDOMEvents.click handler interferes with ProseMirror's internal
    // event routing and breaks the SlashProvider @ trigger detection.
    // Click handling must be done via direct DOM event listeners instead.
    expect(pluginSource).not.toMatch(/handleDOMEvents\s*:/);
  });

  it("registers click handler via dom.addEventListener", () => {
    // Click on citekey links must be handled by direct DOM event delegation
    // on the editor container, not through ProseMirror's handleDOMEvents.
    expect(pluginSource).toContain('dom.addEventListener("click"');
  });

  it("removes click listener on destroy", () => {
    // Cleanup must remove the click listener to prevent memory leaks.
    expect(pluginSource).toContain('dom.removeEventListener("click"');
  });

  it("uses setupDOMHandlers (renamed from setupTooltipHandlers)", () => {
    // The function should be renamed to reflect that it handles all DOM events
    // (click for citekey links, mouseover/mouseout for tooltips).
    expect(pluginSource).toContain("setupDOMHandlers");
    expect(pluginSource).not.toMatch(/setupTooltipHandlers/);
  });

  it("wires click handler in setupDOMHandlers alongside tooltip handlers", () => {
    // Both click and mouseover/mouseout should be registered in the same function
    // to keep DOM event delegation centralized.
    const setupFnMatch = pluginSource.match(/function setupDOMHandlers[\s\S]*?^}/m);
    expect(setupFnMatch).not.toBeNull();
    const setupFn = setupFnMatch![0];
    expect(setupFn).toContain('dom.addEventListener("click"');
    expect(setupFn).toContain("mouseover");
    expect(setupFn).toContain("mouseout");
  });

  it("cleans up all DOM listeners in destroy", () => {
    // destroy() must remove click, mouseover, and mouseout listeners
    const destroySection = pluginSource.match(/destroy\(\)[\s\S]*?^\s{4}}/m);
    expect(destroySection).not.toBeNull();
    const destroy = destroySection![0];
    expect(destroy).toContain('dom.removeEventListener("click"');
    expect(destroy).toContain("mouseover");
    expect(destroy).toContain("mouseout");
  });
});
