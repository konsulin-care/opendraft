import { useEffect, useState } from 'react';

/** How long a transient notice stays visible, in milliseconds. */
export const NOTICE_MS = 4000;

/**
 * Keep a transient notice visible for a limited time.
 *
 * Whenever `notice` changes to a non-empty value it becomes visible and is
 * cleared again after `ms` milliseconds. This mirrors the header chip
 * behaviour so short-lived confirmations never stack up.
 *
 * @param notice - Notice text to show, or null/undefined when there is none.
 * @param ms - How long the notice stays visible, in milliseconds.
 * @returns The notice while it should be shown, otherwise null.
 */
export function useTransientNotice(
  notice: string | null | undefined,
  ms: number = NOTICE_MS,
): string | null {
  const [visible, setVisible] = useState<string | null>(notice ?? null);

  useEffect(() => {
    setVisible(notice ?? null);
    if (!notice) return undefined;
    const timer = setTimeout(() => setVisible(null), ms);
    return () => clearTimeout(timer);
  }, [notice, ms]);

  return visible;
}
