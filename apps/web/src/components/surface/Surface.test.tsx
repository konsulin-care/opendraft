// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Scrim } from './Scrim';
import { Surface } from './Surface';
import type { SurfaceProps } from './Surface';

/**
 * Render a surface with optional prop overrides.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The testing-library render result.
 */
function renderSurface(overrides: Partial<SurfaceProps> = {}) {
  return render(
    <Surface id="picker" label="Select manuscript" role="dialog" variant="bottom-sheet" onClose={vi.fn()} {...overrides}>
      <p>First manuscript</p>
    </Surface>,
  );
}

const classes = (element: Element): string[] => (element.getAttribute('class') ?? '').split(' ').filter(Boolean);

describe('Surface', () => {
  it('renders a surface with the given role, label and id, its children, and a title header whose close button calls onClose', () => {
    const onClose = vi.fn();
    renderSurface({ title: 'Select manuscript', closeLabel: 'Close manuscript picker', closeButton: 'always', onClose });

    const dialog = screen.getByRole('dialog', { name: 'Select manuscript' });
    expect(dialog).toHaveAttribute('id', 'picker');
    expect(dialog).toHaveTextContent('First manuscript');
    expect(screen.getByText('Select manuscript')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close manuscript picker' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the close button with inline-flex for always and hidden md:inline-flex for md', () => {
    const { unmount } = renderSurface({ closeButton: 'always' });
    expect(classes(screen.getByRole('button', { name: 'Close' }))).toContain('inline-flex');
    unmount();

    renderSurface({ closeButton: 'md' });
    const button = classes(screen.getByRole('button', { name: 'Close' }));
    expect(button).toContain('hidden');
    expect(button).toContain('md:inline-flex');
  });

  it('renders an aria-hidden md:hidden scrim that closes on click for below-md, and no scrim for none', () => {
    const onClose = vi.fn();
    const { unmount } = renderSurface({ scrim: 'below-md', onClose });

    const scrim = screen.getByTestId('surface-scrim');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    expect(classes(scrim)).toContain('md:hidden');
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    renderSurface({ scrim: 'none' });
    expect(screen.queryByTestId('surface-scrim')).not.toBeInTheDocument();
  });
});

describe('Scrim', () => {
  it('renders an aria-hidden div that calls onClose on click', () => {
    const onClose = vi.fn();
    render(<Scrim onClose={onClose} />);

    const scrim = screen.getByTestId('surface-scrim');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adds md:hidden only when belowMdOnly is set', () => {
    const { unmount } = render(<Scrim onClose={vi.fn()} />);
    expect(classes(screen.getByTestId('surface-scrim'))).not.toContain('md:hidden');
    unmount();

    render(<Scrim onClose={vi.fn()} belowMdOnly />);
    expect(classes(screen.getByTestId('surface-scrim'))).toContain('md:hidden');
  });
});
