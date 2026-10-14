import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDoi, cleanupBibtex, normalizeDoi } from './doi-resolver';

describe('cleanupBibtex — formatting', () => {
  it('replaces en dashes with -- in pages field', () => {
    const input = '@article{test, pages={11\u201312}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('pages={11--12}');
  });

  it('escapes ampersands in fields', () => {
    const input = '@article{test, title={A & B}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('title={A \\& B}');
  });

  it('handles multiple ampersands', () => {
    const input = '@article{test, publisher={A & B & C}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('publisher={A \\& B \\& C}');
  });

  it('does not escape already escaped ampersands', () => {
    const input = '@article{test, title={A \\& B}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('title={A \\& B}');
    expect(result).not.toContain('title={A \\\\& B}');
  });
});

describe('cleanupBibtex — field removal', () => {
  it('removes url field', () => {
    const input = '@article{test, title={Test}, url={http://example.com}}';
    const result = cleanupBibtex(input);
    expect(result).not.toContain('url=');
    expect(result).toContain('title={Test}');
  });

  it('removes ISSN field', () => {
    const input = '@article{test, title={Test}, ISSN={1234-5678}}';
    const result = cleanupBibtex(input);
    expect(result).not.toContain('ISSN=');
    expect(result).toContain('title={Test}');
  });
});

describe('cleanupBibtex — citekey underscores', () => {
  it('strips underscores from citekeys', () => {
    const input = '@article{naeem_2023, title={Test}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('@article{naeem2023,');
    expect(result).not.toContain('naeem_2023');
  });

  it('strips underscores from citekeys with multiple underscores', () => {
    const input = '@article{smith_jones_2024, title={Test}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('@article{smithjones2024,');
  });

  it('does not strip underscores from field values', () => {
    const input = '@article{test, title={Some_thing}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('title={Some_thing}');
  });
});

describe('normalizeDoi', () => {
  it('returns bare DOI as-is', () => {
    expect(normalizeDoi('10.1177/16094069231205789')).toBe('10.1177/16094069231205789');
  });

  it('extracts DOI from https://doi.org/ URL', () => {
    expect(normalizeDoi('https://doi.org/10.1177/16094069231205789')).toBe('10.1177/16094069231205789');
  });

  it('extracts DOI from http://doi.org/ URL', () => {
    expect(normalizeDoi('http://doi.org/10.1177/16094069231205789')).toBe('10.1177/16094069231205789');
  });

  it('extracts DOI from arbitrary URL containing DOI', () => {
    expect(normalizeDoi('https://example.com/doi/full/10.1177/16094069231205789')).toBe('10.1177/16094069231205789');
  });

  it('strips trailing slash', () => {
    expect(normalizeDoi('10.1177/16094069231205789/')).toBe('10.1177/16094069231205789');
  });

  it('strips query parameters', () => {
    expect(normalizeDoi('https://doi.org/10.1177/16094069231205789?foo=bar')).toBe('10.1177/16094069231205789');
  });

  it('trims whitespace', () => {
    expect(normalizeDoi('  10.1177/16094069231205789  ')).toBe('10.1177/16094069231205789');
  });

  it('returns null for invalid input', () => {
    expect(normalizeDoi('not a doi')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeDoi('')).toBeNull();
  });
});

describe('resolveDoi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches BibTeX from doi.org', async () => {
    const inputBibtex = '@article{Test_2024, title={Test Article}, year={2024}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(inputBibtex),
    }));

    const result = await resolveDoi('10.1234/test');
    expect(result).toBe('@article{Test2024, title={Test Article}, year={2024}}');
    expect(fetch).toHaveBeenCalledWith('https://doi.org/10.1234/test', {
      headers: { 'Accept': 'application/x-bibtex' },
    });
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(resolveDoi('10.1234/invalid')).rejects.toThrow('DOI not found (404)');
  });

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(resolveDoi('10.1234/test')).rejects.toThrow('Network error');
  });

  it('applies cleanup to fetched BibTeX', async () => {
    const mockBibtex = '@article{Test_2024, title={A & B}, pages={1\u201310}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockBibtex),
    }));

    const result = await resolveDoi('10.1234/test');
    expect(result).toContain('title={A \\& B}');
    expect(result).toContain('pages={1--10}');
  });
});
