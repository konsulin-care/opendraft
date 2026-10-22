// @vitest-environment jsdom
/**
 * Publication details editor tests: the labeled grid with native date
 * input, the license radio group (recommended preset, plain-language
 * description, Other free text) and the subject group whose authority
 * and term sit behind a More disclosure. Every field persists through
 * the manuscript metadata hook into _frontmatter.yml.
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

/** Seed a memory workspace with the given frontmatter and render it. */
async function boot(fm = FRONTMATTER): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(`${ROOT}/_frontmatter.yml`, fm);
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

/** Open the More disclosure that reveals subject authority and term. */
function openSubjectMore(): void {
  fireEvent.click(screen.getByTestId('subject-more-toggle'));
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('PublicationDetails layout', () => {
  it('renders the section heading through the shared small-caps label', async () => {
    await boot();
    const toggle = screen.getByTestId('publication-details-toggle');
    expect(toggle.querySelector('[data-testid="section-label"]')).not.toBeNull();
  });

  it('lays the fields out as a labeled grid with a label column', async () => {
    await boot();
    const content = screen.getByTestId('publication-details-content');
    expect(content.className).toContain('grid-cols-');
    expect(screen.getByText('Date').tagName).toBe('LABEL');
    expect(screen.getByText('Copyright').tagName).toBe('LABEL');
    expect(screen.getByText('Funding').tagName).toBe('LABEL');
  });

  it('uses a native date input for the date field', async () => {
    await boot();
    expect((screen.getByTestId('date-input') as HTMLInputElement).type).toBe('date');
  });
});

describe('PublicationDetails license', () => {
  it('renders the four presets plus Other as radios, CC BY 4.0 recommended', async () => {
    await boot();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual([
      'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC0', 'Other',
    ]);
    const recommended = screen.getByTestId('license-preset-cc-by-4-0').closest('label');
    expect(recommended?.textContent).toContain('Recommended');
  });

  it("selecting 'CC0' writes license 'CC0' and shows its one-sentence description", async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('license-preset-cc0'));
    await flushWrites();
    expect((await readFrontmatter(ws)).license).toBe('CC0');
    expect(screen.getByTestId('license-description').textContent).toBe(
      'Dedicate the work to the public domain with no conditions.',
    );
  });

  it("selecting 'Other' reveals the free-text license input", async () => {
    const ws = await boot();
    expect(screen.queryByTestId('license-input')).toBeNull();
    fireEvent.click(screen.getByTestId('license-other'));
    const input = screen.getByTestId('license-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Custom CC-like 1.0' } });
    await flushWrites();
    expect((await readFrontmatter(ws)).license).toBe('Custom CC-like 1.0');
  });

  it('keeps unknown keys and comments when writing the license', async () => {
    const ws = await boot();
    fireEvent.click(screen.getByTestId('license-preset-cc-by-sa-4-0'));
    await flushWrites();
    const text = await ws.readFile(`${ROOT}/_frontmatter.yml`);
    expect(text).toContain('# citation settings');
    expect((parse(text ?? '') as Record<string, unknown>).custom).toBe(1);
  });

  it('preselects Other for a custom license already in the frontmatter', async () => {
    await boot('title: "Deep Dive"\nlicense: "Custom Legacy 1.0"\n');
    expect((screen.getByTestId('license-other') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('license-input') as HTMLInputElement).value)
      .toBe('Custom Legacy 1.0');
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
  it('hides authority and term until the More disclosure opens', async () => {
    await boot();
    expect(screen.getByTestId('subject-label')).toBeDefined();
    expect(screen.queryByTestId('subject-authority')).toBeNull();
    expect(screen.queryByTestId('subject-term')).toBeNull();
    openSubjectMore();
    expect(screen.getByTestId('subject-authority')).toBeDefined();
    expect(screen.getByTestId('subject-term')).toBeDefined();
  });

  it("label only shows 'authority and term required' and writes no subject", async () => {
    const ws = await boot();
    openSubjectMore();
    fireEvent.change(screen.getByTestId('subject-label'), {
      target: { value: 'Distributed scientific publication' },
    });
    await flushWrites();
    expect(screen.getByTestId('subject-error').textContent).toBe('authority and term required');
    expect((await readFrontmatter(ws)).subject).toBeUndefined();
  });

  it('writes subject {text, authority, term} when all three are set', async () => {
    const ws = await boot();
    openSubjectMore();
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
