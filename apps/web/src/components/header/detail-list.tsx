/**
 * Definition-list primitives shared by the editor and reader details panels.
 *
 * Both panels list the same kind of rows (a muted term and a value), so the
 * list padding, the row rhythm and the term/value styling live here instead of
 * being copied into each panel. Classes stay literal strings for Tailwind v4.
 */

import type { ReactNode } from 'react';

/** List styling: vertical rhythm, panel padding and the md trailing inset. */
export const DETAIL_LIST = 'flex flex-col gap-1.5 px-3 py-2 text-xs text-gray-600 md:pr-10';

/** Row styling: baseline-aligned term and value that may both shrink. */
export const DETAIL_ROW = 'flex min-w-0 items-baseline gap-2';

/** Muted term styling. */
export const DETAIL_TERM = 'shrink-0 text-gray-500';

/** Value styling; follows the term on the same baseline. */
export const DETAIL_VALUE = 'min-w-0 text-gray-900';

/** Props for {@link DetailList}. */
export interface DetailListProps {
  /** Rows rendered in reading order. */
  children: ReactNode;
}

/**
 * Definition list holding the detail rows in reading order.
 *
 * @param props - See {@link DetailListProps}.
 * @returns The list element.
 */
export function DetailList({ children }: DetailListProps) {
  return <dl className={DETAIL_LIST}>{children}</dl>;
}

/** Props for {@link DetailRow}. */
export interface DetailRowProps {
  /** Muted row label; omitted for plain single-value lines. */
  term?: string;
  /** Row value. */
  children: ReactNode;
}

/**
 * One detail row: a muted term when given, and always its value.
 *
 * @param props - See {@link DetailRowProps}.
 * @returns The row markup.
 */
export function DetailRow({ term, children }: DetailRowProps) {
  return (
    <div className={DETAIL_ROW}>
      {term !== undefined && <dt className={DETAIL_TERM}>{term}</dt>}
      <dd className={DETAIL_VALUE}>{children}</dd>
    </div>
  );
}
