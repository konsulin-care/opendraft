// @vitest-environment jsdom
/**
 * StatusChip tests: the chip shows its label, opens a popover with the copy
 * text and draft name, links to the suggestion when a pull request exists,
 * and lets a transient notice replace the label.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StatusChip } from './StatusChip';
import type { StatusChipProps } from './StatusChip';

const COPY =
  'Your copy of alice/paper · Changes are saved in this browser';

/**
 * Build chip props for a draft owned by alice.
 *
 * @param overrides - Props that replace the draft defaults.
 * @returns Complete props for the component.
 */
function props(overrides: Partial<StatusChipProps> = {}): StatusChipProps {
  return {
    label: 'Draft',
    owner: 'alice',
    repo: 'paper',
    draftName: 'od-alice/my-paper',
    ...overrides,
  };
}

describe('StatusChip label', () => {
  it('shows its label', () => {
    render(<StatusChip {...props()} />);

    expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument();
  });

  it('replaces the label with a transient notice', () => {
    render(<StatusChip {...props({ notice: 'Saved to GitHub' })} />);

    expect(screen.getByRole('button', { name: 'Saved to GitHub' })).toBeInTheDocument();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  });
});

describe('StatusChip popover', () => {
  it('opens with the copy text and draft name', () => {
    render(<StatusChip {...props()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(screen.getByRole('dialog', { name: 'Draft details' })).toBeInTheDocument();
    expect(screen.getByText(COPY)).toBeInTheDocument();
    expect(screen.getByText('od-alice/my-paper')).toBeInTheDocument();
  });

  it('links to the suggestion when a pull request exists', () => {
    render(
      <StatusChip {...props({ prUrl: 'https://github.com/alice/paper/pull/7' })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    const link = screen.getByRole('link', { name: 'View suggestion ↗' });
    expect(link).toHaveAttribute('href', 'https://github.com/alice/paper/pull/7');
  });

  it('omits the suggestion link without a pull request', () => {
    render(<StatusChip {...props()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(screen.queryByRole('link', { name: 'View suggestion ↗' })).not.toBeInTheDocument();
  });
});
