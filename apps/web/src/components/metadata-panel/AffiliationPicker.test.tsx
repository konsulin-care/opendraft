// @vitest-environment jsdom
/**
 * Affiliation picker tests: ROR search, the multi-select listbox with
 * in-use suggestions, removable selected chips with orphan pruning,
 * the independent checkbox, manual create, shared-edit warning and
 * legacy "Normalize to references".
 */
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AffiliationPicker } from './AffiliationPicker';
import { clearRorCache } from './ror-client';
import type { AffiliationEntry } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** One raw v2 organization item. */
const ROR = 'https://ror.org/0116zj450';
const ITEM = { id: ROR, names: [{ value: 'University of Indonesia', types: ['ror_display'] }],
  addresses: [{ city: 'Depok' }], country: { country_code: 'ID' } };
const PAYLOAD = { items: [ITEM] };
const UI: AffiliationEntry = { id: 'ui', name: 'University of Indonesia' };
const ROR_ENTRY = { id: 'university-of-indonesia', name: 'University of Indonesia',
  city: 'Depok', country: 'ID', ror: ROR };
const INDEPENDENT: AffiliationEntry = { id: 'independent', name: 'Independent researcher' };

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

// Stateful harness feeding each applied change back into the picker.
function multiBoot(seed: Seed = {}): { onApply: ReturnType<typeof vi.fn> } {
  const onApply = vi.fn();
  const Harness = (): ReactNode => {
    const [registry, setRegistry] = useState<AffiliationEntry[]>(seed.registry ?? [UI]);
    const [authors, setAuthors] = useState<MetadataAuthor[]>(seed.authors ?? [author()]);
    onApply.mockImplementation((change: { registry?: AffiliationEntry[]; authors?: MetadataAuthor[] }) => {
      if (change.registry) setRegistry(change.registry); if (change.authors) setAuthors(change.authors);
    });
    return <AffiliationPicker registry={registry} authors={authors} authorIndex={0} onApply={onApply} />;
  };
  render(<Harness />);
  return { onApply };
}

// Type into the search field and run the debounce plus fetch microtasks.
async function search(text: string, ms = 300): Promise<void> {
  fireEvent.change(screen.getByTestId('affiliation-search'), { target: { value: text } });
  await act(async () => { vi.advanceTimersByTime(ms); });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('fetch', fetchStub()); void clearRorCache();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('never queries ROR below five characters', async () => {
  boot(); await search('univ', 600); expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

it('queries ROR once after a 300ms debounce at five characters', async () => {
  boot(); fireEvent.change(screen.getByTestId('affiliation-search'), { target: { value: 'univer' } });
  await act(async () => { vi.advanceTimersByTime(299); }); expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(1); }); expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://api.ror.org/v2/organizations?query=univer');
  await act(async () => { vi.advanceTimersByTime(1000); }); expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
});

it('aborts the stale query when a newer one is typed', async () => {
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  boot(); await search('univer');
  const stale = vi.mocked(fetch).mock.calls[0]?.[1]?.signal as AbortSignal;
  fireEvent.change(screen.getByTestId('affiliation-search'), { target: { value: 'univers' } }); expect(stale.aborted).toBe(true);
});

it('serves a repeated query from the cache', async () => {
  boot(); await search('univer'); expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  await search('', 600); await search('univer'); expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('affiliation-ror-item-0')).toBeTruthy();
});

