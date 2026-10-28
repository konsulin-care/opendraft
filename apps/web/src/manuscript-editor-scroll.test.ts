import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryWorkspace } from "@opendraft/workspace";
import { MilkdownProvider } from "@milkdown/react";
import { ManuscriptEditor } from "./components/ManuscriptEditor";
import type { EditorTestApi } from "./components/ManuscriptEditor";

/** Rich block path: the only file type mounting both surfaces. */
const DOC_PATH = "manuscripts/p/blocks/01hxyz00000000000000000000.qmd";

/** Resolve on the next animation frame. */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** A mounted editor surface: its scroll container plus a rerender mode switch. */
interface MountedSurface {
  /** The single scroll-container child of the manuscript-editor surface. */
  container: HTMLDivElement;
  /** Rerender the editor into another mode (same component instances). */
  setMode: (mode: "wysiwyg" | "source") => void;
}

/**
 * Mount ManuscriptEditor on the rich block path and wait for the editor.
 *
 * @param mode - Editing mode to mount in.
 * @returns The scroll container and a rerender-based mode switch.
 */
async function mountScrollSurface(mode: "wysiwyg" | "source" = "wysiwyg"): Promise<MountedSurface> {
  const workspace = new MemoryWorkspace();
  let api: EditorTestApi | null = null;
  const app = (next: "wysiwyg" | "source") =>
    createElement(MilkdownProvider, null, createElement(ManuscriptEditor, {
      workspace, defaultValue: "# Title\n\nSome text.", path: DOC_PATH,
      onEditorReady: (r: EditorTestApi) => { api = r; }, mode: next,
    }));
  const view = render(app(mode));
  await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
  const surface = document.querySelector('[data-testid="manuscript-editor"]');
  expect(surface).not.toBeNull();
  const container = surface!.children[0] as HTMLDivElement;
  expect(container).toBeDefined();
  return { container, setMode: (next) => view.rerender(app(next)) };
}

/**
 * Wait until the metadata panel exists and return it.
 *
 * @returns The panel section element.
 */
async function waitForPanel(): Promise<HTMLElement> {
  return waitFor(() => {
    const panel = document.querySelector('[data-testid="metadata-panel"]');
    expect(panel).not.toBeNull();
    return panel as HTMLElement;
  }, { timeout: 10000 });
}

describe("EditorSurface — one scroll container shared by both modes", () => {
  it("wysiwyg: the surface has exactly one child element and it is the overflow-auto scroll container", async () => {
    const { container } = await mountScrollSurface("wysiwyg");
    const surface = document.querySelector('[data-testid="manuscript-editor"]')!;
    expect(surface.children).toHaveLength(1);
    expect(surface.children[0]).toBe(container);
    expect(container.style.overflow).toBe("auto");
  }, 20000);

  it("source: the surface has exactly one child element and it is the overflow-auto scroll container", async () => {
    const { container } = await mountScrollSurface("source");
    const surface = document.querySelector('[data-testid="manuscript-editor"]')!;
    expect(surface.children).toHaveLength(1);
    expect(surface.children[0]).toBe(container);
    expect(container.style.overflow).toBe("auto");
  }, 20000);

  it("source mode: the source editor sits in the scroll container and the Milkdown wrapper is hidden", async () => {
    const { container } = await mountScrollSurface("source");
    const source = container.querySelector(".source-editor") as HTMLElement;
    expect(source).not.toBeNull();
    const milkdownRoot = container.querySelector("[data-milkdown-root]") as HTMLElement;
    expect(milkdownRoot).not.toBeNull();
    expect(milkdownRoot.parentElement?.style.display).toBe("none");
    expect(source.parentElement?.style.display).toBe("block");
  }, 20000);

  it("wysiwyg mode: the Milkdown root sits in the scroll container and the source editor wrapper is hidden", async () => {
    const { container } = await mountScrollSurface("wysiwyg");
    expect(container.querySelector("[data-milkdown-root]")).not.toBeNull();
    const source = container.querySelector(".source-editor") as HTMLElement;
    expect(source).not.toBeNull();
    expect(source.parentElement?.style.display).toBe("none");
  }, 20000);
});

describe("ManuscriptEditor — source mode scroll-driven panel behavior", () => {
  it("scrolling the shared container past the panel height drives --collapse-progress from 0", async () => {
    const { container } = await mountScrollSurface("source");
    const panel = await waitForPanel();
    // The collapse hook seeds the variable once scroll collapse is enabled.
    await waitFor(() => expect(panel.style.getPropertyValue("--collapse-progress")).toBe("0"));
    const body = document.querySelector('[data-testid="metadata-panel-body"]') as HTMLElement;
    expect(body).not.toBeNull();
    // jsdom reports no layout: stand in an expanded panel height (300px).
    Object.defineProperty(body, "offsetHeight", { configurable: true, value: 300 });
    container.scrollTop = 350; // past the expanded panel height
    act(() => { container.dispatchEvent(new Event("scroll")); });
    await waitFor(
      () => expect(panel.style.getPropertyValue("--collapse-progress")).toBe("1"),
      { timeout: 5000 },
    );
  }, 20000);

  it("keeps the same metadata panel element across a wysiwyg → source rerender", async () => {
    const { setMode } = await mountScrollSurface("wysiwyg");
    const before = await waitForPanel();
    setMode("source");
    // The switch applied: the source wrapper is now the visible one.
    await waitFor(() => {
      const source = document.querySelector('[data-testid="manuscript-editor"] .source-editor') as HTMLElement;
      expect(source.parentElement?.style.display).toBe("block");
    });
    expect(document.querySelector('[data-testid="metadata-panel"]')).toBe(before);
  }, 20000);

  it("restores scrollTop when focus moves outside after switching to source mode", async () => {
    const { container, setMode } = await mountScrollSurface("wysiwyg");
    setMode("source");
    container.scrollTop = 240;
    container.addEventListener("focusout", () => { container.scrollTop = 10; }, { once: true });
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    act(() => {
      container.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }));
    });
    await waitFor(() => expect(container.scrollTop).toBe(240));
    outside.remove();
  }, 20000);
});

describe("ManuscriptEditor — viewport stability when focus leaves the surface", () => {
  it("keeps scrollTop when focus moves outside the surface (blur jump is undone)", async () => {
    const { container } = await mountScrollSurface();
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
    const { container } = await mountScrollSurface();
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
