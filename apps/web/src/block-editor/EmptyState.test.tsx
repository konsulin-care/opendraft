// @vitest-environment jsdom
/**
 * EmptyState tests: the embedded SectionPicker's five DEO preset chips
 * on an empty manuscript, one click creating the clicked preset's block
 * file and include with title, short and role, the picker's disclosure
 * and accent styling on the empty-state surface, and its 'Custom
 * section' entry opening the add form.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { EmptyState } from './EmptyState';
import type { EmptyStateProps } from './EmptyState';
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

/**
 * Render the empty card with a create handler.
 *
 * @param onCreate - Create handler called by chips and the add form.
 * @returns The rendered container for DOM-class assertions.
 */
function renderEmpty(onCreate: EmptyStateProps['onCreate']) {
  const { container } = render(<EmptyState onCreate={onCreate} />);
  return container;
}

describe('EmptyState preset chips', () => {
  it('renders the DEO preset chips for an empty manuscript', () => {
    renderEmpty(vi.fn());

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

  it('calls onCreate with title, short and role when a core chip is clicked', () => {
    const onCreate = vi.fn();
    renderEmpty(onCreate);

    fireEvent.click(screen.getByRole('button', { name: 'Methods' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Methods',
      short: 'methods',
      role: 'methods',
    });
  });
});

describe('EmptyState embedded section picker', () => {
  it('embeds the same section picker', () => {
    const container = renderEmpty(vi.fn());
    const toggle = screen.getByRole('button', { name: 'More options' });
    const classes = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.getAttribute('class') ?? '')
      .join(' ');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('select')).toBeNull();
    expect(classes).toMatch(/\bbg-secondary\b/);
    expect(classes).toMatch(/\bborder-black\b/);
    expect(classes).toMatch(/\bfocus-visible:outline-black\b/);
    expect(classes).not.toMatch(/\b(?:sky|blue)-/);
    expect(
      screen.getByRole('button', { name: 'Custom section' }),
    ).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: 'Acknowledgements' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Methods' })).toBeInTheDocument();
  });

  it("'Custom section' sits below a divider after the chips and the toggle", () => {
    renderEmpty(vi.fn());
    const custom = screen.getByRole('button', { name: 'Custom section' });
    const toggle = screen.getByRole('button', { name: 'More options' });
    const methods = screen.getByRole('button', { name: 'Methods' });

    expect(custom.closest('footer')).toHaveClass('border-t');
    expect(
      toggle.compareDocumentPosition(custom) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      methods.compareDocumentPosition(custom) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('EmptyState custom section form', () => {
  it("opens the add form when the picker's 'Custom section' is activated", () => {
    renderEmpty(vi.fn());

    fireEvent.click(screen.getByRole('button', { name: 'Custom section' }));

    expect(screen.getByLabelText('Add block')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveFocus();
  });
});
