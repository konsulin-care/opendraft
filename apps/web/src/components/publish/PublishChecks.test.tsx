// @vitest-environment jsdom
/**
 * Preflight checklist tests: the running and ready states, blocking errors
 * that open the offending file, and collapsed optional warnings.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Finding } from '@opendraft/validate';
import type { PreflightResult } from '../../publish/preflight';
import { PublishChecks } from './PublishChecks';

/** Build one validation finding for the checklist tests. */
function finding(level: Finding['level'], path: string, message: string): Finding {
  return { level, location: 'manuscripts/demo', path, message };
}

/** Build a preflight result from error and warning findings. */
function result(
  errors: Finding[] = [],
  warnings: Finding[] = [],
): PreflightResult {
  return { ok: errors.length === 0, errors, warnings };
}

describe('PublishChecks progress', () => {
  it('shows the running message while checking', () => {
    render(<PublishChecks running result={null} onOpenFile={vi.fn()} />);

    expect(screen.getByText('Checking your manuscript…')).toBeInTheDocument();
  });

  it('confirms a clean manuscript when there are no errors', () => {
    render(<PublishChecks running={false} result={result()} onOpenFile={vi.fn()} />);

    expect(screen.getByText('✓ Your manuscript is ready')).toBeInTheDocument();
  });
});

describe('PublishChecks error counts', () => {
  it('counts blocking findings in the plural', () => {
    render(
      <PublishChecks
        running={false}
        result={result([
          finding('error', 'manuscripts/demo/article.qmd', 'bad assembly'),
          finding('error', 'manuscripts/demo/refs.bib', 'missing citation'),
        ])}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByText('2 things need fixing before you send')).toBeInTheDocument();
  });

  it('uses the singular for one blocking finding', () => {
    render(
      <PublishChecks
        running={false}
        result={result([finding('error', 'article.qmd', 'bad assembly')])}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByText('1 thing needs fixing before you send')).toBeInTheDocument();
  });

});

describe('PublishChecks error actions', () => {
  it('opens the offending file from each finding', () => {
    const onOpenFile = vi.fn();
    render(
      <PublishChecks
        running={false}
        result={result([
          finding('error', 'manuscripts/demo/article.qmd', 'bad assembly'),
          finding('error', 'references.bib', 'missing citation'),
        ])}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'manuscripts/demo/article.qmd — bad assembly',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'references.bib — missing citation' }),
    );

    expect(onOpenFile).toHaveBeenNthCalledWith(1, 'manuscripts/demo/article.qmd');
    expect(onOpenFile).toHaveBeenNthCalledWith(2, 'references.bib');
  });
});

describe('PublishChecks warnings', () => {
  it('renders warnings collapsed under the optional summary', () => {
    render(
      <PublishChecks
        running={false}
        result={result([], [finding('warning', 'article.qmd', 'missing doi')])}
        onOpenFile={vi.fn()}
      />,
    );

    const summary = screen.getByText('Worth a look (optional)');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('article.qmd — missing doi')).toBeInTheDocument();
  });
});
