// @vitest-environment jsdom
/**
 * Publication details editor tests: license combobox presets and free
 * text, the date/copyright/funding fields and the all-or-none subject
 * group, all writing to _frontmatter.yml through the metadata hook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { ArticleView } from './ArticleView';
import { useManuscriptMetadata } from './use-manuscript-metadata';

const ROOT = 'manuscripts/x';
const FRONTMATTER = '# citation settings\ncustom: 1\ntitle: "Deep Dive"\n';

/** The article view wired to the manuscript metadata hook. */
function TestPanel({ ws }: { ws: WorkspaceAdapter }) {
  const meta = useManuscriptMetadata(ws, ROOT);
  return (
    <ArticleView
      title={meta.title}
      authors={[]}
      frontmatter={meta.frontmatter}
      setTitle={meta.setTitle}
      setFrontmatterField={meta.setFrontmatterField}
    />
  );
}

/** Seed a memory workspace with the fixture frontmatter and render it. */
async function boot(): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(`${ROOT}/_frontmatter.yml`, FRONTMATTER);
  render(<TestPanel ws={ws} />);
  await act(async () => {});
  fireEvent.click(screen.getByTestId('publication-details-toggle'));
  return ws;
}

/** Parsed frontmatter currently written to _frontmatter.yml. */
async function readFrontmatter(ws: WorkspaceAdapter): Promise<Record<string, unknown>> {
  const text = await ws.readFile(`${ROOT}/_frontmatter.yml`);
  return parse(text ?? '') as Record<string, unknown>;
}

/** Run the 800ms autosave debounce so pending edits hit the file. */
async function flushWrites(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(800); });
}

/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/**
 * Install a `window.matchMedia` stub matching the shared breakpoint
 * queries against a simulated viewport width.
 *
 * @param width - Simulated viewport width in pixels.
 */
function stubMatchMedia(width: number): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string): MediaQueryList => ({
      media,
      matches: media.includes('max-width')
        ? width <= Number(/max-width: (\d+)/.exec(media)?.[1])
        : width >= Number(/min-width: (\d+)/.exec(media)?.[1]),
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList),
  });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  vi.useRealTimers();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('PublicationDetails license', () => {
  it('offers the four license presets in the combobox', async () => {
    await boot();
    const presets = screen.getAllByTestId('license-preset')
      .map((option) => option.getAttribute('value'));
    expect(presets).toEqual(['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC0']);
  });

  it("selecting 'CC BY 4.0' writes license 'CC BY 4.0' to _frontmatter.yml", async () => {
    const ws = await boot();
    fireEvent.change(screen.getByTestId('license-input'), { target: { value: 'CC BY 4.0' } });
    await flushWrites();
    expect((await readFrontmatter(ws)).license).toBe('CC BY 4.0');
  });

  it('writes a custom license verbatim', async () => {
    const ws = await boot();
    fireEvent.change(screen.getByTestId('license-input'), {
      target: { value: 'Custom CC-like 1.0' },
    });
    await flushWrites();
    expect((await readFrontmatter(ws)).license).toBe('Custom CC-like 1.0');
  });

  it('keeps unknown keys and comments when writing the license', async () => {
    const ws = await boot();
    fireEvent.change(screen.getByTestId('license-input'), { target: { value: 'CC0' } });
    await flushWrites();
    const text = await ws.readFile(`${ROOT}/_frontmatter.yml`);
    expect(text).toContain('# citation settings');
    expect((parse(text ?? '') as Record<string, unknown>).custom).toBe(1);
  });
});

describe('PublicationDetails scalar fields', () => {
  it('writes date, copyright and funding to _frontmatter.yml', async () => {
    const ws = await boot();
    fireEvent.change(screen.getByTestId('date-input'), { target: { value: '2024-06-01' } });
    fireEvent.change(screen.getByTestId('copyright-input'), {
      target: { value: 'Copyright 2024 Acme' },
    });
    fireEvent.change(screen.getByTestId('funding-input'), { target: { value: 'Grant A' } });
    await flushWrites();
    const fm = await readFrontmatter(ws);
    expect(fm.date).toBe('2024-06-01');
    expect(fm.copyright).toBe('Copyright 2024 Acme');
    expect(fm.funding).toBe('Grant A');
  });
});

describe('PublicationDetails subject', () => {
  it("label only shows 'authority and term required' and writes no subject", async () => {
    const ws = await boot();
    fireEvent.change(screen.getByTestId('subject-label'), {
      target: { value: 'Distributed scientific publication' },
    });
    await flushWrites();
    expect(screen.getByTestId('subject-error').textContent).toBe('authority and term required');
    expect((await readFrontmatter(ws)).subject).toBeUndefined();
  });

  it('writes subject {text, authority, term} when all three are set', async () => {
    const ws = await boot();
    fireEvent.change(screen.getByTestId('subject-authority'), {
      target: { value: 'http://www.w3.org/2004/02/skos/core#' },
    });
    fireEvent.change(screen.getByTestId('subject-term'), {
      target: { value: 'concept-distributed-scientific-publication' },
    });
    fireEvent.change(screen.getByTestId('subject-label'), {
      target: { value: 'Distributed scientific publication' },
    });
    expect(screen.queryByTestId('subject-error')).toBeNull();
    await flushWrites();
    expect((await readFrontmatter(ws)).subject).toEqual({
      text: 'Distributed scientific publication',
      authority: 'http://www.w3.org/2004/02/skos/core#',
      term: 'concept-distributed-scientific-publication',
    });
  });
});

describe('PublicationDetails responsive grid', () => {
  it('uses a two-column grid on the details container at 1280px', async () => {
    stubMatchMedia(1280);
    await boot();
    const content = screen.getByTestId('publication-details-content');
    expect(content.className).toContain('grid-cols-2');
  });

  it('stays a single column at 800px', async () => {
    stubMatchMedia(800);
    await boot();
    const content = screen.getByTestId('publication-details-content');
    expect(content.className).not.toContain('grid-cols-2');
  });
});
