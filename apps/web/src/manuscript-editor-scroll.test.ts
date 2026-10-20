import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryWorkspace } from "@opendraft/workspace";
import { MilkdownProvider } from "@milkdown/react";
import { ManuscriptEditor } from "./components/ManuscriptEditor";
import type { EditorTestApi } from "./components/ManuscriptEditor";

/** Resolve on the next animation frame. */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Mount ManuscriptEditor in WYSIWYG mode and return its scroll container. */
async function mountScrollSurface(): Promise<HTMLDivElement> {
  const workspace = new MemoryWorkspace();
  let api: EditorTestApi | null = null;
  render(createElement(MilkdownProvider, null, createElement(ManuscriptEditor, {
    workspace, defaultValue: "# Title\n\nSome text.", path: "manuscripts/p/blocks/01hxyz00000000000000000000.qmd", onEditorReady: (r) => { api = r; }, mode: "wysiwyg" as const,
  })));
  await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
  const container = document.querySelector('[data-testid="manuscript-editor"] > div') as HTMLDivElement;
  expect(container).not.toBeNull();
  return container;
}

describe("ManuscriptEditor — viewport stability when focus leaves the surface", () => {
  it("keeps scrollTop when focus moves outside the surface (blur jump is undone)", async () => {
    const container = await mountScrollSurface();
    container.scrollTop = 240;

    // Emulate the browser's scroll-on-blur jump: a listener that runs after
    // the editor's focusout guard moves the viewport mid-focus-change.
    container.addEventListener("focusout", () => { container.scrollTop = 10; }, { once: true });
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    act(() => {
      container.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }));
    });

    // The guard restores the pre-blur position on the next frame.
    await waitFor(() => expect(container.scrollTop).toBe(240));
    outside.remove();
  }, 20000);

  it("leaves focus moves within the surface untouched (no restore)", async () => {
    const container = await mountScrollSurface();
    container.scrollTop = 240;

    // A same-surface focus move (e.g. table cell to table cell) may scroll
    // the target into view; the guard must not fight it.
    container.addEventListener("focusout", () => { container.scrollTop = 10; }, { once: true });
    const inside = document.createElement("span");
    container.appendChild(inside);
    act(() => {
      container.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: inside }));
    });
    await act(nextFrame);
    expect(container.scrollTop).toBe(10);
    inside.remove();
  }, 20000);
});
