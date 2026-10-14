import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, act } from '@testing-library/react';
import { CitekeyTooltip } from './citekey-tooltip';
import type { Reference } from '@opendraft/references';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const computePositionMock = vi.fn().mockResolvedValue({ x: 120, y: 200, placement: 'bottom' });

vi.mock('@floating-ui/dom', () => ({
  computePosition: (...args: unknown[]) => computePositionMock(...args),
  flip: vi.fn().mockReturnValue('flip-middleware'),
  shift: vi.fn().mockReturnValue('shift-middleware'),
  offset: vi.fn().mockReturnValue('offset-middleware'),
}));

const mockRef: Reference = {
  citeKey: 'smith2024',
  entryType: 'article',
  fields: {
    author: 'Smith, John',
    year: '2024',
    title: 'A Test Article',
    journal: 'Test Journal',
    volume: '10',
    number: '2',
    pages: '100-120',
    doi: '10.1000/test',
  },
};

function createMockAnchor() {
  const anchor = document.createElement('span');
  anchor.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 100, left: 100, width: 50, height: 20, bottom: 120, right: 150,
  });
  document.body.appendChild(anchor);
  return anchor;
}

beforeEach(() => {
  computePositionMock.mockClear();
  computePositionMock.mockResolvedValue({ x: 120, y: 200, placement: 'bottom' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CitekeyTooltip — rendering', () => {
  it('renders APA-formatted citation', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Smith, J.');
    expect(tooltip.textContent).toContain('2024');
    expect(tooltip.textContent).toContain('A Test Article');
    document.body.removeChild(anchor);
  });

  it('does not render when reference is null', () => {
    const anchor = createMockAnchor();
    const { container } = render(
      <CitekeyTooltip reference={null} anchorEl={anchor} onClose={() => {}} />,
    );
    expect(container.querySelector('.citekey-tooltip')).not.toBeInTheDocument();
    document.body.removeChild(anchor);
  });

  it('does not render when anchorEl is null', () => {
    const { container } = render(
      <CitekeyTooltip reference={mockRef} anchorEl={null} onClose={() => {}} />,
    );
    expect(container.querySelector('.citekey-tooltip')).not.toBeInTheDocument();
  });
});

describe('CitekeyTooltip — Floating UI positioning', () => {
  it('calls computePosition with correct middleware', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    });

    expect(computePositionMock).toHaveBeenCalledTimes(1);
    const [ref, , options] = computePositionMock.mock.calls[0];
    expect(ref).toBe(anchor);
    expect(options).toMatchObject({ placement: 'bottom' });
    expect(options.middleware).toEqual([
      'offset-middleware',
      'flip-middleware',
      'shift-middleware',
    ]);
    document.body.removeChild(anchor);
  });

  it('applies computed position to tooltip style', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.style.position).toBe('fixed');
    expect(tooltip.style.top).toBe('200px');
    expect(tooltip.style.left).toBe('120px');
    document.body.removeChild(anchor);
  });

  it('tooltip has pointer-events: none', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('citekey-tooltip');
    document.body.removeChild(anchor);
  });
});

describe('CitekeyTooltip — position updates', () => {
  it('recomputes position on scroll', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    });

    expect(computePositionMock).toHaveBeenCalledTimes(1);

    computePositionMock.mockResolvedValueOnce({ x: 10, y: 300, placement: 'top' });
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(computePositionMock).toHaveBeenCalledTimes(2);
    document.body.removeChild(anchor);
  });

  it('recomputes position on resize', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    });

    expect(computePositionMock).toHaveBeenCalledTimes(1);

    computePositionMock.mockResolvedValueOnce({ x: 50, y: 10, placement: 'top' });
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(computePositionMock).toHaveBeenCalledTimes(2);
    document.body.removeChild(anchor);
  });
});

describe('CitekeyTooltip — cleanup', () => {
  it('cleans up scroll/resize listeners on unmount', async () => {
    const anchor = createMockAnchor();
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    let unmount: () => void;
    await act(async () => {
      const result = render(
        <CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />,
      );
      unmount = result.unmount;
    });

    unmount!();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeEventListenerSpy.mockRestore();
    document.body.removeChild(anchor);
  });
});

describe('CitekeyTooltip — no callout arrow', () => {
  it('does not have data-placement attribute', async () => {
    const anchor = createMockAnchor();
    await act(async () => {
      render(<CitekeyTooltip reference={mockRef} anchorEl={anchor} onClose={() => {}} />);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).not.toHaveAttribute('data-placement');
    document.body.removeChild(anchor);
  });
});

describe('CitekeyTooltip — CSS restyle', () => {
  const cssPath = resolve(__dirname, '../index.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('has no dark background color in citekey-tooltip rule', () => {
    const ruleMatch = css.match(/\.citekey-tooltip\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    const rule = ruleMatch![1];
    expect(rule).not.toContain('#1e293b');
  });

  it('has white background, dark text, and border', () => {
    const ruleMatch = css.match(/\.citekey-tooltip\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    const rule = ruleMatch![1];
    expect(rule).toContain('background: #ffffff');
    expect(rule).toContain('color: #212529');
    expect(rule).toContain('border: 1px solid #adb5bd');
  });

  it('has no ::after pseudo-element for callout arrow', () => {
    expect(css).not.toMatch(/\.citekey-tooltip::after/);
  });

  it('has no data-placement arrow rule', () => {
    expect(css).not.toMatch(/\.citekey-tooltip\[data-placement/);
  });

  it('has pointer-events: none', () => {
    const ruleMatch = css.match(/\.citekey-tooltip\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    const rule = ruleMatch![1];
    expect(rule).toContain('pointer-events: none');
  });

  it('has border-radius: 8px to match citation-dropdown', () => {
    const ruleMatch = css.match(/\.citekey-tooltip\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    const rule = ruleMatch![1];
    expect(rule).toContain('border-radius: 8px');
  });
});
