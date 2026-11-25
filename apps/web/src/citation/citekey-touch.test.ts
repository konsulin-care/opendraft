// @vitest-environment jsdom
/**
 * Touch behaviour of the citation plugin's DOM delegation: a touch tap on
 * a citekey opens the reference sheet instead of the DOI/URL, a touch tap
 * on a cross-reference opens its sheet, and hover tooltips are suppressed
 * after a touch while mouse clicks keep opening links.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EditorState } from '@milkdown/kit/prose/state';
import { Schema } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Reference } from '@opendraft/references';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { citationPluginKey, createCitationPlugin } from './plugin';
import {
  handleClickEvent,
  handleMouseOver,
  handlePointerDown,
} from './citekey-interactions';
import { hideReferenceSheet } from './reference-sheet';
import { hideCrossrefSheet } from './crossref-sheet';

/** Reference with a DOI, used by the citekey fixtures. */
const REF: Reference = {
  citeKey: 'smith2024',
  entryType: 'article',
  fields: {
    author: 'Smith, John',
    year: '2024',
    title: 'A Test Article',
    journal: 'Test Journal',
    doi: '10.1000/test',
  },
};

/** Minimal workspace adapter; the plugin view never loads in these tests. */
const WORKSPACE: WorkspaceAdapter = {
  readFile: vi.fn().mockResolvedValue(null),
  writeFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  listFiles: vi.fn().mockResolvedValue([]),
  listAll: vi.fn().mockResolvedValue([]),
};

/** Build a fake editor view whose citation state holds the fixture items. */
function createView(items: Reference[]): EditorView {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      text: { group: 'inline' },
    },
  });
  let state = EditorState.create({
    schema,
    plugins: [createCitationPlugin(WORKSPACE)],
  });
  state = state.apply(
    state.tr.setMeta(citationPluginKey, { type: 'SET_ITEMS', items }),
  );
  return { state } as unknown as EditorView;
}

/** Create a delegated-link span and attach it to the document body. */
function createLink(
  className: string,
  attrs: Record<string, string>,
): HTMLElement {
  const el = document.createElement('span');
  el.className = className;
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  document.body.appendChild(el);
  return el;
}

/** Build a click event carrying a target and a preventDefault spy. */
function clickEvent(target: HTMLElement): Event {
  return {
    target,
    preventDefault: vi.fn(),
  } as unknown as Event;
}

/** Simulate a touch tap: a touch pointerdown followed by a click. */
function touchTap(view: EditorView, target: HTMLElement): boolean {
  handlePointerDown({ pointerType: 'touch' });
  let handled = false;
  act(() => {
    handled = handleClickEvent(view, clickEvent(target));
  });
  return handled;
}

afterEach(() => {
  cleanup();
  hideReferenceSheet();
  hideCrossrefSheet();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('citation plugin — touch pointerdown wiring', () => {
  const pluginSource = readFileSync(resolve(__dirname, 'plugin.ts'), 'utf8');

  it('registers a pointerdown listener in setupDOMHandlers', () => {
    const setupFn = pluginSource.match(/function setupDOMHandlers[\s\S]*?^}/m);
    expect(setupFn).not.toBeNull();
    expect(setupFn![0]).toContain('dom.addEventListener("pointerdown"');
  });

  it('removes the pointerdown listener on destroy', () => {
    expect(pluginSource).toContain('dom.removeEventListener("pointerdown"');
  });
});

describe('citation plugin — touch taps open sheets', () => {
  it('opens the reference sheet for a citekey tap without calling window.open', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = createView([REF]);
    const link = createLink('citekey-link', { 'data-citekey': 'smith2024' });

    expect(touchTap(view, link)).toBe(true);

    expect(screen.getByRole('heading', { name: 'smith2024' })).toBeTruthy();
    expect(document.querySelector('.reference-sheet-container')).not.toBeNull();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens the cross-reference sheet for a crossref tap', () => {
    const view = createView([REF]);
    const link = createLink('crossref-link', {
      'data-crossref': 'fig-cat',
      'data-crossref-kind': 'fig',
      'data-crossref-caption': 'A cat',
      'data-crossref-file': 'chapter.qmd',
    });

    expect(touchTap(view, link)).toBe(true);

    expect(screen.getByRole('heading', { name: 'Figure' })).toBeTruthy();
    expect(document.body.textContent).toContain('fig-cat');
    expect(document.body.textContent).toContain('A cat');
  });

  it('opens the broken cross-reference sheet for an unknown label tap', () => {
    const view = createView([REF]);
    const link = createLink('crossref-broken', { 'data-crossref': 'fig-missing' });

    expect(touchTap(view, link)).toBe(true);

    expect(screen.getByRole('heading', { name: 'Figure' })).toBeTruthy();
    expect(document.body.textContent).toContain(
      'Unknown cross-reference: fig-missing',
    );
  });
});

describe('citation plugin — touch suppresses hover, mouse keeps links', () => {
  it('shows no tooltip on mouseover after a touch pointerdown', () => {
    const view = createView([REF]);
    const link = createLink('citekey-link', { 'data-citekey': 'smith2024' });

    handlePointerDown({ pointerType: 'touch' });
    act(() => {
      handleMouseOver(view, {
        target: link,
      } as unknown as MouseEvent);
    });

    expect(document.querySelector('.citekey-tooltip-container')).toBeNull();
  });

  it('still opens the citekey link for a mouse click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = createView([REF]);
    const link = createLink('citekey-link', { 'data-citekey': 'smith2024' });

    handlePointerDown({ pointerType: 'mouse' });
    expect(handleClickEvent(view, clickEvent(link))).toBe(true);

    expect(openSpy).toHaveBeenCalledWith(
      'https://doi.org/10.1000/test',
      '_blank',
      'noopener,noreferrer',
    );
    expect(document.querySelector('.reference-sheet-container')).toBeNull();
  });
});
