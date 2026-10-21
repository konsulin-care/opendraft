import { describe, it, expect } from 'vitest';
import { resolvePublishIdentity, normalizeRepositoryUrl } from '../src/publish-identity.js';

const REGISTERED = 'https://github.com/acme/paper';

describe('normalizeRepositoryUrl', () => {
  it('ignores trailing slash, .git suffix and http/https scheme', () => {
    const canonical = normalizeRepositoryUrl(REGISTERED);
    expect(normalizeRepositoryUrl('https://github.com/acme/paper/')).toBe(canonical);
    expect(normalizeRepositoryUrl('https://github.com/acme/paper.git')).toBe(canonical);
    expect(normalizeRepositoryUrl('http://github.com/acme/paper')).toBe(canonical);
    expect(normalizeRepositoryUrl('http://github.com/acme/paper.git/')).toBe(canonical);
  });
});

describe('resolvePublishIdentity — new work', () => {
  it('returns new-work when no concept-doi and URLs match modulo trivial differences', () => {
    const variants = [
      'https://github.com/acme/paper',
      'https://github.com/acme/paper/',
      'https://github.com/acme/paper.git',
      'http://github.com/acme/paper',
      'http://github.com/acme/paper.git/',
    ];
    for (const currentRepositoryUrl of variants) {
      expect(
        resolvePublishIdentity({ repository: REGISTERED, currentRepositoryUrl }),
      ).toEqual({ kind: 'new-work' });
    }
  });
});

describe('resolvePublishIdentity — new version', () => {
  it('returns new-version with the concept DOI when concept-doi present and URLs match', () => {
    const result = resolvePublishIdentity({
      repository: REGISTERED,
      currentRepositoryUrl: 'http://github.com/acme/paper.git',
      conceptDoi: '10.5555/od.v1',
      conceptDoiRepository: 'https://github.com/acme/paper',
    });
    expect(result).toEqual({ kind: 'new-version', conceptDoi: '10.5555/od.v1' });
  });

  it('returns new-version when concept-doi-repository is absent (pre-fork-rule data)', () => {
    const result = resolvePublishIdentity({
      repository: REGISTERED,
      currentRepositoryUrl: REGISTERED,
      conceptDoi: '10.5555/od.v1',
    });
    expect(result).toEqual({ kind: 'new-version', conceptDoi: '10.5555/od.v1' });
  });
});

describe('resolvePublishIdentity — repository mismatch', () => {
  it('returns repository-mismatch with both remedies when URLs differ', () => {
    const result = resolvePublishIdentity({
      repository: REGISTERED,
      currentRepositoryUrl: 'https://github.com/other/fork',
      conceptDoi: '10.5555/od.v1',
      conceptDoiRepository: REGISTERED,
    });
    expect(result).toEqual({
      kind: 'repository-mismatch',
      remedies: ['pull-request', 'publish-independently'],
    });
  });

  it('takes precedence over the integrity check for stale concept DOIs', () => {
    // Fork kept a concept DOI bound to the original repository while the
    // registered repository was never switched: report the mismatch first.
    const result = resolvePublishIdentity({
      repository: REGISTERED,
      currentRepositoryUrl: 'https://github.com/other/fork',
      conceptDoi: '10.5555/od.v1',
      conceptDoiRepository: 'https://github.com/old/home',
    });
    expect(result.kind).toBe('repository-mismatch');
  });
});

describe('resolvePublishIdentity — integrity error', () => {
  it('reports concept-doi-bound-to-other-repository when repository matches but concept-doi-repository differs', () => {
    const result = resolvePublishIdentity({
      repository: 'https://github.com/other/fork',
      currentRepositoryUrl: 'https://github.com/other/fork',
      conceptDoi: '10.5555/od.v1',
      conceptDoiRepository: REGISTERED,
    });
    expect(result).toEqual({
      kind: 'integrity-error',
      code: 'concept-doi-bound-to-other-repository',
    });
  });

  it('does not fire when concept-doi-repository matches modulo normalization', () => {
    const result = resolvePublishIdentity({
      repository: REGISTERED,
      currentRepositoryUrl: REGISTERED,
      conceptDoi: '10.5555/od.v1',
      conceptDoiRepository: 'http://github.com/acme/paper.git',
    });
    expect(result).toEqual({ kind: 'new-version', conceptDoi: '10.5555/od.v1' });
  });
});
