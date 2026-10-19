import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineEditField } from './InlineEditField';
import type { InlineEditFieldProps } from './InlineEditField';

// @vitest-environment jsdom

/**
 * Render the field with optional prop overrides.
 *
 * @param overrides - Props to replace on top of the defaults.
 * @returns The testing-library render result.
 */
function renderField(overrides: Partial<InlineEditFieldProps> = {}) {
  return render(
    <InlineEditField value="Test Project" label="Test field" {...overrides} />,
  );
}

describe('InlineEditField caret placement', () => {
  it('places the caret at the end of the text on click', () => {
    renderField();
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    fireEvent.click(input);
    expect(input.selectionStart).toBe(12);
    expect(input.selectionEnd).toBe(12);
  });

  it('places the caret at the end of the text on focus', () => {
    renderField();
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.selectionStart).toBe(12);
    expect(input.selectionEnd).toBe(12);
  });
});

describe('InlineEditField pen icon', () => {
  it('shows a SquarePen icon hidden until hover or focus', () => {
    const { container } = renderField();
    const pen = container.querySelector('.lucide-square-pen');
    expect(pen).not.toBeNull();
    expect(pen?.getAttribute('class')).toMatch(/opacity-0/);
    expect(pen?.getAttribute('class')).toMatch(/group-hover:opacity-100/);
    expect(pen?.getAttribute('class')).toMatch(/group-focus-within:opacity-100/);
  });

  it('accepts an onSave prop so save behavior can be attached', () => {
    const onSave = vi.fn();
    renderField({ onSave });
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    expect(input.value).toBe('Test Project');
    expect(onSave).not.toHaveBeenCalled();
  });
});
