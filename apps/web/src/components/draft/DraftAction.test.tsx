// @vitest-environment jsdom
/**
 * DraftAction tests: the main part calls onPrimary, the chevron opens a menu
 * whose entries report the chosen item, and the busy state disables both
 * parts with a spinner and progress label.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DraftAction } from './DraftAction';
import type { DraftActionProps } from './DraftAction';

const ITEMS = ['Send for review', 'Start a new draft'];

/**
 * Build split-button props with spies.
 *
 * @param overrides - Props that replace the idle defaults.
 * @returns Complete props for the component.
 */
function props(overrides: Partial<DraftActionProps> = {}): DraftActionProps {
  return {
    label: 'Save to GitHub',
    onPrimary: vi.fn(),
    onMenu: vi.fn(),
    items: ITEMS,
    ...overrides,
  };
}

describe('DraftAction split button', () => {
  it('calls onPrimary from the main part', () => {
    const onPrimary = vi.fn();
    render(<DraftAction {...props({ onPrimary })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save to GitHub' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('opens the chevron menu and reports the chosen item', () => {
    const onMenu = vi.fn();
    render(<DraftAction {...props({ onMenu })} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Send for review' }));
    expect(onMenu).toHaveBeenCalledWith('Send for review');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('DraftAction busy state', () => {
  it('is disabled with a spinner and the progress label while busy', () => {
    render(
      <DraftAction {...props({ busy: true, busyLabel: 'Saving your draft…' })} />,
    );

    expect(screen.getByRole('button', { name: 'Saving your draft…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDisabled();
    expect(screen.getByTestId('draft-action-spinner')).toHaveClass('animate-spin');
    expect(screen.getByText('Saving your draft…')).toBeInTheDocument();
  });

  it('ignores the main action while busy', () => {
    const onPrimary = vi.fn();
    render(<DraftAction {...props({ busy: true, onPrimary })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save to GitHub' }));
    expect(onPrimary).not.toHaveBeenCalled();
  });
});
