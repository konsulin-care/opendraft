// @vitest-environment jsdom
/**
 * BlockBody tests: typing persists the block file with its canonical
 * heading preserved, mounting without edits performs no write, a
 * loaded level-1 heading neither writes nor hides the warning badge,
 * Quarto constructs survive load and save, edits autosave to the file
 * named by the `file` prop, and the cross-reference index is wired into
 * the citation plugin and kept in sync on save.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockBody } from './BlockBody';
import { BlockHeader, reportLoadedBody } from './BlockHeader';
import { requestFocusForShort } from '../caret-mode-switch';
import type { EditorTestApi } from '../caret-mode-switch';
import { createCitationPlugin } from '../citation/plugin';
import type { CrossrefIndexHandle } from '../crossref/use-crossref-index';
import {
  DIR,
  SAVE_WINDOW_MS,
  installBlockBodyHarness,
  uninstallBlockBodyHarness,
} from './block-body-harness';

vi.mock('../citation/plugin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../citation/plugin')>();
  return { ...actual, createCitationPlugin: vi.fn(actual.createCitationPlugin) };
});

beforeEach(installBlockBodyHarness);
afterEach(uninstallBlockBodyHarness);
/** Editor APIs handed by locally mounted bodies, in order. */
let editorApis: EditorTestApi[] = [];
beforeEach(() => {
  editorApis = [];
});
/**
 * Resolve once a locally mounted body has wired its editor API;
 * returns the most recent API handed to `onEditorReady`.
 */
async function waitForApi(): Promise<EditorTestApi> {
  await waitFor(() => {
    expect(editorApis.length).toBeGreaterThan(0);
  }, { timeout: 10000 });
  return editorApis[editorApis.length - 1];
}
/**
 * Render a block body against a workspace seeded at `_methods.qmd`.
 *
 * @param body - Block file text, canonical heading included.
 * @param crossrefs - Optional cross-reference index handed to the body.
 * @returns The workspace, a write-count spy, and the seeded path.
 */
async function mountBody(body: string, crossrefs?: CrossrefIndexHandle) {
  const ws = new MemoryWorkspace();
  const path = `${DIR}/blocks/_methods.qmd`;
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
      crossrefs={crossrefs}
    />,
  );
  return { ws, writes, path };
}
describe('BlockBody autosave', () => {
  it('persists typing to the block file with the canonical heading preserved', async () => {
    const { ws, path } = await mountBody('# Methods {#sec-methods .deo-section}\nBody text.\n');
    const api = await waitForApi();
    await act(async () => {
      api.insertText(' Extra sentence.');
    });
    await waitFor(async () => {
      const saved = await ws.readFile(path);
      // The legacy generic '.deo-section' normalizes to '.doco-section' on save.
      expect(saved).toContain('# Methods {#sec-methods .doco-section}');
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
describe('BlockBody class-less save path', () => {
  it('keeps a heading with no class class-less when the body autosaves', async () => {
    const { ws, path } = await mountBody('# Methods {#sec-methods}\nBody text.\n');
    const api = await waitForApi();
    await act(async () => {
      api.insertText(' Extra sentence.');
    });
    await waitFor(async () => {
      const saved = await ws.readFile(path);
      expect(saved).toContain('Extra sentence.');
      expect(saved?.split('\n')[0]).toBe('# Methods {#sec-methods}');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
  }, 20000);
  it("gives a file with no leading heading the generic '.doco-section' class on its first save", async () => {
    const { ws, path } = await mountBody('Plain body text.\n');
    const api = await waitForApi();
    await act(async () => {
      api.insertText(' Extra sentence.');
    });
    await waitFor(async () => {
      const saved = await ws.readFile(path);
      expect(saved).toContain('Extra sentence.');
      expect(saved).toContain('# Methods {#sec-methods .doco-section}');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
  }, 20000);
});
describe('BlockBody citation bib path', () => {
  it('creates its editor with the shared citation bib path', async () => {
    vi.mocked(createCitationPlugin).mockClear();
    await mountBody('# Methods {#sec-methods .deo-section}\nBody text.\n');
    await waitForApi();
    const calls = vi.mocked(createCitationPlugin).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1][2]).toBe('manuscripts/references.bib');
  }, 20000);
  it('passes its crossrefs prop labels as the citation plugin getter', async () => {
    vi.mocked(createCitationPlugin).mockClear();
    const labels = [
      { id: 'sec-methods', kind: 'sec' as const, caption: 'Methods', file: '_methods.qmd' },
    ];
    const crossrefs: CrossrefIndexHandle = {
      getCrossrefs: () => labels,
      updateFile: () => undefined,
    };
    await mountBody('# Methods {#sec-methods .deo-section}\nBody text.\n', crossrefs);
    await waitForApi();
    const calls = vi.mocked(createCitationPlugin).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1][3]?.()).toEqual(labels);
  }, 20000);
  it('pushes the heading-joined block text into crossrefs under the block file name', async () => {
    const updateFile = vi.fn();
    const crossrefs: CrossrefIndexHandle = { getCrossrefs: () => [], updateFile };
    await mountBody('# Methods {#sec-methods .deo-section}\nBody text.\n', crossrefs);
    const api = await waitForApi();
    await act(async () => {
      api.insertText(' Extra sentence.');
    });
    await waitFor(() => {
      expect(updateFile).toHaveBeenCalled();
      const [file, text] = updateFile.mock.calls[updateFile.mock.calls.length - 1];
      expect(file).toBe('_methods.qmd');
      expect(text).toContain('# Methods');
      expect(text).toContain('Extra sentence.');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
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
    // mountBody's write count is a snapshot; count writes on the live spy.
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
    // Reset the shared per-short registry so the badge comes from this load.
    reportLoadedBody('methods', '## Level two');
    const ws = new MemoryWorkspace();
    await ws.writeFile(
      `${DIR}/blocks/_methods.qmd`,
      '# Methods {#sec-methods .deo-section}\n# Legacy H1\nBody text.',
    );
    render(
      <>
        <BlockHeader short="methods" title="Methods" collapsed={false} onToggle={() => undefined} wordCount={0} saveStatus="saved" />
        <BlockBody ws={ws} dir={DIR} short="methods" title="Methods" collapsed={false} />
      </>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('level-1-warning-badge')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 20000);
});

describe('BlockBody file prop', () => {
  it('autosaves edits to the file named by its file prop', async () => {
    const ws = new MemoryWorkspace();
    const path = `${DIR}/blocks/custom.qmd`;
    await ws.writeFile(path, '# Custom {#sec-custom .deo-section}\nBody text.\n');
    render(
      <BlockBody
        ws={ws}
        dir={DIR}
        short="methods"
        file="custom.qmd"
        title="Methods"
        collapsed={false}
        onEditorReady={(api) => editorApis.push(api)}
      />,
    );
    const api = await waitForApi();
    await act(async () => {
      api.insertText(' Extra sentence.');
    });
    await waitFor(async () => {
      const saved = await ws.readFile(path);
      expect(saved).toContain('Extra sentence.');
      expect(saved).toContain('# Custom {#sec-custom .doco-section}');
      // Nothing lands on the derived default file name.
      expect(await ws.readFile(`${DIR}/blocks/_methods.qmd`)).toBeNull();
    }, { timeout: SAVE_WINDOW_MS + 5000 });
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
      expect(saved).toContain('# Results {#sec-results .doco-section}');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
  }, 20000);
});
