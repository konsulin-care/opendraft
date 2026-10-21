// @vitest-environment jsdom
/**
 * Affiliation picker tests: registry suggestions listed first with
 * "used by N", debounced ROR v2 search only at >=5 characters with
 * stale-abort and cache reuse, registry ref reuse, Independent
 * researcher, manual create, shared-edit warning and the legacy inline
 * "Normalize to references" flow.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AffiliationPicker } from './AffiliationPicker';
import { clearRorCache } from './ror-client';
import type { AffiliationEntry } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** One raw v2 organization item. */
const ITEM = {
  id: 'https://ror.org/0116zj450',
  names: [{ value: 'University of Indonesia', types: ['ror_display'] }],
  addresses: [{ city: 'Depok' }],
  country: { country_code: 'ID' },
};
const PAYLOAD = { items: [ITEM] };
const UI: AffiliationEntry = { id: 'ui', name: 'University of Indonesia' };
const ROR_ENTRY = {
  id: 'university-of-indonesia', name: 'University of Indonesia',
  city: 'Depok', country: 'ID', ror: 'https://ror.org/0116zj450',
};

// One seed author without affiliations.
function author(extra: Record<string, unknown> = {}): MetadataAuthor {
  return { id: 'smith', name: { given: 'Alice', family: 'Smith' }, affiliations: [], ...extra };
}

// Fetch stub recording calls and returning the ROR payload.
function fetchStub(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => PAYLOAD }));
}

/** Seed registry/authors of one picker render. */
interface Seed {
  registry?: AffiliationEntry[];
  authors?: MetadataAuthor[];
}

// Render the picker over one seed and capture its apply callback.
function boot(seed: Seed = {}): { onApply: ReturnType<typeof vi.fn> } {
  const onApply = vi.fn();
  render(<AffiliationPicker registry={seed.registry ?? [UI]} authors={seed.authors ?? [author()]}
    authorIndex={0} onApply={onApply} />);
  return { onApply };
}

// Type into the search field and run the debounce plus fetch microtasks.
async function search(text: string, ms = 300): Promise<void> {
  fireEvent.change(screen.getByTestId('affiliation-search'), { target: { value: text } });
  await act(async () => { vi.advanceTimersByTime(ms); });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('fetch', fetchStub());
  void clearRorCache();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('never queries ROR below five characters', async () => {
  boot();
  await search('univ', 600);
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

it('queries ROR once after a 300ms debounce at five characters', async () => {
  boot();
  fireEvent.change(screen.getByTestId('affiliation-search'), { target: { value: 'univer' } });
  await act(async () => { vi.advanceTimersByTime(299); });
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0]?.[0])
    .toBe('https://api.ror.org/v2/organizations?query=univer');
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
});

it('aborts the stale query when a newer one is typed', async () => {
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  boot();
  await search('univer');
  const stale = vi.mocked(fetch).mock.calls[0]?.[1]?.signal as AbortSignal;
  fireEvent.change(screen.getByTestId('affiliation-search'), { target: { value: 'univers' } });
  expect(stale.aborted).toBe(true);
});

it('serves a repeated query from the cache', async () => {
  boot();
  await search('univer');
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  await search('', 600);
  await search('univer');
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('affiliation-ror-item-0')).toBeTruthy();
});

it('lists registry suggestions before ROR results', async () => {
  boot();
  await search('univer');
  const registryRow = screen.getByTestId('affiliation-registry-item-0');
  const rorRow = screen.getByTestId('affiliation-ror-item-0');
  expect(registryRow.textContent).toContain('used by 0');
  expect(registryRow.compareDocumentPosition(rorRow) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
});

it('adds a registry entry and author ref for a picked ROR result', async () => {
  const { onApply } = boot();
  await search('univer');
  fireEvent.click(screen.getByTestId('affiliation-ror-item-0'));
  expect(onApply).toHaveBeenCalledWith({
    registry: [UI, ROR_ENTRY],
    authors: [{ ...author(), affiliations: [{ ref: 'university-of-indonesia' }] }],
  });
});

it('reuses an existing registry entry with a ref only', () => {
  const { onApply } = boot();
  fireEvent.click(screen.getByTestId('affiliation-registry-item-0'));
  expect(onApply).toHaveBeenCalledWith({
    authors: [{ ...author(), affiliations: [{ ref: 'ui' }] }],
  });
  expect(onApply.mock.calls[0]?.[0].registry).toBeUndefined();
});

it('warns when the edited affiliation is shared by two authors', () => {
  boot({
    registry: [UI],
    authors: [author({ affiliations: [{ ref: 'ui' }] }), author({ id: 'lee', affiliations: [{ ref: 'ui' }] })],
  });
  fireEvent.click(screen.getByTestId('affiliation-edit-0'));
  expect(screen.getByTestId('affiliation-shared-warning').textContent)
    .toContain('Shared by 2 authors');
});

it('adds the built-in Independent researcher entry', () => {
  const { onApply } = boot({ registry: [] });
  fireEvent.click(screen.getByTestId('affiliation-independent'));
  expect(onApply).toHaveBeenCalledWith({
    registry: [{ id: 'independent', name: 'Independent researcher' }],
    authors: [{ ...author(), affiliations: [{ ref: 'independent' }] }],
  });
});

it('creates a registry entry from the manual form', () => {
  const { onApply } = boot({ registry: [] });
  fireEvent.click(screen.getByTestId('affiliation-create-manual'));
  fireEvent.change(screen.getByTestId('affiliation-manual-name'),
    { target: { value: 'Gadjah Mada University' } });
  fireEvent.click(screen.getByTestId('affiliation-manual-save'));
  expect(onApply).toHaveBeenCalledWith({
    registry: [{ id: 'gadjah-mada-university', name: 'Gadjah Mada University' }],
    authors: [{ ...author(), affiliations: [{ ref: 'gadjah-mada-university' }] }],
  });
});

it('normalizes legacy inline affiliations to registry refs', () => {
  const { onApply } = boot({
    registry: [],
    authors: [author({ affiliations: [{ name: 'Old Institute', city: 'Depok' }] })],
  });
  fireEvent.click(screen.getByTestId('affiliation-normalize'));
  expect(onApply).toHaveBeenCalledWith({
    registry: [{ name: 'Old Institute', city: 'Depok', id: 'old-institute' }],
    authors: [{ ...author(), affiliations: [{ ref: 'old-institute' }] }],
  });
});
