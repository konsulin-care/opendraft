// @vitest-environment jsdom
/**
 * BlockBody tests: typing persists the block file with its canonical
 * heading preserved, mounting without edits performs no write, a
 * loaded body carrying a level-1 heading neither writes nor hides the
 * header's warning badge, and Quarto constructs (::: divs, {#fig-x}
 * attributes, shortcodes and @sec- references) survive load and save
 * unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockBody } from './BlockBody';
import { BlockHeader, reportLoadedBody } from './BlockHeader';
import { requestFocusForShort } from '../caret-mode-switch';
import type { EditorTestApi } from '../caret-mode-switch';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Debounce window of the shared autosave plus the listener lag. */
const SAVE_WINDOW_MS = 1500;

/**
 * Stand-in IntersectionObserver that reports every observed element as
 * intersecting on the next frame, so lazily mounted editors mount.
 */
class FakeIntersectionObserver implements IntersectionObserver {
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

/** Resolves once an editor API has been wired. */
async function waitForApi(): Promise<EditorTestApi> {
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
async function mountBody(body: string): Promise<{
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
    <BlockBody
      ws={ws}
      dir={DIR}
      short="methods"
      title="Methods"
      collapsed={false}
      onEditorReady={(api) => editorApis.push(api)}
    />,
  );
  return { ws, writes, path };
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  editorApis = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  editorApis = [];
});

describe('BlockBody autosave', () => {
  it('persists typing to the block file with the canonical heading preserved', async () => {
    const { ws, path } = await mountBody('# Methods {#sec-methods .deo-section}\nBody text.\n');
    const api = await waitForApi();

    await act(async () => {
      api.insertText(' Extra sentence.');
    });

    await waitFor(async () => {
      const saved = await ws.readFile(path);
      expect(saved).toContain('# Methods {#sec-methods .deo-section}');
      expect(saved).toContain('Extra sentence.');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
  }, 20000);

  it('performs no file write when mounted without user edits', async () => {
    const { ws, writes, path } = await mountBody(
      '# Methods {#sec-methods .deo-section}\nQuiet body.\n',
    );
    await waitForApi();
    const before = await ws.readFile(path);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, SAVE_WINDOW_MS));
    });

    expect(writes).toBe(0);
    expect(await ws.readFile(path)).toBe(before);
  }, 20000);
});

describe('BlockBody focus-on-creation', () => {
  it('leaves a request for another short unfulfilled when this body registers', async () => {
    requestFocusForShort('intro');
    await mountBody('# Methods {#sec-methods .deo-section}\nBody text.\n');
    await waitForApi();
    await waitFor(() => {
      const surface = document.querySelector<HTMLElement>(
        '[data-testid="block-body-editor"] .ProseMirror',
      );
      expect(surface).not.toBeNull();
      expect(surface?.contains(document.activeElement)).toBe(false);
    }, { timeout: 10000 });
  }, 20000);

  it('fulfils a pending focus request with DOM focus inside the mounted body', async () => {
    requestFocusForShort('methods');
    await mountBody('# Methods {#sec-methods .deo-section}\nBody text.\n');
    await waitForApi();
    await waitFor(() => {
      const surface = document.querySelector<HTMLElement>(
        '[data-testid="block-body-editor"] .ProseMirror',
      );
      expect(surface?.contains(document.activeElement)).toBe(true);
    }, { timeout: 10000 });
  }, 20000);
});

describe('BlockBody level-1 load path', () => {
  it('performs no file write when the loaded file already contains a level-1 heading', async () => {
    const { ws, path } = await mountBody(
      '# Methods {#sec-methods .deo-section}\n# Legacy H1\nBody text.',
    );
    // mountBody returns its write count by value (a snapshot taken
    // before the load), so count writes on the live spy directly.
    let writes = 0;
    const spied = ws.writeFile.bind(ws);
    ws.writeFile = async (target, text) => {
      writes += 1;
      return spied(target, text);
    };
    await waitForApi();
    const before = await ws.readFile(path);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, SAVE_WINDOW_MS));
    });

    expect(writes).toBe(0);
    expect(await ws.readFile(path)).toBe(before);
  }, 20000);
});

describe('BlockBody level-1 warning badge', () => {
  it('shows the level-1 warning badge in the header after that load', async () => {
    // Reset the shared per-short registry so the badge must come from
    // this load, not from an earlier test's report.
    reportLoadedBody('methods', '## Level two');
    const ws = new MemoryWorkspace();
    const path = `${DIR}/blocks/methods.qmd`;
    await ws.writeFile(
      path,
      '# Methods {#sec-methods .deo-section}\n# Legacy H1\nBody text.',
    );
    render(
      <>
        <BlockHeader
          short="methods"
          title="Methods"
          collapsed={false}
          onToggle={() => undefined}
          wordCount={0}
          saveStatus="saved"
        />
        <BlockBody
          ws={ws}
          dir={DIR}
          short="methods"
          title="Methods"
          collapsed={false}
        />
      </>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('level-1-warning-badge')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  }, 20000);
});

describe('BlockBody Quarto round-trip', () => {
  it('keeps ::: divs, {#fig-x} attributes, shortcodes and @sec- refs unchanged across load and save', async () => {
    const quartoBody = [
      '# Results {#sec-results .deo-section}',
      '',
      '::: {#fig-results}',
      'A captioned figure.',
      ':::',
      '',
      '{{< include other.qmd >}}',
      '',
      'See @sec-methods for details.',
      '',
    ].join('\n');
    const { ws, path } = await mountBody(quartoBody);
    const api = await waitForApi();

    await act(async () => {
      api.insertText(' More.');
    });

    await waitFor(async () => {
      const saved = await ws.readFile(path);
      expect(saved).toContain('::: {#fig-results}');
      expect(saved).toContain(':::');
      expect(saved).toContain('{{< include other.qmd >}}');
      expect(saved).toContain('@sec-methods');
      expect(saved).toContain('# Results {#sec-results .deo-section}');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
  }, 20000);
});
