import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDoi, cleanupBibtex } from './doi-resolver';

describe('cleanupBibtex', () => {
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

  it('handles multiple ampersands', () => {
    const input = '@article{test, publisher={A & B & C}}';
    const result = cleanupBibtex(input);
    expect(result).toContain('publisher={A \\& B \\& C}');
  });

  it('does not escape already escaped ampersands', () => {
    const input = '@article{test, title={A \\& B}}';
    const result = cleanupBibtex(input);
    // Should not double-escape
    expect(result).toContain('title={A \\& B}');
    expect(result).not.toContain('title={A \\\\& B}');
  });
});

describe('resolveDoi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches BibTeX from doi.org', async () => {
    const mockBibtex = '@article{Test_2024, title={Test Article}, year={2024}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockBibtex),
    }));

    const result = await resolveDoi('10.1234/test');
    expect(result).toBe(mockBibtex);
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
