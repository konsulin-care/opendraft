// @vitest-environment jsdom
/**
 * SectionPicker tests: core role chips create immediately with title,
 * short and role, the 'More options' disclosure reveals the extended DEO
 * roles, and 'Custom section' hands off to the custom path.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SectionPicker } from './SectionPicker';
import type { SectionPickerProps } from './SectionPicker';

/**
 * Render the picker with spy handlers.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The onCreate and onCustom spies in use.
 */
function renderPicker(overrides: Partial<SectionPickerProps> = {}) {
  const onCreate = vi.fn();
  const onCustom = vi.fn();
  render(
    <SectionPicker onCreate={onCreate} onCustom={onCustom} {...overrides} />,
  );
  return { onCreate, onCustom };
}

describe('SectionPicker core chips', () => {
  it("creates Methods with title 'Methods', short 'methods' and role 'methods'", () => {
    const { onCreate } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Methods' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Methods',
      short: 'methods',
      role: 'methods',
    });
  });
});

describe('SectionPicker more options disclosure', () => {
  it('reveals the extended DEO roles behind More options', () => {
    const { onCreate } = renderPicker();

    expect(
      screen.queryByRole('button', { name: 'Acknowledgements' }),
    ).toBeNull();
    const toggle = screen.getByRole('button', { name: 'More options' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const name of ['Acknowledgements', 'Related Work', 'Epilogue']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Methods' })).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe('SectionPicker extended role chips', () => {
  it('creates an extended role from its revealed chip', () => {
    const { onCreate } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));

    fireEvent.click(screen.getByRole('button', { name: 'Related Work' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Related Work',
      short: 'related-work',
      role: 'related-work',
    });
  });
});

describe('SectionPicker custom section entry', () => {
  it("hands the 'Custom section' button to onCustom", () => {
    const { onCustom } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Custom section' }));

    expect(onCustom).toHaveBeenCalledTimes(1);
  });
});
