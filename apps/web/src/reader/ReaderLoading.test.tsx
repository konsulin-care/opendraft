// @vitest-environment jsdom
/**
 * ReaderLoading tests: the phase label per phase, the busy status region and
 * the first-visit note.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { LoadPhase } from './load-repo';
import { ReaderLoading } from './ReaderLoading';

/** Render the loading UI for one phase. */
function renderLoading(phase: LoadPhase, firstVisit = false) {
  return render(
    <ReaderLoading phase={phase} owner="octocat" repo="draft" firstVisit={firstVisit} />,
  );
}

describe('ReaderLoading', () => {
  it('renders the checking label with owner and repo inside a busy status region', () => {
    renderLoading('checking');

    const region = screen.getByTestId('reader-loading');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.getByText('Checking for the latest version of octocat/draft…'),
    ).toBeInTheDocument();
  });

  it('renders the agreed label for the opening, downloading, saving and preparing phases', () => {
    const cases: Array<[LoadPhase, string]> = [
      ['opening', 'Opening your saved copy…'],
      ['downloading', 'Downloading the manuscript from GitHub…'],
      ['saving', 'Saving a copy for faster loading next time…'],
      ['preparing', 'Preparing the manuscript…'],
    ];

    for (const [phase, label] of cases) {
      const { unmount } = renderLoading(phase);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('shows the first-visit note only when firstVisit is true', () => {
    const note =
      'The first visit downloads the manuscript. Next time it opens straight from your browser.';

    const { unmount } = renderLoading('opening', false);
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    unmount();

    renderLoading('opening', true);
    expect(screen.getByText(note)).toBeInTheDocument();
  });
});
