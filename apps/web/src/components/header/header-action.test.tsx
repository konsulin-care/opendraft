// @vitest-environment jsdom
/**
 * Shared header action primitives: the label piece keeps the visible text
 * hidden below 400px so the icon carries the button on narrow screens.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HeaderActionLabel } from './header-action';

describe('HeaderActionLabel', () => {
  it('hides its text below 400px and shows it from 400px up', () => {
    render(<HeaderActionLabel label="Suggest edits" />);

    expect(screen.getByText('Suggest edits')).toHaveClass('hidden', 'min-[400px]:inline');
  });
});
