import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import type { RefObject } from 'react';
import { ManuscriptEditor } from '../ManuscriptEditor';
import { MetadataPanel, manuscriptRootFromPath, metadataPanelStorageKey } from './MetadataPanel';

// @vitest-environment jsdom
const ROOT = 'manuscripts/x';
const PROJECT = 'proj-d2';
const FRONTMATTER = 'title: "Deep Dive"\n';
const AUTHORS = 'authors:\n  - name:\n      given: Alice Marie\n      family: Smith\n  - name:\n      given: Budi\n      family: Lee\n';
/** Standard seed: a titled manuscript with two authors. */
const SEEDED: Record<string, string> = { [`${ROOT}/_frontmatter.yml`]: FRONTMATTER, [`${ROOT}/_author.yml`]: AUTHORS };
/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
/** Pending animation frames recorded by the stubbed rAF. */
let pendingFrames: ((time: number) => void)[] = [];
/** Replace requestAnimationFrame with a queue tests flush manually. */
function stubRaf(): void {
  pendingFrames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => { pendingFrames.push(cb); return pendingFrames.length; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { pendingFrames[id - 1] = () => {}; });
}
/** Run every queued animation frame inside act(). */
function flushFrames(): void {
  const frames = pendingFrames;
  pendingFrames = [];
  act(() => { for (const frame of frames) frame(0); });
}
/** Detached editor scroll container (clientHeight 0 unless overridden). */
function makeScroller(clientHeight = 0): HTMLDivElement {
  const scroller = document.createElement('div');
  scroller.tabIndex = -1;
  document.body.appendChild(scroller);
  if (clientHeight > 0) Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: clientHeight });
  return scroller;
}
/** ResizeObserver stub recorded per test; `fireResize` triggers the latest. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  constructor(private readonly callback: ResizeObserverCallback) { MockResizeObserver.instances.push(this); }
  trigger(): void { this.callback([], this as unknown as ResizeObserver); }
}
/** Stub the global ResizeObserver with the recording mock. */
function stubResizeObserver(): void { MockResizeObserver.instances = []; vi.stubGlobal('ResizeObserver', MockResizeObserver); }
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
/** Stub `window.matchMedia` so the narrow-viewport query matches or not. */
function stubNarrowViewport(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (query: string) => ({
      matches: narrow && query.includes('639'), media: query,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {},
      onchange: null, dispatchEvent: () => false,
    }),
  });
}
/** Seed a memory workspace with manuscript metadata files. */
async function seededWorkspace(seed: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(seed)) await ws.writeFile(path, content);
  return ws;
}
/** Render the panel with a seeded workspace; defaults to the standard seed. */
async function renderPanel(seed: Record<string, string> = SEEDED, focusRef?: RefObject<HTMLElement | null>) {
  const ws = await seededWorkspace(seed);
  const rendered = render(<MetadataPanel workspace={ws} manuscriptRoot={ROOT} projectKey={PROJECT} editorFocusRef={focusRef} />);
  await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
  return rendered;
}
beforeEach(() => { localStorage.clear(); stubNarrowViewport(false); });
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia); });

describe('manuscriptRootFromPath', () => {
  it('returns the manuscript root for files under manuscripts/<id>/', () => {
    expect(manuscriptRootFromPath('manuscripts/x/blocks/A.qmd')).toBe('manuscripts/x');
  });
  it('returns null for files outside a manuscript', () => {
    expect(manuscriptRootFromPath('opendraft.yml')).toBeNull();
  });
});

