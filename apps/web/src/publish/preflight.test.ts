import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateProject } from '@opendraft/validate';
import { IndexedDbProtocolCache } from '../project/protocol-cache';
import { preflight } from './preflight';

vi.mock('@opendraft/validate', () => ({ validateProject: vi.fn() }));
vi.mock('../project/protocol-cache', () => ({ IndexedDbProtocolCache: class {} }));

const workspace = new MemoryWorkspace();
const finding = (
  level: 'error' | 'warning' | 'info',
  message: string,
) => ({ level, location: 'manuscripts/demo', path: 'article.qmd', message });

describe('preflight findings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops info findings and returns errors and warnings separately', async () => {
    vi.mocked(validateProject).mockResolvedValue([
      finding('error', 'bad assembly'),
      finding('warning', 'missing doi'),
      finding('info', 'helpful hint'),
    ]);

    const result = await preflight(workspace);

    expect(result.errors).toEqual([finding('error', 'bad assembly')]);
    expect(result.warnings).toEqual([finding('warning', 'missing doi')]);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it('is not ok when any error finding exists', async () => {
    vi.mocked(validateProject).mockResolvedValue([
      finding('warning', 'missing doi'),
      finding('error', 'bad assembly'),
    ]);

    const result = await preflight(workspace);

    expect(result.ok).toBe(false);
  });

  it('is ok when only warnings and info are reported', async () => {
    vi.mocked(validateProject).mockResolvedValue([
      finding('warning', 'missing doi'),
      finding('info', 'helpful hint'),
    ]);

    const result = await preflight(workspace);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('preflight options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the protocol cache and fetch to validateProject', async () => {
    vi.mocked(validateProject).mockResolvedValue([]);

    await preflight(workspace, { offline: true });

    expect(validateProject).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        offline: true,
        cache: expect.any(IndexedDbProtocolCache),
        fetch: expect.any(Function),
      }),
    );
  });
});
