import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommitDialog } from './CommitDialog';
import { MemoryWorkspace } from '@opendraft/workspace';

// @vitest-environment jsdom

describe('CommitDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnCommit = vi.fn();
  const workspace = new MemoryWorkspace();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders commit dialog with message input', () => {
    render(<CommitDialog isOpen={true} onClose={mockOnClose} onCommit={mockOnCommit} workspace={workspace} />);
    expect(screen.getByText('Commit Changes')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter commit message...')).toBeDefined();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<CommitDialog isOpen={true} onClose={mockOnClose} onCommit={mockOnCommit} workspace={workspace} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CommitDialog isOpen={false} onClose={mockOnClose} onCommit={mockOnCommit} workspace={workspace} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows validation errors when the assembly is missing', async () => {
    render(<CommitDialog isOpen={true} onClose={mockOnClose} onCommit={mockOnCommit} workspace={workspace} />);
    fireEvent.change(screen.getByPlaceholderText('Enter commit message...'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Commit'));
    await waitFor(() => expect(screen.getByText(/validation errors/i)).toBeDefined());
  });
});