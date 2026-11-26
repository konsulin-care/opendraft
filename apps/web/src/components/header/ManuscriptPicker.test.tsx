// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ManuscriptPicker } from './ManuscriptPicker';
import type { ManuscriptSwitcherOption } from './ManuscriptSwitcher';

const manuscripts: readonly ManuscriptSwitcherOption[] = [
  { id: 'alpha', title: 'Alpha Study' },
  { id: 'beta', title: 'Beta Study' },
];

const classes = (element: Element): string[] =>
  (element.getAttribute('class') ?? '').split(' ').filter(Boolean);

const renderPicker = (currentId?: string) =>
  render(
    <ManuscriptPicker
      manuscripts={manuscripts}
      currentId={currentId}
      onPick={vi.fn()}
      onClose={vi.fn()}
    />,
  );

describe('ManuscriptPicker content', () => {
  it('lists every manuscript with its title first and its id beneath', () => {
    renderPicker();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Alpha Study');
    expect(rows[0]).toHaveTextContent('alpha');
    expect(rows[1]).toHaveTextContent('Beta Study');
    expect(rows[1]).toHaveTextContent('beta');
  });

  it('marks the current manuscript with aria-current and focuses it on open', () => {
    renderPicker('beta');
    const alphaRow = screen.getByRole('button', { name: /Alpha Study/ });
    const betaRow = screen.getByRole('button', { name: /Beta Study/ });
    expect(alphaRow).not.toHaveAttribute('aria-current');
    expect(betaRow).toHaveAttribute('aria-current', 'true');
    expect(alphaRow.querySelector('svg')).toBeNull();
    expect(betaRow.querySelector('svg')).not.toBeNull();
    expect(betaRow).toHaveFocus();
  });

  it('focuses the first manuscript when none is current', () => {
    renderPicker();
    expect(screen.getByRole('button', { name: /Alpha Study/ })).toHaveFocus();
  });

  it('choosing a manuscript calls onPick with its id', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <ManuscriptPicker
        manuscripts={manuscripts}
        currentId="alpha"
        onPick={onPick}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Beta Study/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('beta');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ManuscriptPicker layout', () => {
  it('is a bottom sheet below md and an anchored popover from md, capped at 80vh', () => {
    renderPicker('alpha');
    const dialog = screen.getByRole('dialog', { name: 'Select manuscript' });
    expect(dialog).toHaveTextContent('Select manuscript');
    const dialogClasses = classes(dialog);
    expect(dialogClasses).toContain('fixed');
    expect(dialogClasses).toContain('bottom-0');
    expect(dialogClasses).toContain('md:absolute');
    expect(dialogClasses).toContain('max-h-[80vh]');
  });

  it('scrolls the list inside the surface', () => {
    renderPicker('alpha');
    const list = screen.getByRole('list');
    expect(classes(list.parentElement as Element)).toContain('overflow-y-auto');
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = vi.fn();
    render(
      <ManuscriptPicker manuscripts={manuscripts} onPick={vi.fn()} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close manuscript picker' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
