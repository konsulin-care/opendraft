// @vitest-environment jsdom
/**
 * BlockBody anchor tests: the host element exposes its block file name
 * via `data-block-file` so cross-reference drawers can scroll the
 * matching block into view.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockBody } from './BlockBody';
import {
  DIR,
  installBlockBodyHarness,
  uninstallBlockBodyHarness,
} from './block-body-harness';

beforeEach(installBlockBodyHarness);
afterEach(uninstallBlockBodyHarness);

describe('BlockBody data-block-file anchor', () => {
  it('defaults the host file to the derived block file name', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(
      `${DIR}/blocks/_methods.qmd`,
      '# Methods {#sec-methods .deo-section}\nBody text.\n',
    );
    const { getByTestId } = render(
      <BlockBody ws={ws} dir={DIR} short="methods" title="Methods" collapsed={false} />,
    );
    expect(getByTestId('block-body-host')).toHaveAttribute('data-block-file', '_methods.qmd');
  });

  it('uses an explicit file prop when provided', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(
      `${DIR}/blocks/methods.qmd`,
      '# Methods {#sec-methods .deo-section}\nBody text.\n',
    );
    const { getByTestId } = render(
      <BlockBody
        ws={ws}
        dir={DIR}
        short="methods"
        file="methods.qmd"
        title="Methods"
        collapsed={false}
      />,
    );
    expect(getByTestId('block-body-host')).toHaveAttribute('data-block-file', 'methods.qmd');
  });
});
