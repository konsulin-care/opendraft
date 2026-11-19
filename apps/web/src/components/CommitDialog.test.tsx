import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommitDialog } from './CommitDialog';
import { validateProject } from '@opendraft/validate';
import { MemoryWorkspace } from '@opendraft/workspace';

// @vitest-environment jsdom

vi.mock('@opendraft/validate', () => ({ validateProject: vi.fn() }));
vi.mock('../project/protocol-cache', () => ({ IndexedDbProtocolCache: class {} }));

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

  it('calls onCommit when only warnings are reported', async () => {
    vi.mocked(validateProject).mockResolvedValue([
      { level: 'warning', location: 'project', path: 'a', message: 'w' },
    ]);
    render(<CommitDialog isOpen={true} onClose={mockOnClose} onCommit={mockOnCommit} workspace={workspace} />);
    fireEvent.change(screen.getByPlaceholderText('Enter commit message...'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Commit'));
    await waitFor(() => expect(mockOnCommit).toHaveBeenCalledWith('Test'));
  });

  it('shows validation errors when the assembly is missing', async () => {
    vi.mocked(validateProject).mockResolvedValue([
      { level: 'error', location: 'project', path: 'p', message: 'bad thing' },
    ]);
    render(<CommitDialog isOpen={true} onClose={mockOnClose} onCommit={mockOnCommit} workspace={workspace} />);
    fireEvent.change(screen.getByPlaceholderText('Enter commit message...'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Commit'));
    await waitFor(() => expect(screen.getByText(/validation errors/i)).toBeDefined());
    expect(screen.getByText(/bad thing/)).toBeDefined();
    expect(mockOnCommit).not.toHaveBeenCalled();
  });
});