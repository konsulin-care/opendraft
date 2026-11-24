// @vitest-environment jsdom
/**
 * Root dispatch tests: reader URLs render the reader page while `/` renders the
 * existing editor app, and pending route chunks show the loading indicator.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('./App.js');
  });

  it('renders the existing App at /', async () => {
    const { findByTestId, queryByTestId } = render(<Root pathname="/" />);
    expect(await findByTestId('app')).toBeDefined();
    expect(queryByTestId('reader-page')).toBeNull();
  });

  it('renders ReaderPage with owner and repo for /konsulin-care/citizen-science', async () => {
    const { findByTestId } = render(
      <Root pathname="/konsulin-care/citizen-science" />,
    );
    const page = await findByTestId('reader-page');
    expect(page.getAttribute('data-owner')).toBe('konsulin-care');
    expect(page.getAttribute('data-repo')).toBe('citizen-science');
  });

  it('shows the route loading status while a route chunk is pending', async () => {
    vi.resetModules();
    vi.doMock('./App.js', () => new Promise(() => undefined));

    const { Root: IsolatedRoot } = await import('./Root');
    const { findByTestId } = render(<IsolatedRoot pathname="/" />);

    const status = await findByTestId('route-loading');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
  });
});