describe('MetadataPanel collapsed bar', () => {
  it('shows the title and given-then-family byline names', async () => {
    await renderPanel();
    expect(screen.getByTestId('metadata-panel-bar-title').textContent).toBe('Deep Dive');
    expect(screen.getByTestId('metadata-panel-byline').textContent).toContain('Alice Marie Smith, Budi Lee');
  });
  it('shows "N authors" below the 640px breakpoint', async () => {
    stubNarrowViewport(true);
    await renderPanel();
    expect(screen.getByTestId('metadata-panel-byline').textContent).toBe('2 authors');
  });
  it('renders a hairline separator element', async () => {
    await renderPanel({ [`${ROOT}/_frontmatter.yml`]: FRONTMATTER });
    expect(screen.getByTestId('metadata-panel-separator').className).toContain('h-px');
  });
  it('chevron toggle expands and collapses the panel', async () => {
    await renderPanel({ [`${ROOT}/_frontmatter.yml`]: FRONTMATTER });
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
  });
});

describe('MetadataPanel collapse/expand body', () => {
  it('collapsed: bar title and byline render, body is grid-rows 0fr and aria-hidden', async () => {
    await renderPanel();
    expect(screen.getByTestId('metadata-panel-bar-title').textContent).toBe('Deep Dive');
    expect(screen.getByTestId('metadata-panel-byline').textContent).toContain('Alice Marie Smith, Budi Lee');
    const body = screen.getByTestId('metadata-panel-body');
    expect(body.className).toContain('grid-rows-[0fr]');
    expect(body.getAttribute('aria-hidden')).toBe('true');
    expect(body.hasAttribute('inert')).toBe(true);
  });
  it('expanded: title and byline render once in the animated body, not in the bar', async () => {
    await renderPanel();
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-bar-title')).toBeNull();
    expect(screen.queryByTestId('metadata-panel-byline')).toBeNull();
    expect(screen.getAllByTestId('metadata-panel-title-input')).toHaveLength(1);
    expect(screen.getAllByTestId('article-byline')).toHaveLength(1);
    const body = screen.getByTestId('metadata-panel-body');
    expect(body.className).toContain('grid-rows-[1fr]');
    expect(body.className).toMatch(/transition/);
    expect(body.getAttribute('aria-hidden')).toBeNull();
    expect(body.hasAttribute('inert')).toBe(false);
  });
});

describe('MetadataPanel expanded state', () => {
  it('mounts expanded when the title is missing', async () => {
    await renderPanel({ [`${ROOT}/_author.yml`]: AUTHORS });
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
  });
  it('restores the collapsed state after a remount', async () => {
    // Empty title starts expanded; collapsing persists for the project.
    const { unmount } = await renderPanel({});
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBe('collapsed');
    unmount();
    await renderPanel({});
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
  });
  it('collapses on Escape and focuses the editor container', async () => {
    const target = document.createElement('div');
    target.tabIndex = -1;
    document.body.appendChild(target);
    await renderPanel({}, { current: target });
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    fireEvent.keyDown(screen.getByTestId('metadata-panel'), { key: 'Escape' });
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
    expect(document.activeElement).toBe(target);
    target.remove();
  });
});

describe('MetadataPanel scroll collapse', () => {
  it('collapses progressively 1:1 with scroll and re-expands at the top without persisting', async () => {
    stubRaf();
    const scroller = makeScroller();
    await renderPanel(SEEDED, { current: scroller });
    flushFrames();
    // A titled manuscript starts collapsed; chevron-expand it first.
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    stubBodyHeight(300);
    const stored = localStorage.getItem(metadataPanelStorageKey(PROJECT));
    const panel = screen.getByTestId('metadata-panel');
    const toggle = screen.getByTestId('metadata-panel-toggle');
    const scroll = (top: number): void => { scroller.scrollTop = top; fireEvent.scroll(scroller); flushFrames(); };
    // Half the expanded height scrolled: half progress, still expanded.
    scroll(150);
    expect(panel.style.getPropertyValue('--collapse-progress')).toBe('0.5');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // Scrolled past the expanded height: fully collapsed via scroll.
    scroll(300);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('metadata-panel-bar-title').textContent).toBe('Deep Dive');
    expect(panel.style.getPropertyValue('--collapse-progress')).toBe('1');
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBe(stored);
    // Back to the top: expanded again; scroll collapse never persists.
    scroll(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByTestId('metadata-panel-bar-title')).toBeNull();
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBe(stored);
    scroller.remove();
  });
  it('keeps only the bar sticky inside the editor scroll container', async () => {
    await renderPanel({ [`${ROOT}/_frontmatter.yml`]: FRONTMATTER });
    const bar = screen.getByTestId('metadata-panel-bar');
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('top-0');
    expect(screen.getByTestId('metadata-panel').className).not.toContain('sticky');
  });
});

