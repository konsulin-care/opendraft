// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DraftStateChip } from './DraftStateChip';

describe('DraftStateChip', () => {
  it('renders the draft label with its desktop-only classes and title', () => {
    render(<DraftStateChip label="Sent for review" />);

    const chip = screen.getByTestId('draft-state');
    expect(chip.textContent).toBe('Sent for review');
    expect(chip.getAttribute('title')).toBe('Sent for review');
    const classes = chip.className.split(/\s+/);
    expect(classes).toContain('hidden');
    expect(classes).toContain('md:inline-flex');
  });
});