it('lists registry suggestions before ROR results', async () => {
  boot(); await search('univer');
  const listbox = screen.getByTestId('affiliation-listbox'); const registryRow = screen.getByTestId('affiliation-registry-item-0'); const rorRow = screen.getByTestId('affiliation-ror-item-0');
  expect(listbox.contains(registryRow)).toBe(true); expect(listbox.contains(rorRow)).toBe(true);
  expect(registryRow.textContent).toContain('used by 0');
  expect(registryRow.compareDocumentPosition(rorRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('shows no listbox before the search field is focused', () => {
  boot(); expect(screen.queryByTestId('affiliation-listbox')).toBeNull();
});

it('adds a registry entry and author ref for a picked ROR result', async () => {
  const { onApply } = boot();
  await search('univer');
  fireEvent.click(screen.getByTestId('affiliation-ror-item-0'));
  expect(onApply).toHaveBeenCalledWith({ registry: [UI, ROR_ENTRY], authors: [{ ...author(), affiliations: [{ ref: 'university-of-indonesia' }] }] });
  expect((screen.getByTestId('affiliation-search') as HTMLInputElement).value).toBe(''); expect(screen.getByTestId('affiliation-listbox')).toBeTruthy();
});

it('closes the listbox on Escape and clears the query', async () => {
  boot(); await search('univer'); fireEvent.keyDown(screen.getByTestId('affiliation-search'), { key: 'Escape' });
  expect(screen.queryByTestId('affiliation-listbox')).toBeNull(); expect((screen.getByTestId('affiliation-search') as HTMLInputElement).value).toBe('');
});

it('closes the listbox on an outside mousedown and clears the query', async () => {
  boot(); await search('univer'); fireEvent.mouseDown(document.body);
  expect(screen.queryByTestId('affiliation-listbox')).toBeNull(); expect((screen.getByTestId('affiliation-search') as HTMLInputElement).value).toBe('');
});

it('reuses an existing registry entry with a ref only', async () => {
  const { onApply } = boot();
  await search('univ');
  fireEvent.click(screen.getByTestId('affiliation-registry-item-0'));
  expect(onApply).toHaveBeenCalledWith({ authors: [{ ...author(), affiliations: [{ ref: 'ui' }] }] });
  expect(onApply.mock.calls[0]?.[0].registry).toBeUndefined();
});

it('warns when the edited affiliation is shared by two authors', async () => {
  boot({ registry: [UI], authors: [author({ affiliations: [{ ref: 'ui' }] }), author({ id: 'lee', affiliations: [{ ref: 'ui' }] })] });
  await search('univ');
  fireEvent.click(screen.getByTestId('affiliation-edit-0'));
  expect(screen.getByTestId('affiliation-shared-warning').textContent).toContain('Shared by 2 authors');
});

it('adds the built-in Independent researcher entry via the checkbox', () => {
  const { onApply } = boot({ registry: [] });
  fireEvent.click(screen.getByTestId('affiliation-independent'));
  expect(onApply).toHaveBeenCalledWith({ registry: [{ id: 'independent', name: 'Independent researcher' }], authors: [{ ...author(), affiliations: [{ ref: 'independent' }] }] });
});

it('keeps the independent checkbox outside the listbox while shown', async () => {
  boot({ registry: [] }); const checkbox = screen.getByTestId('affiliation-independent');
  expect(checkbox.getAttribute('type')).toBe('checkbox');
  await search('univ');
  expect(screen.getByTestId('affiliation-listbox').contains(checkbox)).toBe(false);
});

it('hides the independent checkbox once the author has an affiliation', () => {
  boot({ registry: [UI], authors: [author({ affiliations: [{ ref: 'ui' }] })] }); expect(screen.queryByTestId('affiliation-independent')).toBeNull();
});

it('keeps create-manual and normalize as footer actions outside the listbox', async () => {
  boot({ registry: [UI], authors: [author({ affiliations: [{ name: 'Old Institute' }] })] }); await search('univ');
  const listbox = screen.getByTestId('affiliation-listbox'); expect(listbox.contains(screen.getByTestId('affiliation-create-manual'))).toBe(false);
  expect(listbox.contains(screen.getByTestId('affiliation-normalize'))).toBe(false);
});

it('creates a registry entry from the manual form', () => {
  const { onApply } = boot({ registry: [] });
  fireEvent.click(screen.getByTestId('affiliation-create-manual'));
  fireEvent.change(screen.getByTestId('affiliation-manual-name'), { target: { value: 'Gadjah Mada University' } });
  fireEvent.click(screen.getByTestId('affiliation-manual-save'));
  expect(onApply).toHaveBeenCalledWith({ registry: [{ id: 'gadjah-mada-university', name: 'Gadjah Mada University' }], authors: [{ ...author(), affiliations: [{ ref: 'gadjah-mada-university' }] }] });
});

it('normalizes legacy inline affiliations to registry refs', () => {
  const { onApply } = boot({ registry: [], authors: [author({ affiliations: [{ name: 'Old Institute', city: 'Depok' }] })] });
  fireEvent.click(screen.getByTestId('affiliation-normalize'));
  expect(onApply).toHaveBeenCalledWith({ registry: [{ name: 'Old Institute', city: 'Depok', id: 'old-institute' }], authors: [{ ...author(), affiliations: [{ ref: 'old-institute' }] }] });
});

describe('AffiliationPicker multi-select', () => {
  it('adds the ref while the listbox stays open and marks the option selected', async () => {
    const { onApply } = multiBoot();
    await search('univ');
    fireEvent.click(screen.getByTestId('affiliation-registry-item-0'));
    expect(onApply).toHaveBeenCalledWith({ authors: [{ ...author(), affiliations: [{ ref: 'ui' }] }] });
    expect(screen.getByTestId('affiliation-listbox').getAttribute('aria-multiselectable')).toBe('true');
    expect((screen.getByTestId('affiliation-search') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('affiliation-registry-item-0').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('affiliation-check-0')).toBeTruthy();
  });

  it('clicking a selected option removes the ref but keeps a shared entry', async () => {
    const { onApply } = multiBoot({ registry: [UI], authors: [author({ affiliations: [{ ref: 'ui' }] }), author({ id: 'lee', affiliations: [{ ref: 'ui' }] })] });
    await search('univ');
    fireEvent.click(screen.getByTestId('affiliation-registry-item-0'));
    expect(onApply).toHaveBeenCalledWith({ authors: [{ ...author(), affiliations: [] }, author({ id: 'lee', affiliations: [{ ref: 'ui' }] })] });
    expect(screen.getByTestId('affiliation-registry-item-0').getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByTestId('affiliation-check-0')).toBeNull();
  });

  it('removing the last reference prunes the entry from the registry', async () => {
    const { onApply } = multiBoot({ registry: [UI], authors: [author({ affiliations: [{ ref: 'ui' }] })] });
    await search('univ'); fireEvent.click(screen.getByTestId('affiliation-registry-item-0'));
    expect(onApply).toHaveBeenCalledWith({ registry: [], authors: [{ ...author(), affiliations: [] }] });
  });

  it('lists the in-use registry entries when focused with an empty query', () => {
    multiBoot({ registry: [UI, { id: 'unused', name: 'Unused Institute' }], authors: [author({ affiliations: [{ ref: 'ui' }] })] });
    fireEvent.focus(screen.getByTestId('affiliation-search'));
    expect(screen.getByTestId('affiliation-listbox').textContent).toContain('University of Indonesia');
    expect(screen.queryByTestId('affiliation-registry-item-1')).toBeNull();
    expect(screen.getByTestId('affiliation-search').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('AffiliationPicker multi-select dismissal and ROR toggling', () => {
  it('closes the listbox on Escape with an empty query', () => {
    multiBoot();
    fireEvent.focus(screen.getByTestId('affiliation-search'));
    expect(screen.getByTestId('affiliation-listbox')).toBeTruthy();
    fireEvent.keyDown(screen.getByTestId('affiliation-search'), { key: 'Escape' });
    expect(screen.queryByTestId('affiliation-listbox')).toBeNull();
  });

  it('keeps the listbox open after a ROR pick and marks it selected', async () => {
    const { onApply } = multiBoot();
    await search('univer');
    fireEvent.click(screen.getByTestId('affiliation-ror-item-0'));
    expect(onApply).toHaveBeenCalledWith({ registry: [UI, ROR_ENTRY], authors: [{ ...author(), affiliations: [{ ref: 'university-of-indonesia' }] }] });
    expect((screen.getByTestId('affiliation-search') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('affiliation-ror-item-0').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('affiliation-registry-item-1').getAttribute('aria-selected')).toBe('true');
  });

  it('clicking a selected ROR option removes the ref and prunes its entry', async () => {
    const { onApply } = multiBoot({ registry: [UI, ROR_ENTRY], authors: [author({ affiliations: [{ ref: 'university-of-indonesia' }] })] });
    await search('univer');
    fireEvent.click(screen.getByTestId('affiliation-ror-item-0'));
    expect(onApply).toHaveBeenCalledWith({ registry: [UI], authors: [{ ...author(), affiliations: [] }] });
  });
});

describe('AffiliationPicker selected chips', () => {
  it('renders a chip per referenced entry below the combobox, never for independent', () => {
    multiBoot({ registry: [UI, INDEPENDENT], authors: [author({ affiliations: [{ ref: 'ui' }, { ref: 'independent' }] })] });
    const chip = screen.getByTestId('affiliation-chip-ui');
    expect(chip.textContent).toContain('University of Indonesia');
    expect(screen.getByTestId('affiliation-search').compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('affiliation-chip-independent')).toBeNull();
    expect(screen.getByTestId('affiliation-chip-remove-ui').getAttribute('aria-label')).toBe('Remove University of Indonesia');
  });
  it("clicking a chip's remove button drops the ref and prunes the orphaned entry", () => {
    const { onApply } = multiBoot({ registry: [UI], authors: [author({ affiliations: [{ ref: 'ui' }] })] });
    fireEvent.click(screen.getByLabelText('Remove University of Indonesia'));
    expect(onApply).toHaveBeenCalledWith({ registry: [], authors: [{ ...author(), affiliations: [] }] });
    expect(screen.queryByTestId('affiliation-chips')).toBeNull();
  });
  it('keeps a shared entry while another author still references it', () => {
    const { onApply } = multiBoot({ registry: [UI], authors: [author({ affiliations: [{ ref: 'ui' }] }), author({ id: 'lee', affiliations: [{ ref: 'ui' }] })] });
    fireEvent.click(screen.getByTestId('affiliation-chip-remove-ui'));
    expect(onApply).toHaveBeenCalledWith({ authors: [{ ...author(), affiliations: [] }, author({ id: 'lee', affiliations: [{ ref: 'ui' }] })] });
    expect(onApply.mock.calls[0]?.[0].registry).toBeUndefined(); expect(screen.queryByTestId('affiliation-chip-ui')).toBeNull();
  });
});

describe('AffiliationPicker independent researcher', () => {
  it('checking adds the ref, hides search and create-manual, and renders no chip', () => {
    const { onApply } = multiBoot({ registry: [] });
    fireEvent.click(screen.getByTestId('affiliation-independent'));
    expect(onApply).toHaveBeenCalledWith({ registry: [INDEPENDENT], authors: [{ ...author(), affiliations: [{ ref: 'independent' }] }] });
    expect((screen.getByTestId('affiliation-independent') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId('affiliation-search')).toBeNull();
    expect(screen.queryByTestId('affiliation-create-manual')).toBeNull();
    expect(screen.queryByTestId('affiliation-chips')).toBeNull();
  });
  it('unchecking removes the ref, prunes the entry and shows the controls again', () => {
    const { onApply } = multiBoot({ registry: [INDEPENDENT], authors: [author({ affiliations: [{ ref: 'independent' }] })] });
    expect((screen.getByTestId('affiliation-independent') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId('affiliation-search')).toBeNull();
    fireEvent.click(screen.getByTestId('affiliation-independent'));
    expect(onApply).toHaveBeenCalledWith({ registry: [], authors: [{ ...author(), affiliations: [] }] });
    expect(screen.getByTestId('affiliation-search')).toBeTruthy();
    expect(screen.getByTestId('affiliation-create-manual')).toBeTruthy();
    expect((screen.getByTestId('affiliation-independent') as HTMLInputElement).checked).toBe(false);
  });
  it('keeps a shared independent entry while another author references it', () => {
    const { onApply } = multiBoot({ registry: [INDEPENDENT], authors: [
      author({ affiliations: [{ ref: 'independent' }] }), author({ id: 'lee', affiliations: [{ ref: 'independent' }] })] });
    fireEvent.click(screen.getByTestId('affiliation-independent'));
    expect(onApply).toHaveBeenCalledWith({ authors: [
      { ...author(), affiliations: [] }, author({ id: 'lee', affiliations: [{ ref: 'independent' }] })] });
    expect(onApply.mock.calls[0]?.[0].registry).toBeUndefined();
  });
  it('styles the independent checkbox with accent-black', () => { boot({ registry: [] }); expect(screen.getByTestId('affiliation-independent').className.split(/\s+/)).toContain('accent-black'); });
});
