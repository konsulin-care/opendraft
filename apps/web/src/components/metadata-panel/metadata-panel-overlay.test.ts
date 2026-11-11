import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { createElement, type RefObject } from 'react';
import { MetadataPanel, metadataPanelStorageKey } from './MetadataPanel';

// @vitest-environment jsdom

const ROOT = 'manuscripts/x';
const PROJECT = 'proj-overlay';
const FRONTMATTER = 'title: "Deep Dive"\n';
const AUTHORS = 'authors:\n  - name:\n      given: Alice\n      family: Smith\n';
/** Standard seed: a titled manuscript with one author, mounted expanded. */
const SEEDED: Record<string, string> = { [`${ROOT}/_frontmatter.yml`]: FRONTMATTER, [`${ROOT}/_author.yml`]: AUTHORS };
/** Editor viewport height that makes the expanded body overlay it. */
const VIEWPORT = 400;
/** Expanded body height stubbed on the measured panel body. */
const BODY_HEIGHT = 900;
/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
/** Pending animation frames recorded by the stubbed rAF. */
let pendingFrames: ((time: number) => void)[] = [];
/** Raw opacity values written to inline styles before cssstyle parses them. */
let rawOpacityWrites: string[] = [];
/** Style prototype holding the cssstyle opacity accessor. */
let styleProto: object | undefined;
/** Original opacity accessor descriptor restored after each test. */
let opacityDescriptor: PropertyDescriptor | undefined;

/** Capture raw opacity writes: jsdom stores NaN for var(), so the value
 * React writes must be read from the setter before cssstyle parses it. */
function stubOpacityCapture(): void {
  rawOpacityWrites = [];
  styleProto = Object.getPrototypeOf(document.createElement('div').style) as object;
  opacityDescriptor = Object.getOwnPropertyDescriptor(styleProto, 'opacity');
  const { get, set } = opacityDescriptor ?? {};
  Object.defineProperty(styleProto, 'opacity', {
    configurable: true,
    get(this: unknown) { return get?.call(this); },
    set(this: unknown, value: unknown) { rawOpacityWrites.push(String(value)); set?.call(this, value); },
  });
}

/** Restore the original cssstyle opacity accessor. */
function restoreOpacityCapture(): void {
  if (styleProto && opacityDescriptor) {
    Object.defineProperty(styleProto, 'opacity', opacityDescriptor);
  }
}

/** Replace requestAnimationFrame with a queue tests flush manually. */
function stubRaf(): void {
  pendingFrames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    pendingFrames.push(cb);
    return pendingFrames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pendingFrames[id - 1] = () => {};
  });
}

/** Run every queued animation frame inside act(). */
function flushFrames(): void {
  const frames = pendingFrames;
  pendingFrames = [];
  act(() => {
    for (const frame of frames) frame(0);
  });
}

/** Detached editor scroll container with a non-zero client height. */
function makeScroller(clientHeight: number): HTMLDivElement {
  const scroller = document.createElement('div');
  scroller.tabIndex = -1;
  document.body.appendChild(scroller);
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: clientHeight });
  return scroller;
}

/** ResizeObserver stub recorded per test; `fireResize` triggers the latest. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observe = vi.fn(); readonly unobserve = vi.fn(); readonly disconnect = vi.fn();
  constructor(private readonly callback: ResizeObserverCallback) { MockResizeObserver.instances.push(this); }
  trigger(): void { this.callback([], this as unknown as ResizeObserver); }
}

/** Stub the global ResizeObserver with the recording mock. */
function stubResizeObserver(): void {
  MockResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
}

/** Fire the latest observer's resize callback inside act(). */
function fireResize(): void {
  const instance = MockResizeObserver.instances.at(-1);
  if (!instance) throw new Error('ResizeObserver was not constructed');
  act(() => instance.trigger());
}

/** Stub the expanded body height (jsdom reports zero layout metrics). */
function stubBodyHeight(height: number): void {
  Object.defineProperty(screen.getByTestId('metadata-panel-body'), 'offsetHeight', { configurable: true, value: height });
}

/** Stub `window.matchMedia` so the narrow-viewport query never matches. */
function stubWideViewport(): void {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true,
    value: (query: string) => ({ matches: false, media: query,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }) });
}

