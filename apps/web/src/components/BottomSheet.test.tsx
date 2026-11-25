// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderSheet = (action?: { label: string; onClick: () => void }) => {
  const onClose = vi.fn();
  render(
    <BottomSheet title="Author details" onClose={onClose} action={action}>
      <p>Body content</p>
    </BottomSheet>,
  );
  return { onClose };
};

describe('BottomSheet rendering', () => {
  it('renders an open dialog with the title and children', () => {
    renderSheet();
    const dialog = screen.getByTestId('bottom-sheet');
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    const heading = screen.getByRole('heading', { name: 'Author details' });
    expect(heading.id).toBe(dialog.getAttribute('aria-labelledby'));
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('renders a footer action button that calls action.onClick', () => {
    const onClick = vi.fn();
    renderSheet({ label: 'Edit', onClick });
    const action = screen.getByTestId('bottom-sheet-action');
    expect(action.textContent).toBe('Edit');
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders no footer action button when no action is given', () => {
    renderSheet();
    expect(screen.queryByTestId('bottom-sheet-action')).toBeNull();
  });
});

describe('BottomSheet dismissal', () => {
  it('calls onClose on Escape (cancel event)', () => {
    const { onClose } = renderSheet();
    fireEvent(screen.getByTestId('bottom-sheet'), new Event('cancel', { bubbles: false }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on a click whose target is the dialog backdrop', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByTestId('bottom-sheet'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on a click inside the sheet body', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByText('Body content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on the close button', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByTestId('bottom-sheet-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheet portal', () => {
  it('mounts the dialog as a direct child of document.body', () => {
    const { container } = render(
      <BottomSheet title="Author details" onClose={vi.fn()}>
        <p>Body content</p>
      </BottomSheet>,
    );
    const dialog = screen.getByTestId('bottom-sheet');
    expect(dialog.parentElement).toBe(document.body);
    expect(container.contains(dialog)).toBe(false);
  });

  it('mounts the dialog outside a nested wrapper element', () => {
    render(
      <div data-testid="nested-wrapper">
        <BottomSheet title="Author details" onClose={vi.fn()}>
          <p>Body content</p>
        </BottomSheet>
      </div>,
    );
    const dialog = screen.getByTestId('bottom-sheet');
    expect(screen.getByTestId('nested-wrapper').contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
  });

  it('calls onClose once from the close button on the portaled dialog', () => {
    const { onClose } = renderSheet();
    const dialog = screen.getByTestId('bottom-sheet');
    expect(dialog.parentElement).toBe(document.body);
    fireEvent.click(screen.getByTestId('bottom-sheet-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
