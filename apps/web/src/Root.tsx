import { lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { parseReaderRoute } from './reader/route.js';

const App = lazy(() => import('./App.js'));

const ReaderPage = lazy(() =>
  import('./reader/ReaderPage.js').then((module) => ({
    default: module.ReaderPage,
  })),
);

/** Centered, accessible status indicator shown while a route chunk loads. */
function RouteLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="route-loading"
      className="flex min-h-screen items-center justify-center"
    >
      <LoaderCircle
        aria-hidden="true"
        className="h-6 w-6 animate-spin motion-reduce:animate-none"
      />
    </div>
  );
}

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
  return (
    <Suspense fallback={<RouteLoading />}>
      {route ? <ReaderPage route={route} /> : <App />}
    </Suspense>
  );
}

export default Root;
