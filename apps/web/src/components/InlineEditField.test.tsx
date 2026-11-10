import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

describe('InlineEditField save and revert', () => {
  it('saves the trimmed value on Enter', () => {
    const onSave = vi.fn();
    renderField({ onSave });
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  New Name  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('New Name');
  });

  it('ignores a whitespace-only value on blur and restores the previous value', () => {
    const onSave = vi.fn();
    renderField({ onSave });
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
    expect(input.value).toBe('Test Project');
  });

  it('reverts to the original text on Escape without saving', () => {
    const onSave = vi.fn();
    renderField({ onSave });
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Typo' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSave).not.toHaveBeenCalled();
    expect(input.value).toBe('Test Project');
  });
});

describe('InlineEditField commits a value once', () => {
  it('calls onSave exactly once when Enter is followed by blur before the save settles', async () => {
    let settle: () => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    renderField({ onSave });
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('New Name');
    await act(async () => {
      settle();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves again with a new value after the previous save settles', async () => {
    const onSave = vi.fn(async () => {});
    renderField({ onSave });
    const input = screen.getByRole('textbox', { name: 'Test field' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'First' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => {});
    fireEvent.change(input, { target: { value: 'Second' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith('Second');
  });
});
