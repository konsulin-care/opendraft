import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CitekeyTooltip } from './citekey-tooltip';
import type { Reference } from '@opendraft/references';

const mockRef: Reference = {
  citeKey: 'smith2024',
  entryType: 'article',
  fields: { author: 'Smith, John', year: '2024', title: 'A Test Article', journal: 'Test Journal', volume: '10', number: '2', pages: '100-120', doi: '10.1000/test' },
};

function createMockAnchor() {
  const anchor = document.createElement('span');
  anchor.getBoundingClientRect = vi.fn().mockReturnValue({ top: 100, left: 100, width: 50, height: 20, bottom: 120, right: 150 });
  document.body.appendChild(anchor);
  return anchor;
}

describe('CitekeyTooltip', () => {
  it('renders APA-formatted citation', () => {
    const anchor = createMockAnchor();
    render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Smith, J.');
    expect(tooltip.textContent).toContain('2024');
    expect(tooltip.textContent).toContain('A Test Article');
    document.body.removeChild(anchor);
  });

  it('does not render when reference is null', () => {
    const anchor = createMockAnchor();
    const { container } = render(<CitekeyTooltip reference={null} anchorEl={anchor} onClose={() => {}} />);
    expect(container.querySelector('.citekey-tooltip')).not.toBeInTheDocument();
    document.body.removeChild(anchor);
  });

  it('does not render when anchorEl is null', () => {
    const { container } = render(<CitekeyTooltip reference={mockRef} anchorEl={null} onClose={() => {}} />);
    expect(container.querySelector('.citekey-tooltip')).not.toBeInTheDocument();
  });

  it('calls onClose when mouse leaves', () => {
    const anchor = createMockAnchor();
    const onClose = vi.fn();
    render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={onClose} />);
    fireEvent.mouseLeave(screen.getByRole('tooltip'));
    expect(onClose).toHaveBeenCalled();
    document.body.removeChild(anchor);
  });

  it('renders book reference with author and publisher', () => {
    const bookRef: Reference = { citeKey: 'doe2023', entryType: 'book', fields: { author: 'Doe, Jane', year: '2023', title: 'A Great Book', publisher: 'Publisher Inc.' } };
    const anchor = createMockAnchor();
    render(<CitekeyTooltip reference={bookRef} anchorEl={anchor} onClose={() => {}} />);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Doe, J.');
    expect(tooltip.textContent).toContain('Publisher Inc.');
    document.body.removeChild(anchor);
  });
});
