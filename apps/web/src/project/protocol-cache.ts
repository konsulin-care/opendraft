import { IndexedDBWorkspace } from '@opendraft/workspace';

/** IndexedDB-backed protocol cache storing values under `<sha>/<path>`. */
export class IndexedDbProtocolCache {
  private readonly ws: IndexedDBWorkspace;

  /**
   * @param name - workspace/database id.
   */
  constructor(name = 'opendraft-protocol-cache') {
    this.ws = new IndexedDBWorkspace(name);
  }

  /** Returns the cached value for the key, or null when missing. */
  async get(key: string): Promise<string | null> {
    return this.ws.readFile(key);
  }

  /** Stores a value under the key. */
  async set(key: string, value: string): Promise<void> {
    await this.ws.writeFile(key, value);
  }
}
