// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ManuscriptSwitcher } from './ManuscriptSwitcher';
import type { ManuscriptSwitcherProps } from './ManuscriptSwitcher';

const MANUSCRIPTS = [
  { id: 'alpha', title: 'Alpha study' },
  { id: 'beta', title: 'Beta study' },
  { id: 'gamma', title: 'Gamma study' },
];

/**
 * Render the switcher with optional prop overrides.
 *
 * @param overrides - Props to replace on top of the defaults.
 * @returns The testing-library render result.
 */
function renderSwitcher(overrides: Partial<ManuscriptSwitcherProps> = {}) {
  return render(
    <ManuscriptSwitcher
      manuscripts={MANUSCRIPTS}
      currentId="beta"
      onSelect={vi.fn()}
      {...overrides}
    />,
  );
}

/**
 * Open the manuscript menu by activating its trigger.
 */
function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Switch manuscript' }));
}

describe('ManuscriptSwitcher menu contents', () => {
  it('lists every manuscript with the current one checked and an All manuscripts entry', () => {
    renderSwitcher({ onSelectAll: vi.fn() });
    openMenu();

    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitemcheckbox');
    expect(items).toHaveLength(MANUSCRIPTS.length);
    for (const manuscript of MANUSCRIPTS) {
      expect(within(menu).getByText(manuscript.title)).toBeInTheDocument();
    }
    expect(items.map((item) => item.textContent?.trim())).toEqual(
      MANUSCRIPTS.map((manuscript) => manuscript.title),
    );
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(within(menu).getByRole('menuitem', { name: 'All manuscripts' })).toBeInTheDocument();
  });

  it('omits the All manuscripts entry when onSelectAll is not provided', () => {
    renderSwitcher();
    openMenu();

    expect(screen.queryByText('All manuscripts')).toBeNull();
  });
});

describe('ManuscriptSwitcher interactions', () => {
  it('calls onSelect with the chosen id and closes the menu', () => {
    const onSelect = vi.fn();
    renderSwitcher({ onSelect });
    openMenu();

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Gamma study' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('gamma');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onSelectAll and closes the menu for the All manuscripts entry', () => {
    const onSelectAll = vi.fn();
    renderSwitcher({ onSelectAll });
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'All manuscripts' }));

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders no trigger with fewer than two manuscripts', () => {
    renderSwitcher({ manuscripts: MANUSCRIPTS.slice(0, 1) });

    expect(screen.queryByRole('button', { name: 'Switch manuscript' })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
