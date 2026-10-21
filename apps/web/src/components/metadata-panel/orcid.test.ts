// @vitest-environment jsdom
/**
 * ORCID field tests: URL stripping and auto-hyphenation, checksum
 * validation with invalid values never written to YAML, the confirmed
 * Fill from ORCID name lookup and the silent fallback on network errors.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { ArticleView } from './ArticleView';
import { useManuscriptMetadata } from './use-manuscript-metadata';
import { fetchOrcidNames, formatOrcidInput, normalizeOrcid } from './orcid';

const ROOT = 'manuscripts/x';
const AUTHOR_YML = `# author registry
affiliations:
  - id: ui
    name: University of Indonesia
authors:
  - id: smith
    name:
      given: Alice Marie
      family: Smith
    affiliations:
      - ref: ui
`;

// The article view wired to the manuscript metadata hook.
function TestPanel(props: { ws: WorkspaceAdapter }): ReactNode {
  const meta = useManuscriptMetadata(props.ws, ROOT);
  return createElement(ArticleView, {
    title: meta.title,
    authors: meta.authors,
    setTitle: meta.setTitle,
    setAuthors: meta.setAuthors,
    setAbstract: meta.setAbstract,
    abstract: meta.abstract ?? '',
  });
}

// Seed the workspace, render the panel and open the authors dialog.
async function boot(): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(`${ROOT}/_frontmatter.yml`, 'title: "Deep Dive"\n');
  await ws.writeFile(`${ROOT}/_author.yml`, AUTHOR_YML);
  render(createElement(TestPanel, { ws }));
  await act(async () => {});
  fireEvent.click(screen.getByTestId('byline-author-0'));
  return ws;
}

// Parsed authors currently written to _author.yml.
async function readAuthors(ws: WorkspaceAdapter): Promise<Record<string, unknown>[]> {
  const text = await ws.readFile(`${ROOT}/_author.yml`);
  return ((parse(text ?? '') as { authors?: Record<string, unknown>[] }).authors) ?? [];
}

// Run the 800ms autosave debounce so pending edits hit the file.
async function flushWrites(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(800); });
}

// The ORCID person record payload served by the mocked fetch.
const PERSON_PAYLOAD = {
  name: { givenNames: { value: 'Josiah' }, familyName: { value: 'Carberry' } },
};

// Type into the ORCID field of the open card.
async function typeOrcid(value: string): Promise<void> {
  await act(async () => {
    fireEvent.change(screen.getByTestId('author-orcid'), { target: { value } });
  });
}

// Click "Fill from ORCID" and settle the fetch promise chain.
async function fillFromOrcid(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId('author-orcid-fill'));
  });
  await act(async () => {});
}

// Mock fetch serving (or rejecting) the ORCID person record.
function stubFetch(reject = false): ReturnType<typeof vi.fn> {
  const fetchMock = reject
    ? vi.fn().mockRejectedValue(new Error('offline'))
    : vi.fn().mockResolvedValue({ ok: true, json: async () => PERSON_PAYLOAD });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ORCID normalization', () => {
  it("normalizeOrcid('https://orcid.org/0000000218250097') -> '0000-0002-1825-0097'", () => {
    expect(normalizeOrcid('https://orcid.org/0000000218250097')).toBe('0000-0002-1825-0097');
  });

  it('a checksum-invalid or incomplete iD normalizes to null', () => {
    expect(normalizeOrcid('0000-0002-1825-0098')).toBeNull();
    expect(normalizeOrcid('0000-0002-1825')).toBeNull();
  });

  it('formatOrcidInput hyphenates as the user types', () => {
    expect(formatOrcidInput('00000002182')).toBe('0000-0002-182');
    expect(formatOrcidInput('000000021825')).toBe('0000-0002-1825');
  });
});

describe('fetchOrcidNames', () => {
  it('reads given/family from the person record', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => PERSON_PAYLOAD });
    await expect(fetchOrcidNames('0000-0002-1825-0097', fetchFn as typeof fetch))
      .resolves.toEqual({ given: 'Josiah', family: 'Carberry' });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://pub.orcid.org/v3.0/0000-0002-1825-0097/person',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns null on rejected or non-ok responses', async () => {
    const offline = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchOrcidNames('0000-0002-1825-0097', offline as typeof fetch)).resolves.toBeNull();
    const missing = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchOrcidNames('0000-0002-1825-0097', missing as typeof fetch)).resolves.toBeNull();
  });
});

describe('ORCID field input', () => {
  it("input 'https://orcid.org/0000000218250097' displays '0000-0002-1825-0097' and is written", async () => {
    const ws = await boot();
    await typeOrcid('https://orcid.org/0000000218250097');
    expect(screen.getByTestId('author-orcid')).toHaveProperty('value', '0000-0002-1825-0097');
    expect(screen.queryByTestId('author-orcid-error')).toBeNull();
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors[0]['orcid']).toBe('0000-0002-1825-0097');
  });

  it("'0000-0002-1825-0098' shows an error and leaves YAML unchanged", async () => {
    const ws = await boot();
    await typeOrcid('0000-0002-1825-0098');
    expect(screen.getByTestId('author-orcid-error')).toBeDefined();
    expect(screen.queryByTestId('author-orcid-fill')).toBeNull();
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors[0]).not.toHaveProperty('orcid');
  });
});

describe('Fill from ORCID', () => {
  it('writes given/family after the user accepts the confirm', async () => {
    const ws = await boot();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    stubFetch();
    await typeOrcid('https://orcid.org/0000000218250097');
    await fillFromOrcid();
    expect(confirm).toHaveBeenCalledWith('Use Josiah Carberry from this ORCID record?');
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors[0]['name']).toEqual({ given: 'Josiah', family: 'Carberry' });
    expect(authors[0]['orcid']).toBe('0000-0002-1825-0097');
  });

  it('cancel leaves the typed name in place and writes nothing', async () => {
    const ws = await boot();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    stubFetch();
    await typeOrcid('https://orcid.org/0000000218250097');
    await fillFromOrcid();
    expect(screen.getByTestId('author-family')).toHaveProperty('value', 'Smith');
    await flushWrites();
    const authors = await readAuthors(ws);
    expect(authors[0]['name']).toEqual({ given: 'Alice Marie', family: 'Smith' });
  });

  it('a rejected fetch shows no error toast and keeps fields editable', async () => {
    const ws = await boot();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    stubFetch(true);
    await typeOrcid('https://orcid.org/0000000218250097');
    await fillFromOrcid();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByTestId('author-orcid-error')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    const family = screen.getByTestId('author-family') as HTMLInputElement;
    expect(family.disabled).toBe(false);
    fireEvent.change(family, { target: { value: 'Smith Jr' } });
    await flushWrites();
    const authors = await readAuthors(ws);
    expect((authors[0]['name'] as Record<string, unknown>)['family']).toBe('Smith Jr');
  });
});
