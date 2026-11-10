// @vitest-environment jsdom
/**
 * BlockBody tests: typing persists the block file with its canonical
 * heading preserved (a class-less heading stays class-less, a file with
 * no leading heading earns the generic class on its first save),
 * mounting without edits performs no write, a loaded body carrying a
 * level-1 heading neither writes nor hides the header's warning badge,
 * and Quarto constructs (::: divs, {#fig-x} attributes, shortcodes and
 * @sec- references) survive load and save unchanged. The mount harness
 * lives in block-body-harness.ts so this file stays under 300 lines.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockBody } from './BlockBody';
import { BlockHeader, reportLoadedBody } from './BlockHeader';
import { requestFocusForShort } from '../caret-mode-switch';
import { createCitationPlugin } from '../citation/plugin';
import {
  DIR,
  SAVE_WINDOW_MS,
  installBlockBodyHarness,
  mountBody,
  uninstallBlockBodyHarness,
  waitForApi,
} from './block-body-harness';

vi.mock('../citation/plugin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../citation/plugin')>();
  return { ...actual, createCitationPlugin: vi.fn(actual.createCitationPlugin) };
});

beforeEach(installBlockBodyHarness);

afterEach(uninstallBlockBodyHarness);

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
      expect(saved).toContain('# Results {#sec-results .doco-section}');
    }, { timeout: SAVE_WINDOW_MS + 5000 });
  }, 20000);
});
