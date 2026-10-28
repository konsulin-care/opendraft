import { describe, it, expect } from 'vitest';
import { normalizeOrcid, normalizeRor, normalizeDoi } from '../src/rdf/identifiers.js';

describe('normalizeOrcid', () => {
  it('canonicalizes a resolver URL to https IRI and hyphenated value', () => {
    expect(normalizeOrcid('https://orcid.org/0000000218250097')).toEqual({
      iri: 'https://orcid.org/0000-0002-1825-0097',
      value: '0000-0002-1825-0097',
    });
  });

  it('accepts bare and hyphenated forms', () => {
    expect(normalizeOrcid('0000-0002-1825-0097')).toEqual({
      iri: 'https://orcid.org/0000-0002-1825-0097',
      value: '0000-0002-1825-0097',
    });
    expect(normalizeOrcid('http://www.orcid.org/0000000218250097')?.value).toBe(
      '0000-0002-1825-0097',
    );
  });

  it('rejects a checksum-invalid ORCID', () => {
    expect(normalizeOrcid('0000-0002-1825-0098')).toBeNull();
    expect(normalizeOrcid('0000000218250098')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(normalizeOrcid('')).toBeNull();
    expect(normalizeOrcid('not-an-orcid')).toBeNull();
    expect(normalizeOrcid('0000-0002-1825-009')).toBeNull();
  });
});

describe('normalizeRor', () => {
  it('canonicalizes a bare ROR id', () => {
    expect(normalizeRor('0116zj450')).toBe('https://ror.org/0116zj450');
  });

  it('strips resolver prefix, scheme and trailing slash', () => {
    expect(normalizeRor('http://www.ror.org/0116zj450/')).toBe('https://ror.org/0116zj450');
    expect(normalizeRor('https://ror.org/0116zj450')).toBe('https://ror.org/0116zj450');
  });

  it('rejects invalid ids', () => {
    expect(normalizeRor('')).toBeNull();
    expect(normalizeRor('short')).toBeNull();
    expect(normalizeRor('https://example.org/0116zj450')).toBeNull();
  });
});

describe('normalizeDoi', () => {
  it('lowercases and strips the resolver prefix', () => {
    expect(normalizeDoi('https://doi.org/10.5555/ABC')).toEqual({
      iri: 'https://doi.org/10.5555/abc',
      value: '10.5555/abc',
    });
  });

  it('accepts bare and doi: forms', () => {
    expect(normalizeDoi('10.5555/abc')?.iri).toBe('https://doi.org/10.5555/abc');
    expect(normalizeDoi('doi:10.5555/ABC')?.value).toBe('10.5555/abc');
    expect(normalizeDoi('http://dx.doi.org/10.5555/ABC')?.value).toBe('10.5555/abc');
  });

  it('rejects non-DOI input', () => {
    expect(normalizeDoi('')).toBeNull();
    expect(normalizeDoi('not-a-doi')).toBeNull();
    expect(normalizeDoi('https://example.com/10.5555/abc')).toBeNull();
  });
});
