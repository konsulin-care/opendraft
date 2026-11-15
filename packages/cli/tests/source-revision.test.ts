import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { sourceRevision } from '../src/source-revision';

it('returns HEAD sha when clean, undefined when dirty', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sr-'));
  const git = (...a: string[]) => execFileSync('git', a, { cwd: dir });
  git('init', '-q');
  git('config', 'user.email', 't@e.st');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, 'a.txt'), '1');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  expect(await sourceRevision(dir)).toMatch(/^[0-9a-f]{40}$/);
  writeFileSync(join(dir, 'a.txt'), '2');
  expect(await sourceRevision(dir)).toBeUndefined();
});
