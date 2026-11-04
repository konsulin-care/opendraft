// @vitest-environment jsdom
/**
 * EmptyState tests: the five DEO preset chips on an empty manuscript,
 * one click creating the clicked preset's block file and include, and
 * '+ Custom section' opening the add form.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { EmptyState } from './EmptyState';
import { useBlocks } from './use-blocks';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

/** Assembly with no includes — the empty manuscript fixture. */
const EMPTY_ARTICLE = '---\nmetadata-files:\n- _author.yml\n---\n\n::: {#refs}\n:::\n';

/** DEO preset chips the empty card must render, in document order. */
const PRESETS = ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion'];

/**
 * Render the empty card wired to real block persistence.
 *
 * Shows the card while the manuscript has no blocks and a marker once a
 * preset click has created one.
 *
 * @param ws - Workspace holding the empty manuscript fixture.
 */
function Harness({ ws }: { ws: WorkspaceAdapter }) {
  const { blocks, createBlock } = useBlocks(ws, DIR);
  if (blocks.length > 0) return <p data-testid="has-blocks" />;
  return <EmptyState onCreate={(draft) => createBlock(0, draft.title)} />;
}

describe('EmptyState preset chips', () => {
  it('renders the DEO preset chips for an empty manuscript', () => {
    render(<EmptyState onCreate={vi.fn()} />);

    for (const name of PRESETS) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it("creates the clicked preset's block file and include", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(ARTICLE, EMPTY_ARTICLE);
    render(<Harness ws={ws} />);

    const chip = await screen.findByRole('button', { name: 'Methods' });
    await act(async () => {
      fireEvent.click(chip);
    });

    expect(screen.getByTestId('has-blocks')).toBeInTheDocument();
    expect(await ws.readFile(`${BLOCKS}/methods.qmd`)).toContain('# Methods {#sec-methods');
    expect(await ws.readFile(ARTICLE)).toContain('{{< include blocks/methods.qmd >}}');
  });
});

describe('EmptyState custom section form', () => {
  it("opens the add form when '+ Custom section' is activated", () => {
    render(<EmptyState onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Custom section' }));

    expect(screen.getByLabelText('Add block')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveFocus();
  });
});
