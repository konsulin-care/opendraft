/**
 * Shared mount harness for the BlockBody tests: a fake
 * IntersectionObserver that reports every observed element as
 * intersecting on the next frame (so lazily mounted editors mount),
 * a workspace seeded with the block file, and helpers to await the
 * wired editor API. Lives outside the test file so that file stays
 * under the 300-line ceiling.
 */
import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockBody } from './BlockBody';
import type { EditorTestApi } from '../caret-mode-switch';

/** Manuscript directory used by every fixture. */
export const DIR = 'manuscripts/demo';

/** Debounce window of the shared autosave plus the listener lag. */
export const SAVE_WINDOW_MS = 1500;

/**
 * Stand-in IntersectionObserver that reports every observed element as
 * intersecting on the next frame, so lazily mounted editors mount.
 */
export class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  private readonly callback: IntersectionObserverCallback;
  private readonly targets: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
    const entry = { target, isIntersecting: true } as IntersectionObserverEntry;
    queueMicrotask(() => this.callback([entry], this));
  }

  unobserve(target: Element): void {
    const index = this.targets.indexOf(target);
    if (index >= 0) this.targets.splice(index, 1);
  }

  disconnect(): void {
    this.targets.length = 0;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** Every editor API handed to `onEditorReady`, in order. */
let editorApis: EditorTestApi[] = [];

/**
 * Reset collected harness state and install the fake
 * IntersectionObserver global. Call from `beforeEach`.
 */
export function installBlockBodyHarness(): void {
  FakeIntersectionObserver.instances = [];
  editorApis = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
}

/**
 * Uninstall stubbed globals and reset collected harness state.
 * Call from `afterEach`.
 */
export function uninstallBlockBodyHarness(): void {
  vi.unstubAllGlobals();
  editorApis = [];
}

/**
 * Resolve once an editor API has been wired to the mounted body.
 *
 * @returns The most recent API handed to `onEditorReady`.
 */
export async function waitForApi(): Promise<EditorTestApi> {
  await waitFor(() => {
    expect(editorApis.length).toBeGreaterThan(0);
  }, { timeout: 10000 });
  return editorApis[editorApis.length - 1];
}

/**
 * Render a block body against a workspace seeded with the block file.
 *
 * @param body - Block file text, canonical heading included.
 * @returns The workspace and a spy counting workspace writes.
 */
export async function mountBody(body: string): Promise<{
  ws: WorkspaceAdapter;
  writes: number;
  path: string;
}> {
  const ws = new MemoryWorkspace();
  const path = `${DIR}/blocks/methods.qmd`;
  await ws.writeFile(path, body);
  let writes = 0;
  const original = ws.writeFile.bind(ws);
  ws.writeFile = async (target, text) => {
    writes += 1;
    return original(target, text);
  };
  render(
    createElement(BlockBody, {
      ws,
      dir: DIR,
      short: 'methods',
      title: 'Methods',
      collapsed: false,
      onEditorReady: (api: EditorTestApi) => editorApis.push(api),
    }),
  );
  return { ws, writes, path };
}
