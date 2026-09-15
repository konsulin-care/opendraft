// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComparisonView } from './comparison';
import type { ComparisonState } from './types';
import type { Reference } from '@opendraft/references';

const mockCurrent: Reference = {
  citeKey: 'doe2024',
  entryType: 'article',
  fields: { title: 'Current Version', author: 'Doe, Jane', year: '2024' },
};

const mockIncoming: Reference = {
  citeKey: 'doe2024',
  entryType: 'article',
  fields: { title: 'New Version', author: 'Doe, Jane', year: '2024' },
};

function createComparison(overrides?: Partial<ComparisonState>): ComparisonState {
  return {
    current: mockCurrent,
    incoming: mockIncoming,
    editedBibtex: '@article{doe2024, title={New Version}}',
    originalCitekey: 'doe2024',
    ...overrides,
  };
}

describe('ComparisonView - rendering', () => {
  it('renders both panels', () => {
    const comparison = createComparison();
    render(
      <ComparisonView
        comparison={comparison}
        onBibtexChange={() => {}}
        onDiscard={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Current')).toBeDefined();
    expect(screen.getByText('New (from DOI)')).toBeDefined();
  });
});

describe('ComparisonView - button states', () => {
  it('shows Replace button when citekey unchanged', () => {
    const comparison = createComparison();
    render(
      <ComparisonView
        comparison={comparison}
        onBibtexChange={() => {}}
        onDiscard={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Replace')).toBeDefined();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('shows Save button when citekey changed', () => {
    const comparison = createComparison({
      editedBibtex: '@article{doe_resilience_2024, title={New}}',
    });
    render(
      <ComparisonView
        comparison={comparison}
        onBibtexChange={() => {}}
        onDiscard={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.queryByText('Replace')).toBeNull();
  });
});

describe('ComparisonView - discard action', () => {
  it('calls onDiscard when Discard is clicked', () => {
    const onDiscard = vi.fn();
    const comparison = createComparison();
    render(
      <ComparisonView
        comparison={comparison}
        onBibtexChange={() => {}}
        onDiscard={onDiscard}
        onAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Discard'));
    expect(onDiscard).toHaveBeenCalled();
  });
});

describe('ComparisonView - replace/save actions', () => {
  it('calls onAction with replace when Replace is clicked', () => {
    const onAction = vi.fn();
    const comparison = createComparison();
    render(
      <ComparisonView
        comparison={comparison}
        onBibtexChange={() => {}}
        onDiscard={vi.fn()}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByText('Replace'));
    expect(onAction).toHaveBeenCalledWith('replace', comparison);
  });

  it('calls onAction with save when Save is clicked', () => {
    const onAction = vi.fn();
    const comparison = createComparison({
      editedBibtex: '@article{doe_resilience_2024, title={New}}',
    });
    render(
      <ComparisonView
        comparison={comparison}
        onBibtexChange={() => {}}
        onDiscard={vi.fn()}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByText('Save'));
    expect(onAction).toHaveBeenCalledWith('save', comparison);
  });
});
