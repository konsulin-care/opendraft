// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ConflictDialog } from './ConflictDialog';

/** Two paths that changed both locally and on GitHub. */
const PATHS = ['manuscript.md', 'sections/intro.md'];

/**
 * Render the dialog with a spy resolve handler.
 *
 * @returns The onResolve spy in use.
 */
function renderDialog() {
  const onResolve = vi.fn();
  render(<ConflictDialog paths={PATHS} onResolve={onResolve} />);
  return { onResolve };
}

/**
 * Find the row element for a conflicting path.
 *
 * @param path - Path text used as the row legend.
 * @returns The fieldset that groups that path's choices.
 */
function row(path: string): HTMLElement {
  return screen.getByText(path).closest('fieldset') as HTMLElement;
}

describe('conflict dialog rows', () => {
  it('shows how many files changed on GitHub while editing', () => {
    renderDialog();
    expect(
      screen.getByText('2 files changed on GitHub while you were editing'),
    ).toBeInTheDocument();
  });

  it('offers both choices for every file', () => {
    renderDialog();

    for (const path of PATHS) {
      const group = within(row(path));
      expect(group.getByLabelText('Keep my version')).toBeInTheDocument();
      expect(group.getByLabelText('Keep the accepted version')).toBeInTheDocument();
    }
  });

  it('defaults every file to the accepted version', () => {
    renderDialog();

    for (const path of PATHS) {
      const group = within(row(path));
      expect(group.getByLabelText('Keep the accepted version')).toBeChecked();
      expect(group.getByLabelText('Keep my version')).not.toBeChecked();
    }
  });
});

describe('conflict dialog resolution', () => {
  it('resolves every path to the accepted version by default', () => {
    const { onResolve } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith({
      'manuscript.md': 'theirs',
      'sections/intro.md': 'theirs',
    });
  });

  it('resolves each path to the version the user picked', () => {
    const { onResolve } = renderDialog();

    fireEvent.click(within(row('manuscript.md')).getByLabelText('Keep my version'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onResolve).toHaveBeenCalledWith({
      'manuscript.md': 'mine',
      'sections/intro.md': 'theirs',
    });
  });
});
