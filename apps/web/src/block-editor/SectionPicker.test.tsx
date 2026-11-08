// @vitest-environment jsdom
/**
 * SectionPicker tests: core role chips create immediately with title,
 * short and role, the 'More options' disclosure reveals the extended DEO
 * roles, 'Custom section' hands off to the custom path, used roles show
 * a check mark yet stay clickable, and the accent styling is black with
 * no native select element anywhere.
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
  const { container } = render(
    <SectionPicker onCreate={onCreate} onCustom={onCustom} {...overrides} />,
  );
  return { onCreate, onCustom, container };
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

describe('SectionPicker used roles', () => {
  it('shows a check mark on used roles but keeps them clickable', () => {
    const { onCreate } = renderPicker({ usedRoles: new Set(['methods']) });
    const chip = screen.getByRole('button', { name: 'Methods' });

    expect(chip).toHaveTextContent('✓');
    expect(chip).not.toBeDisabled();
    expect(screen.getAllByText('✓')).toHaveLength(1);

    fireEvent.click(chip);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Methods', short: 'methods', role: 'methods',
    });
  });
});

describe('SectionPicker accent styling', () => {
  it('uses black accent styling and renders no native select element', () => {
    const { container } = renderPicker({ usedRoles: new Set(['methods']) });
    const classes = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.getAttribute('class') ?? '')
      .join(' ');

    expect(container.querySelector('select')).toBeNull();
    expect(classes).toMatch(/\bbg-secondary\b/);
    expect(classes).toMatch(/\bborder-black\b/);
    expect(classes).toMatch(/\bhover:bg-secondary\b/);
    expect(classes).toMatch(/\bfocus-visible:outline-black\b/);
    expect(classes).not.toMatch(/\b(?:sky|blue)-/);
  });
});
