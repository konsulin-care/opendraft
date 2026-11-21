import { describe, it, expect } from 'vitest';
import git from 'isomorphic-git';
import type { HttpClient } from 'isomorphic-git';
import { MemoryFS } from '../src/memory-fs.js';
import { RemoteGit, relayUrl } from '../src/remote.js';

interface RecordedRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Create a fake HTTP client that records the first request then throws to abort.
 * @returns Recorded requests array and the fake client.
 */
function createStoppingHttp(): {
  requests: RecordedRequest[];
  http: HttpClient;
} {
  const requests: RecordedRequest[] = [];
  const http = {
    request: async (req: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    }) => {
      requests.push(req);
      throw new Error('stop');
    },
  } as unknown as HttpClient;
  return { requests, http };
}

describe('relayUrl', () => {
  it('builds the BFF relay URL for a repository', () => {
    expect(relayUrl('https://publish.konsulin.care', 'konsulin-care', 'citizen-science')).toBe(
      'https://publish.konsulin.care/@api/git/konsulin-care/citizen-science.git',
    );
  });
});

describe('RemoteGit', () => {
  it('clone sends its first request to the upload-pack info refs without Authorization', async () => {
    const { requests, http } = createStoppingHttp();
    const remote = new RemoteGit({ http, fs: new MemoryFS(), dir: '/clone' });
    const url = relayUrl('https://publish.konsulin.care', 'konsulin-care', 'citizen-science');

    await expect(remote.clone(url)).rejects.toThrow('stop');

    expect(requests[0].url).toBe(`${url}/info/refs?service=git-upload-pack`);
    expect(requests[0].headers?.Authorization).toBeUndefined();
    expect(requests[0].headers?.authorization).toBeUndefined();
  });

  it('push sends its first request to the receive-pack info refs without Authorization', async () => {
    const fs = new MemoryFS();
    const dir = '/push';
    const url = relayUrl('https://publish.konsulin.care', 'konsulin-care', 'citizen-science');

    await git.init({ fs, dir, defaultBranch: 'main' });
    await fs.promises.writeFile(`${dir}/file.txt`, 'hello');
    await git.add({ fs, dir, filepath: 'file.txt' });
    await git.commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com', timestamp: Date.now(), timezoneOffset: 0 },
    });

    const { requests, http } = createStoppingHttp();
    const pushing = new RemoteGit({ http, fs, dir });
    await expect(pushing.push(url, 'main')).rejects.toThrow('stop');

    expect(requests[0].url).toBe(`${url}/info/refs?service=git-receive-pack`);
    expect(requests[0].headers?.Authorization).toBeUndefined();
    expect(requests[0].headers?.authorization).toBeUndefined();
  });
});
