import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryWorkspace } from "@opendraft/workspace";
import { ManuscriptEditor } from "./components/ManuscriptEditor";
import { ManuscriptView } from "./components/ManuscriptView";

/** Manuscript block path: opens in the source-only editor. */
const DOC_PATH = "manuscripts/p/blocks/01hxyz000000000000000000000000.qmd";

/** Resolve on the next animation frame. */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Mount the source-only ManuscriptEditor and wait for its CodeMirror surface.
 *
 * @returns The single scroll-container child of the manuscript-editor surface.
 */
async function mountScrollSurface(): Promise<HTMLDivElement> {
  const workspace = new MemoryWorkspace();
  render(createElement(ManuscriptEditor, {
    workspace, defaultValue: "# Title\n\nSome text.", path: DOC_PATH,
  }));
  await waitFor(() => expect(document.querySelector(".source-editor .cm-editor")).not.toBeNull(), { timeout: 10000 });
  const surface = document.querySelector('[data-testid="manuscript-editor"]');
  expect(surface).not.toBeNull();
  const container = surface!.children[0] as HTMLDivElement;
  expect(container).toBeDefined();
  return container;
}

describe("ManuscriptEditor — one scroll container for the source-only editor", () => {
  it("the surface has exactly one child element and it is the overflow-auto scroll container", async () => {
    const container = await mountScrollSurface();
    const surface = document.querySelector('[data-testid="manuscript-editor"]')!;
    expect(surface.children).toHaveLength(1);
    expect(surface.children[0]).toBe(container);
    expect(container.style.overflow).toBe("auto");
  }, 20000);

  it("the source editor sits in the scroll container's reading column", async () => {
    const container = await mountScrollSurface();
    const column = container.querySelector(".reading-column") as HTMLElement;
    expect(column).not.toBeNull();
    expect(column.querySelector(".source-editor")).not.toBeNull();
    expect(container.querySelector("[data-milkdown-root]")).toBeNull();
    expect(container.querySelector(".ProseMirror")).toBeNull();
  }, 20000);
});

describe("ManuscriptView — one scroll container for the reading view", () => {
  it("the surface has exactly one child element and it is the overflow-auto scroll container", async () => {
    render(createElement(ManuscriptView, {
      workspace: new MemoryWorkspace(), dir: "manuscripts/p", projectKey: "scroll-test",
    }));
    await waitFor(() => expect(screen.getByTestId("manuscript-view")).toBeDefined(), { timeout: 10000 });
    const surface = screen.getByTestId("manuscript-view");
    expect(surface.children).toHaveLength(1);
    const container = surface.children[0] as HTMLDivElement;
    expect(container.style.overflow).toBe("auto");
    expect(container.querySelector(".reading-column")).not.toBeNull();
  }, 20000);
});

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
