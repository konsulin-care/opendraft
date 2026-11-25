// @vitest-environment jsdom
/**
 * BlockBody read-only tests: inside a ReadOnlyContext provider the
 * mounted ProseMirror surface is not editable, while outside any
 * provider the block body stays editable as before.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockBody } from './BlockBody';
import { ReadOnlyContext } from './read-only-context';
import {
  DIR,
  installBlockBodyHarness,
  uninstallBlockBodyHarness,
} from './block-body-harness';

beforeEach(installBlockBodyHarness);
afterEach(uninstallBlockBodyHarness);

/**
 * Render a block body, optionally inside a read-only provider, and
 * return the ProseMirror surface once the editor has mounted.
 *
 * @param readOnly - Whether to wrap the body in a true provider.
 * @returns The mounted ProseMirror surface element.
 */
async function mountSurface(readOnly: boolean): Promise<HTMLElement> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(
    `${DIR}/blocks/methods.qmd`,
    '# Methods {#sec-methods .deo-section}\nBody text.\n',
  );
  const body = (
    <BlockBody ws={ws} dir={DIR} short="methods" title="Methods" collapsed={false} />
  );
  render(
    readOnly ? (
      <ReadOnlyContext.Provider value={true}>{body}</ReadOnlyContext.Provider>
    ) : (
      body
    ),
  );
  let surface: HTMLElement | null = null;
  await waitFor(() => {
    surface = document.querySelector<HTMLElement>(
      '[data-testid="block-body-editor"] .ProseMirror',
    );
    expect(surface).not.toBeNull();
  }, { timeout: 10000 });
  return surface as unknown as HTMLElement;
}

describe('BlockBody read-only context', () => {
  it('renders a non-editable surface inside a read-only provider', async () => {
    const surface = await mountSurface(true);
    await waitFor(() => {
      expect(surface).toHaveAttribute('contenteditable', 'false');
    }, { timeout: 10000 });
  }, 20000);

  it('keeps the surface editable outside the provider', async () => {
    const surface = await mountSurface(false);
    expect(surface).toHaveAttribute('contenteditable', 'true');
  }, 20000);
});
