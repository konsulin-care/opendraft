// @vitest-environment jsdom
/**
 * ReaderUpdateBanner tests: the newer-version message and the refresh action.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ReaderUpdateBanner } from './ReaderUpdateBanner';

describe('ReaderUpdateBanner', () => {
  it('shows the update message and calls onRefresh from the Refresh button', () => {
    const onRefresh = vi.fn();
    render(<ReaderUpdateBanner onRefresh={onRefresh} />);

    expect(screen.getByText('A newer version is available.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
