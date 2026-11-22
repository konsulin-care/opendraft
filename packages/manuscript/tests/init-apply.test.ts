import { describe, expect, it } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import {
  InitError,
  OPENDRAFT_CONFIG_PATH,
  applyPlan,
} from '../src/index';
import type { InitPlan } from '../src/index';

describe('applyPlan', () => {
  it('writes the create and update ops of a plan', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(OPENDRAFT_CONFIG_PATH, 'protocol: {}\n');

    const plan: InitPlan = {
      files: [
        {
          path: 'manuscripts/case-series-review/_author.yml',
          content: 'authors: []\n',
          op: 'create',
          reason: 'create missing metadata _author.yml',
        },
        {
          path: OPENDRAFT_CONFIG_PATH,
          content: 'protocol: {}\nmanuscripts: []\n',
          op: 'update',
          reason: 'register case-series-review in project configuration',
        },
      ],
      registered: ['case-series-review'],
      warnings: [],
    };

    await applyPlan(ws, plan);

    expect(await ws.readFile('manuscripts/case-series-review/_author.yml')).toBe('authors: []\n');
    expect(await ws.readFile(OPENDRAFT_CONFIG_PATH)).toBe('protocol: {}\nmanuscripts: []\n');
  });

  it('throws InitError exists and writes nothing when a create target already exists', async () => {
    const ws = new MemoryWorkspace();
    const existingPath = 'manuscripts/case-series-review/_author.yml';
    const absentPath = 'manuscripts/case-series-review/_abstract.yml';
    await ws.writeFile(existingPath, 'authors: []\n');

    const plan: InitPlan = {
      files: [
        { path: absentPath, content: 'abstract: ""\n', op: 'create', reason: 'create missing metadata' },
        { path: existingPath, content: 'authors: []\n', op: 'create', reason: 'create missing metadata' },
      ],
      registered: ['case-series-review'],
      warnings: [],
    };

    await expect(applyPlan(ws, plan)).rejects.toMatchObject({ code: 'exists' });
    await expect(applyPlan(ws, plan)).rejects.toBeInstanceOf(InitError);
    expect(await ws.readFile(absentPath)).toBeNull();
  });
});
