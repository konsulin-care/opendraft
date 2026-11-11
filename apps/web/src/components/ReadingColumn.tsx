import type { ReactNode } from 'react';

/** Props for {@link ReadingColumn}. */
export interface ReadingColumnProps {
  /** Content rendered inside the shared reading column. */
  children: ReactNode;
}

/**
 * Shared reading column wrapper: the single component both the manuscript
 * view and the source view render their content through, so every reading
 * surface shares the one `.reading-column` rule in index.css (80% width,
 * equal gutters, 48rem cap).
 *
 * @param props - See {@link ReadingColumnProps}.
 * @returns A div carrying the shared `.reading-column` class.
 */
export function ReadingColumn({ children }: ReadingColumnProps) {
  return <div className="reading-column">{children}</div>;
}
