// @vitest-environment jsdom
/**
 * BlockHeader tests: the level-1 warning badge driven by reportLoadedBody.
 * A body reported with an ATX level-1 heading (outside fenced code) shows
 * the badge in that block's header; a clean body leaves it absent. Pure
 * render — no Milkdown mount.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BlockHeader, reportLoadedBody } from './BlockHeader';
import type { BlockHeaderProps } from './BlockHeader';

/**
 * Render the header with fixture props for a block.
 *
 * @param short - Block short name the header belongs to.
 * @returns The render result.
 */
function renderHeader(short: string) {
  const props: BlockHeaderProps = {
    short,
    title: 'Methods',
    collapsed: false,
    onToggle: vi.fn(),
    wordCount: 42,
    saveStatus: 'saved',
  };
  return render(<BlockHeader {...props} />);
}

describe('BlockHeader level-1 warning badge', () => {
  it('renders the badge when the reported body contains a level-1 heading', () => {
    reportLoadedBody('methods', 'Some intro.\n\n# Legacy heading\n\nMore text.');

    renderHeader('methods');

    expect(screen.getByTestId('level-1-warning-badge')).toBeInTheDocument();
  });

  it('leaves the badge absent when the reported body has no level-1 heading', () => {
    reportLoadedBody('methods', 'Some intro.\n\n## Level two heading\n');

    renderHeader('methods');

    expect(screen.queryByTestId('level-1-warning-badge')).not.toBeInTheDocument();
  });
});
