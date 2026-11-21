import App from './App.js';
import { ReaderPage } from './reader/ReaderPage.js';
import { parseReaderRoute } from './reader/route.js';

/** Props for {@link Root}. */
export interface RootProps {
  /** Pathname to route on; defaults to the current browser location. */
  pathname?: string;
}

/**
 * Root dispatcher: render the read-only reader for reader URLs, otherwise the
 * editor app.
 *
 * @param props - Optional pathname override, primarily for tests.
 * @returns The reader page when the path parses as a repository route, else App.
 */
export function Root({ pathname = window.location.pathname }: RootProps) {
  const route = parseReaderRoute(pathname);
  return route ? <ReaderPage route={route} /> : <App />;
}

export default Root;
