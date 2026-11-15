import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import history from '../../rdf/src/protocol-history.generated.json';
import { runCommand } from '../src/run.js';

describe('protocol upgrade', () => {
  it('rewrites the pin and keeps other keys and comments', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'od-up-'));
    writeFileSync(
      join(dir, 'opendraft.yml'),
      '# keep me\nname: x\nprotocol:\n  version: old\n  commit: old # c\n',
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runCommand(['protocol', 'upgrade', dir])).toBe(0);
    const out = readFileSync(join(dir, 'opendraft.yml'), 'utf8');
    expect(out).toContain('# keep me');
    expect(out).toContain('name: x');
    expect(out).toContain(`commit: ${history.latest}`);
    expect(out).toContain(`version: ${history.latest}`);
  });

  it('reports already up to date', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'od-up-'));
    writeFileSync(
      join(dir, 'opendraft.yml'),
      `protocol:\n  version: ${history.latest}\n  commit: ${history.latest}\n`,
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runCommand(['protocol', 'upgrade', dir])).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already up to date'));
  });
});