/** Seed a memory workspace with the standard manuscript metadata files. */
async function seededWorkspace(): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(SEEDED)) await ws.writeFile(path, content);
  return ws;
}

/** Render the panel against the standard seed and a viewport-height scroller. */
async function renderPanel(focusRef: RefObject<HTMLElement | null>) {
  const ws = await seededWorkspace();
  const rendered = render(createElement(MetadataPanel, { workspace: ws, manuscriptRoot: ROOT, projectKey: PROJECT, editorFocusRef: focusRef }));
  await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
  return rendered;
}

/** Render the panel with a viewport-height scroller and drain the first frames. */
async function mountPanel(): Promise<{ scroller: HTMLDivElement; unmount: () => void }> {
  const scroller = makeScroller(VIEWPORT);
  const rendered = await renderPanel({ current: scroller });
  flushFrames();
  return { scroller, unmount: rendered.unmount };
}

/** Drive the panel into its overlay state: body taller than the viewport. */
function activateOverlay(): HTMLElement {
  stubBodyHeight(BODY_HEIGHT);
  fireResize();
  const overlay = screen.getByTestId('metadata-panel-overlay');
  flushFrames();
  return overlay;
}

/** Overwrite scrollTop (jsdom has no layout) and fire a scroll event. */
function setScrollTop(el: HTMLElement, value: number): void {
  Object.defineProperty(el, 'scrollTop', { configurable: true, value });
  fireEvent.scroll(el);
  flushFrames();
}

beforeEach(() => {
  localStorage.clear();
  stubWideViewport();
  stubRaf();
  stubResizeObserver();
  stubOpacityCapture();
});

afterEach(() => {
  restoreOpacityCapture();
  localStorage.clear();
  vi.unstubAllGlobals();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('MetadataPanel overlay scroll collapse', () => {
  it('fades in the pinned bar title and byline by the overlay scroll progress', async () => {
    const { scroller } = await mountPanel();
    // Expanded at the top: the bar text is hidden behind progress 0.
    expect(screen.queryByTestId('metadata-panel-bar-title')).toBeNull();
    const overlay = activateOverlay();
    const panel = screen.getByTestId('metadata-panel');
    expect(screen.queryByTestId('metadata-panel-overlay')).not.toBeNull();
    // Half the expanded body scrolled: half progress fades the text in.
    setScrollTop(overlay, BODY_HEIGHT / 2);
    expect(panel.style.getPropertyValue('--collapse-progress')).toBe('0.5');
    const title = screen.getByTestId('metadata-panel-bar-title');
    const byline = screen.getByTestId('metadata-panel-byline');
    expect(title.textContent).toBe('Deep Dive');
    expect(byline.textContent).toContain('Alice Smith');
    // Title and byline share one wrapper whose opacity is bound to the
    // panel progress variable; jsdom mangles var() on read, so assert
    // the raw value React wrote instead of the parsed one.
    expect(title.parentElement).toBe(byline.parentElement);
    expect(rawOpacityWrites).toContain('var(--collapse-progress, 0)');
    expect(screen.getByTestId('metadata-panel-toggle').getAttribute('aria-expanded')).toBe('true');
    scroller.remove();
  });

  it('switches to collapsed and closes the overlay once the body scrolls out', async () => {
    const { scroller } = await mountPanel();
    const overlay = activateOverlay();
    setScrollTop(overlay, BODY_HEIGHT);
    expect(screen.queryByTestId('metadata-panel-overlay')).toBeNull();
    const toggle = screen.getByTestId('metadata-panel-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('metadata-panel-bar-title').textContent).toBe('Deep Dive');
    scroller.remove();
  });

  it('does not persist the scroll-out collapse, so a remount starts expanded', async () => {
    const { scroller, unmount } = await mountPanel();
    const overlay = activateOverlay();
    setScrollTop(overlay, BODY_HEIGHT);
    expect(screen.queryByTestId('metadata-panel-overlay')).toBeNull();
    // Session-only collapse: localStorage keeps its previous (empty) value.
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBeNull();
    unmount();
    await renderPanel({ current: scroller });
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    scroller.remove();
  });
});
