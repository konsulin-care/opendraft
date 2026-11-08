// @vitest-environment jsdom
/**
 * AddSectionDialog tests: the custom section view refuses an empty title,
 * submits the title plus short name with no role, collapses the derived
 * short name behind 'Change', and Back/Cancel/Add plus Enter/Escape drive
 * the dialog over the picker view. The picker view keeps black accent
 * styling and renders no native select element.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AddSectionDialog } from './AddSectionDialog';
import type { AddSectionDialogProps } from './AddSectionDialog';

/**
 * Render the dialog with spy handlers.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The onCreate and onClose spies in use.
 */
function renderDialog(overrides: Partial<AddSectionDialogProps> = {}) {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  const { container } = render(
    <AddSectionDialog onCreate={onCreate} onClose={onClose} {...overrides} />,
  );
  return { onCreate, onClose, container };
}

/** Open the custom section view from the picker view. */
function openCustom() {
  fireEvent.click(screen.getByRole('button', { name: 'Custom section' }));
}

/** The required title input of the custom view. */
function titleInput(): HTMLInputElement {
  return screen.getByLabelText('Title') as HTMLInputElement;
}

describe('AddSectionDialog custom section title', () => {
  it('refuses to submit an empty title', () => {
    const { onCreate, onClose } = renderDialog();
    openCustom();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(titleInput()).toHaveFocus();
  });

  it('submits the title plus short name with no role', () => {
    const { onCreate, onClose } = renderDialog();
    openCustom();

    fireEvent.change(titleInput(), { target: { value: 'Synthesis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Synthesis',
      short: 'synthesis',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AddSectionDialog collapsed short name', () => {
  it('keeps the derived short name behind Change until edited', () => {
    renderDialog();
    openCustom();
    fireEvent.change(titleInput(), { target: { value: 'Synthesis' } });

    expect(screen.queryByLabelText('Short name')).toBeNull();
    expect(screen.getByLabelText('Short name value')).toHaveTextContent(
      'synthesis',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    const short = screen.getByLabelText('Short name') as HTMLInputElement;
    expect(short).toHaveValue('synthesis');
    fireEvent.change(short, { target: { value: 'synth' } });
    fireEvent.change(titleInput(), { target: { value: 'Other' } });
    expect(short).toHaveValue('synth');
  });
});

describe('AddSectionDialog pick view wiring', () => {
  it('creates from a core chip and closes the dialog', () => {
    const { onCreate, onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Methods' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Methods',
      short: 'methods',
      role: 'methods',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns to the picker view with Back and closes with Cancel', () => {
    const { onClose } = renderDialog();
    openCustom();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Methods' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AddSectionDialog Enter and Escape', () => {
  it('submits on Enter and closes without creating on Escape', () => {
    const { onCreate, onClose } = renderDialog();
    openCustom();

    fireEvent.keyDown(titleInput(), { key: 'Escape' });
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(titleInput(), { target: { value: 'Limitations' } });
    fireEvent.keyDown(titleInput(), { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Limitations',
      short: 'limitations',
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('AddSectionDialog picker accent styling', () => {
  it('uses black accent styling and renders no native select element', () => {
    const { container } = renderDialog();
    const classes = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.getAttribute('class') ?? '')
      .join(' ');

    expect(container.querySelector('select')).toBeNull();
    expect(classes).toMatch(/\bhover:bg-secondary\b/);
    expect(classes).toMatch(/\bfocus-visible:outline-black\b/);
    expect(classes).not.toMatch(/\b(?:sky|blue)-/);
  });
});
