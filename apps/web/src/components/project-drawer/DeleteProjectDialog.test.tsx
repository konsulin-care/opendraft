import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import type { DeleteProjectDialogProps } from './DeleteProjectDialog';

// @vitest-environment jsdom

/** Project the dialog deletes; its exact name unlocks the confirm action. */
const PROJECT = { id: 'proj-1', name: 'My Paper' };

/**
 * Render the dialog with spy handlers.
 *
 * @param overrides - Replace either handler with a known spy.
 * @returns The onConfirm and onCancel spies in use.
 */
function renderDialog(overrides: Partial<DeleteProjectDialogProps> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn<(id: string) => void>();
  const onCancel = overrides.onCancel ?? vi.fn();
  render(
    <DeleteProjectDialog project={PROJECT} onConfirm={onConfirm} onCancel={onCancel} />,
  );
  return { onConfirm, onCancel };
}

/**
 * Type into the confirmation input.
 *
 * @param value - Text to set on the input.
 */
function type(value: string) {
  fireEvent.change(screen.getByLabelText('Confirm project name'), {
    target: { value },
  });
}

describe('delete project dialog confirmation', () => {
  it('keeps the confirm action disabled until the exact name is typed', () => {
    renderDialog();
    const confirm = screen.getByRole('button', {
      name: 'Delete project',
    }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);
    type('my paper');
    expect(confirm.disabled).toBe(true);
    type('My Paper ');
    expect(confirm.disabled).toBe(true);
    type('My Paper');
    expect(confirm.disabled).toBe(false);
  });

  it('submits on Enter only when the name matches', () => {
    const { onConfirm } = renderDialog();
    const input = screen.getByLabelText('Confirm project name');

    type('My Pape');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();

    type('My Paper');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(PROJECT.id);
  });

  it('calls onConfirm once with the project id after a match', () => {
    const { onConfirm } = renderDialog();

    type('My Paper');
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(PROJECT.id);
  });
});

describe('delete project dialog cancellation', () => {
  it('cancels on Escape without confirming', () => {
    const { onConfirm, onCancel } = renderDialog();

    type('My Paper');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels on a backdrop click without confirming, but not on panel clicks', () => {
    const { onConfirm, onCancel } = renderDialog();

    type('My Paper');
    fireEvent.click(screen.getByTestId('delete-project-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Delete project', { selector: 'h2' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
