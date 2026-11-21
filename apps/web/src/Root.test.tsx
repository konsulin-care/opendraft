// @vitest-environment jsdom
/**
 * Root dispatch tests: reader URLs render the reader page while `/` renders the
 * existing editor app.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Root } from './Root';
import type { ReaderRoute } from './reader/route';

vi.mock('./App.js', () => ({
  default: () => <div data-testid="app" />,
}));

vi.mock('./reader/ReaderPage.js', () => ({
  ReaderPage: (props: { route: ReaderRoute }) => (
    <div
      data-testid="reader-page"
      data-owner={props.route.owner}
      data-repo={props.route.repo}
    />
  ),
}));

describe('Root', () => {
  it('renders the existing App at /', () => {
    const { getByTestId, queryByTestId } = render(<Root pathname="/" />);
    expect(getByTestId('app')).toBeDefined();
    expect(queryByTestId('reader-page')).toBeNull();
  });

  it('renders ReaderPage with owner and repo for /konsulin-care/citizen-science', () => {
    const { getByTestId } = render(
      <Root pathname="/konsulin-care/citizen-science" />,
    );
    const page = getByTestId('reader-page');
    expect(page.getAttribute('data-owner')).toBe('konsulin-care');
    expect(page.getAttribute('data-repo')).toBe('citizen-science');
  });
});
