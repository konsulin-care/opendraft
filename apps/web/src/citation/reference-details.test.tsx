import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { Reference } from '@opendraft/references';
import { ReferenceDetails } from './reference-details';

const mockRef: Reference = {
  citeKey: 'smith2024',
  entryType: 'article',
  fields: {
    author: 'Smith, John',
    year: '2024',
    title: 'A Test Article',
    journal: 'Test Journal',
    volume: '10',
    number: '2',
    pages: '100-120',
    doi: '10.1000/test',
  },
};

describe('ReferenceDetails', () => {
  it('renders the APA-formatted reference text', () => {
    render(<ReferenceDetails reference={mockRef} />);
    expect(screen.getByText(/Smith, J\./)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/A test article/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/doi\.org\/10\.1000\/test/)).toBeInTheDocument();
  });

  it('renders the crossref collision warning for a crossref-prefixed citekey', () => {
    const crossrefRef: Reference = { ...mockRef, citeKey: 'thm-jones' };
    const { container } = render(<ReferenceDetails reference={crossrefRef} />);
    expect(
      screen.getByText(/Prefix reserved for Quarto cross-references/),
    ).toBeInTheDocument();
    expect(container.querySelector('.citation-crossref-warning')).not.toBeNull();
  });

  it('does not render the warning for a regular citekey', () => {
    const { container } = render(<ReferenceDetails reference={mockRef} />);
    expect(container.querySelector('.citation-crossref-warning')).toBeNull();
  });
});
