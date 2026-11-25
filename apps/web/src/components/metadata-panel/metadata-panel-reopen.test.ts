import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { createElement, type RefObject } from 'react';
import { MetadataPanel, metadataPanelStorageKey } from './MetadataPanel';

// @vitest-environment jsdom

const ROOT = 'manuscripts/x';
const PROJECT = 'proj-reopen';
const FRONTMATTER = 'title: "Deep Dive"\n';
const AUTHORS = 'authors:\n  - name:\n      given: Alice Marie\n      family: Smith\n  - name:\n      given: Budi\n      family: Lee\n';
/** Standard seed: a titled manuscript with two authors. */
const SEEDED: Record<string, string> = {
  [`${ROOT}/_frontmatter.yml`]: FRONTMATTER,
  [`${ROOT}/_author.yml`]: AUTHORS,
};
/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
/** Pending animation frames recorded by the stubbed rAF. */
let pendingFrames: ((time: number) => void)[] = [];

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

/** Detached editor scroll container (clientHeight 0 unless overridden). */
function makeScroller(clientHeight = 0): HTMLDivElement {
  const scroller = document.createElement('div');
  scroller.tabIndex = -1;
  document.body.appendChild(scroller);
  if (clientHeight > 0) {
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: clientHeight });
  }
  return scroller;
}

/** Stub the expanded body height (jsdom reports zero layout metrics). */
function stubBodyHeight(height: number): void {
  Object.defineProperty(screen.getByTestId('metadata-panel-body'), 'offsetHeight', {
    configurable: true, value: height,
  });
}

/** Stub `window.matchMedia` so the narrow-viewport query matches or not. */
function stubNarrowViewport(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: narrow && query.includes('639'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

/** Seed a memory workspace with manuscript metadata files. */
async function seededWorkspace(seed: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(seed)) await ws.writeFile(path, content);
  return ws;
}

/** Render the panel with a seeded workspace and an editor scroll ref. */
async function renderPanel(
  seed: Record<string, string>,
  focusRef?: RefObject<HTMLElement | null>,
): Promise<void> {
  const workspace = await seededWorkspace(seed);
  render(createElement(MetadataPanel, {
    workspace, manuscriptRoot: ROOT, projectKey: PROJECT, editorFocusRef: focusRef,
  }));
  await waitFor(() => expect(screen.getByTestId('metadata-panel')).toBeDefined());
}

/** Scroll the editor container and drain the throttled frames. */
function scrollTo(scroller: HTMLElement, top: number): void {
  scroller.scrollTop = top;
  fireEvent.scroll(scroller);
  flushFrames();
}

beforeEach(() => {
  localStorage.clear();
  stubNarrowViewport(false);
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('MetadataPanel chevron reopen', () => {
  it('reopens and scrolls the editor to the top after a chevron collapse and a scroll', async () => {
    stubRaf();
    const scroller = makeScroller();
    await renderPanel(SEEDED, { current: scroller });
    flushFrames();
    const toggle = screen.getByTestId('metadata-panel-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // Chevron collapse, then scroll the editor while the panel is collapsed.
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    stubBodyHeight(300);
    scrollTo(scroller, 300);
    // One click must reopen the panel, not merely scroll it to the top.
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(scroller.scrollTop).toBe(0);
    expect(screen.queryByTestId('metadata-panel-expanded')).not.toBeNull();
    expect(localStorage.getItem(metadataPanelStorageKey(PROJECT))).toBe('expanded');
    scroller.remove();
  });

  it('shows the bar title and byline at full opacity after a reopen and scroll past the body', async () => {
    stubRaf();
    const scroller = makeScroller();
    await renderPanel(SEEDED, { current: scroller });
    flushFrames();
    const toggle = screen.getByTestId('metadata-panel-toggle');
    // Chevron collapse, reopen, then scroll the expanded body away.
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    stubBodyHeight(300);
    scrollTo(scroller, 300);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const title = screen.getByTestId('metadata-panel-bar-title');
    const byline = screen.getByTestId('metadata-panel-byline');
    expect(title.textContent).toBe('Deep Dive');
    expect(byline.textContent).toContain('Smith A. M., Lee B.');
    // The bar text fades in through the progress var; it must not be bound
    // to a stale 0 from before the reopen.
    const textWrapper = title.parentElement as HTMLElement;
    expect(textWrapper.style.opacity).toBe('1');
    expect(screen.getByTestId('metadata-panel').style.getPropertyValue('--collapse-progress')).toBe('1');
    scroller.remove();
  });
});
