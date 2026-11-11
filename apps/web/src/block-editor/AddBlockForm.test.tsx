// @vitest-environment jsdom
/**
 * AddBlockForm tests: title autofocus, short-name derivation with a manual
 * lock (clearing restores the sync), the live deduplicated short-name
 * preview, and Enter to create / Escape to cancel.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AddBlockForm } from './AddBlockForm';
import type { AddBlockFormProps } from './AddBlockForm';

/** Short names already used by the fixture manuscript. */
const TAKEN = ['methods'];

/**
 * Render the form with spy handlers.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The onCreate and onClose spies in use.
 */
function renderForm(overrides: Partial<AddBlockFormProps> = {}) {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(
    <AddBlockForm taken={TAKEN} onCreate={onCreate} onClose={onClose} {...overrides} />,
  );
  return { onCreate, onClose };
}

/**
 * Get a labelled input by its accessible name.
 *
 * @param label - Accessible name of the input.
 * @returns The input element.
 */
function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('AddBlockForm title autofocus', () => {
  it('autofocuses the title input when the form opens', () => {
    renderForm();

    expect(field('Title')).toHaveFocus();
  });
});

describe('AddBlockForm short name derivation', () => {
  it('derives the short name from the title until the user edits it by hand', () => {
    renderForm();

    fireEvent.change(field('Title'), { target: { value: 'My Section' } });
    expect(field('Short name')).toHaveValue('my-section');

    fireEvent.change(field('Short name'), { target: { value: 'custom-name' } });
    fireEvent.change(field('Title'), { target: { value: 'Other Title' } });
    expect(field('Short name')).toHaveValue('custom-name');
  });

  it('restores auto-sync of the short name when its field is cleared', () => {
    renderForm();

    fireEvent.change(field('Title'), { target: { value: 'Alpha' } });
    fireEvent.change(field('Short name'), { target: { value: 'locked' } });
    fireEvent.change(field('Title'), { target: { value: 'Beta' } });
    expect(field('Short name')).toHaveValue('locked');

    fireEvent.change(field('Short name'), { target: { value: '' } });
    expect(field('Short name')).toHaveValue('beta');

    fireEvent.change(field('Title'), { target: { value: 'Gamma' } });
    expect(field('Short name')).toHaveValue('gamma');
  });

  it('shows the deduplicated candidate short name before submission', () => {
    renderForm();
    const preview = screen.getByLabelText('Short name preview');

    fireEvent.change(field('Title'), { target: { value: 'Other Topic' } });
    expect(preview).toHaveTextContent('other-topic');

    fireEvent.change(field('Title'), { target: { value: 'Methods' } });
    expect(preview).toHaveTextContent(/methods-[0-9a-z]{6}/);
  });
});

describe('AddBlockForm submit and cancel', () => {
  it('creates the block on Enter and closes without creating on Escape', () => {
    const { onCreate, onClose } = renderForm();

    fireEvent.change(field('Title'), { target: { value: 'Discussion' } });
    fireEvent.keyDown(field('Title'), { key: 'Escape' });
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Section type'), {
      target: { value: 'methods' },
    });
    fireEvent.keyDown(field('Title'), { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Discussion',
      short: 'discussion',
      type: 'methods',
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