describe('MetadataPanel explicit collapse', () => {
  it('keeps a chevron collapse when scrolling to the top', async () => {
    stubRaf();
    const scroller = makeScroller();
    await renderPanel({}, { current: scroller });
    flushFrames();
    stubBodyHeight(300);
    // An untitled manuscript starts expanded; chevron collapse persists.
    fireEvent.click(screen.getByTestId('metadata-panel-toggle'));
    const toggle = screen.getByTestId('metadata-panel-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBe('collapsed');
    scroller.scrollTop = 300;
    fireEvent.scroll(scroller);
    scroller.scrollTop = 0;
    fireEvent.scroll(scroller);
    flushFrames();
    // Explicit collapse is not reversed by scrolling.
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('metadata-panel').style.getPropertyValue('--collapse-progress')).toBe('0');
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBe('collapsed');
    scroller.remove();
  });
});

describe('MetadataPanel overlay', () => {
  it('covers the editor area while the expanded body is taller than the viewport', async () => {
    stubResizeObserver(); stubRaf();
    const scroller = makeScroller(400);
    await renderPanel({}, { current: scroller });
    flushFrames();
    // Untitled manuscript starts expanded; body is taller than the viewport.
    stubBodyHeight(900);
    fireResize();
    const overlay = screen.getByTestId('metadata-panel-overlay');
    expect(overlay.className).toContain('overflow-y-auto');
    const panel = screen.getByTestId('metadata-panel');
    expect(panel.className).toContain('absolute');
    expect(panel.className).not.toContain('fixed');
    // Scroll collapse is disabled while the overlay owns the scrolling.
    scroller.scrollTop = 500;
    fireEvent.scroll(scroller);
    flushFrames();
    expect(panel.style.getPropertyValue('--collapse-progress')).toBe('0');
    expect(screen.getByTestId('metadata-panel-toggle').getAttribute('aria-expanded')).toBe('true');
    // Content fits the viewport again: inline layout returns.
    stubBodyHeight(300);
    fireResize();
    expect(screen.queryByTestId('metadata-panel-overlay')).toBeNull();
    expect(screen.getByTestId('metadata-panel').className).toContain('relative');
    scroller.remove();
  });
  it('collapses on Escape and removes the overlay', async () => {
    stubResizeObserver(); stubRaf();
    const scroller = makeScroller(400);
    await renderPanel({}, { current: scroller });
    flushFrames();
    stubBodyHeight(900);
    fireResize();
    expect(screen.queryByTestId('metadata-panel-overlay')).not.toBeNull();
    fireEvent.keyDown(screen.getByTestId('metadata-panel'), { key: 'Escape' });
    expect(screen.queryByTestId('metadata-panel-expanded')).toBeNull();
    expect(screen.queryByTestId('metadata-panel-overlay')).toBeNull();
    scroller.remove();
  });
});

describe('MetadataPanel editor integration', () => {
  it('renders for a manuscript path and not for opendraft.yml', async () => {
    const ws = await seededWorkspace(SEEDED);
    const { unmount } = render(<ManuscriptEditor workspace={ws} defaultValue="key: value" path="manuscripts/x/blocks/A.qmd" mode="source" projectId={PROJECT} />);
    await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
    expect(screen.getByTestId('metadata-panel-byline').textContent).toContain('Alice Marie Smith, Budi Lee');
    unmount();
    render(<ManuscriptEditor workspace={ws} defaultValue="key: value" path="opendraft.yml" mode="source" projectId={PROJECT} />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined());
    expect(screen.queryByTestId('metadata-panel')).toBeNull();
  });
});
