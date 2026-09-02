import { describe, it, expect } from 'vitest';
import { validateOpendraft } from '../src/opendraft.js';

const validConfig = {
  protocol: {
    name: 'opendraft',
    version: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
    repository: 'https://github.com/konsulin-care/opendraft',
    commit: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
  },
  manuscripts: [],
};

describe('validateOpendraft — valid configs', () => {
  it('accepts a valid config with empty manuscripts', () => {
    const result = validateOpendraft(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a config with manuscripts', () => {
    const config = {
      ...validConfig,
      manuscripts: [{ id: 'my-article', path: 'manuscripts/my-article' }],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(true);
  });

  it('tolerates unknown fields at root', () => {
    const config = { ...validConfig, unknown: 'field' };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(true);
  });

  it('tolerates unknown fields in protocol block', () => {
    const config = {
      protocol: { ...validConfig.protocol, extra: 42 },
      manuscripts: [],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(true);
  });
});

describe('validateOpendraft — invalid input', () => {
  it('rejects null input', () => {
    const result = validateOpendraft(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects missing protocol block', () => {
    const result = validateOpendraft({ manuscripts: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'protocol')).toBe(true);
  });
});

describe('validateOpendraft — protocol field validation', () => {
  it('rejects invalid protocol.name', () => {
    const config = {
      protocol: { ...validConfig.protocol, name: 'wrong' },
      manuscripts: [],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('name'))).toBe(true);
  });

  it('rejects invalid version format (not 40-char hex)', () => {
    const config = {
      protocol: { ...validConfig.protocol, version: 'not-a-sha' },
      manuscripts: [],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('version'))).toBe(true);
  });

  it('rejects invalid commit format (not 40-char hex)', () => {
    const config = {
      protocol: { ...validConfig.protocol, commit: 'short' },
      manuscripts: [],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('commit'))).toBe(true);
  });

  it('rejects invalid repository URL', () => {
    const config = {
      protocol: { ...validConfig.protocol, repository: 'not-a-url' },
      manuscripts: [],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('repository'))).toBe(true);
  });
});

describe('validateOpendraft — manuscript validation', () => {
  it('rejects manuscripts with missing id', () => {
    const config = {
      ...validConfig,
      manuscripts: [{ path: 'manuscripts/x' }],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('id'))).toBe(true);
  });

  it('rejects manuscripts with missing path', () => {
    const config = {
      ...validConfig,
      manuscripts: [{ id: 'x' }],
    };
    const result = validateOpendraft(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('path'))).toBe(true);
  });
});
