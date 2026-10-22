// @vitest-environment jsdom
/**
 * Byline tests: the add-author CTA is a pulsing black button when the
 * manuscript has no authors and reverts to the muted default style once
 * at least one author exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Byline } from './Byline';
import { buildByline } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** One person author for the non-empty fixture. */
const ONE_AUTHOR: MetadataAuthor[] = [
  { id: 'smith', name: { given: 'Alice', family: 'Smith' } },
];

describe('Byline add-author CTA', () => {
  it('is a pulsing black CTA when there are no authors', () => {
    render(<Byline model={buildByline([], [])} onOpenName={() => {}} />);
    const button = screen.getByTestId('add-author');
    expect(button.className).toContain('bg-black');
    expect(button.className).toContain('text-white');
    expect(button.className).toContain('animate-pulse');
  });

  it('uses the muted default style once an author exists', () => {
    render(<Byline model={buildByline(ONE_AUTHOR, [])} onOpenName={() => {}} />);
    const button = screen.getByTestId('add-author');
    expect(button.className).not.toContain('bg-black');
    expect(button.className).not.toContain('text-white');
    expect(button.className).not.toContain('animate-pulse');
    expect(button.className).toContain('text-muted');
  });

  it('opens the draft author form when clicked', () => {
    const onOpenName = vi.fn();
    render(<Byline model={buildByline([], [])} onOpenName={onOpenName} />);
    fireEvent.click(screen.getByTestId('add-author'));
    expect(onOpenName).toHaveBeenCalledWith(-1);
  });
});
