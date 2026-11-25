import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openProjectFs, deleteProjectFs } from '../src/indexeddb-fs.js';

let counter = 0;

interface DeactivatableFs {
  promises: { _deactivate(): Promise<void> };
}

/**
 * Create a unique project id so tests do not share an IndexedDB database.
 * @param label - Human-readable test label.
 * @returns A unique project id.
 */
function uniqueId(label: string): string {
  counter += 1;
  return `${label}-${counter}`;
}

/**
 * Open a project filesystem, run a callback, then release its database locks.
 * @param projectId - Project identifier.
 * @param fn - Work to perform with the filesystem.
 * @returns The callback result.
 */
async function withProjectFs<T>(
  projectId: string,
  fn: (fs: ReturnType<typeof openProjectFs>) => Promise<T>,
): Promise<T> {
  const fs = openProjectFs(projectId);
  try {
    return await fn(fs);
  } finally {
    await (fs as unknown as DeactivatableFs).promises._deactivate();
  }
}

describe('project IndexedDB filesystem', () => {
  it('persists files when the same project is reopened', async () => {
    const projectId = uniqueId('persist');

    await withProjectFs(projectId, async (fs) => {
      await fs.promises.mkdir('/repo');
      await fs.promises.writeFile('/repo/draft.md', 'hello manuscript');
    });

    const content = await withProjectFs(projectId, (fs) =>
      fs.promises.readFile('/repo/draft.md', 'utf8'),
    );

    expect(content).toBe('hello manuscript');
  });

  it('isolates projects and wipes a single project', async () => {
    const firstId = uniqueId('first');
    const secondId = uniqueId('second');

    await withProjectFs(firstId, async (fs) => {
      await fs.promises.mkdir('/repo');
      await fs.promises.writeFile('/repo/draft.md', 'first project');
    });
    await withProjectFs(secondId, async (fs) => {
      await fs.promises.mkdir('/repo');
      await fs.promises.writeFile('/repo/draft.md', 'second project');
    });

    expect(
      await withProjectFs(firstId, (fs) => fs.promises.readFile('/repo/draft.md', 'utf8')),
    ).toBe('first project');
    expect(
      await withProjectFs(secondId, (fs) => fs.promises.readFile('/repo/draft.md', 'utf8')),
    ).toBe('second project');

    await deleteProjectFs(firstId);

    await withProjectFs(firstId, async (fs) => {
      await expect(fs.promises.readFile('/repo/draft.md', 'utf8')).rejects.toThrow();
    });

    expect(
      await withProjectFs(secondId, (fs) => fs.promises.readFile('/repo/draft.md', 'utf8')),
    ).toBe('second project');
  });
});
