/**
 * Banner for manuscript folders that exist in an OpenDraft project but are
 * missing from `opendraft.yml`.
 *
 * Lists every unlisted id as a checked checkbox and lets a signed-in viewer
 * register them, then links to the resulting pull request or compare URL.
 */

import { useState } from 'react';
import type { ProjectDiscovery } from '@opendraft/manuscript';
import type { BffSession } from '../github/bff-client';
import type { ConvertResult } from './convert';

/** Props for {@link UnlistedBanner}. */
export interface UnlistedBannerProps {
  /** Read-only discovery result with non-empty `unlisted` ids. */
  discovery: ProjectDiscovery;
  /** Signed-in session, or null for an anonymous viewer. */
  session: BffSession | null;
  /** Register the selected ids and resolve with the pull request or compare result. */
  register: (ids: string[]) => Promise<ConvertResult>;
}

/** Read a human-readable message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Render the registration result link or error message. */
function RegisterOutcome({
  result,
  error,
}: {
  result: ConvertResult | null;
  error: string | null;
}) {
  return (
    <>
      {result?.kind === 'pr' ? (
        <a href={result.url} className="text-sm font-medium text-inline-code underline">
          View pull request
        </a>
      ) : null}
      {result?.kind === 'compare' ? (
        <a href={result.url} className="text-sm font-medium text-inline-code underline">
          Open pull request on GitHub
        </a>
      ) : null}
      {error !== null ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Render the checked checkbox per unlisted id. */
function UnlistedChecklist({
  ids,
  checked,
  onToggle,
}: {
  ids: string[];
  checked: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {ids.map((id) => (
        <li key={id}>
          <label className="flex items-center gap-2 text-sm font-medium text-black">
            <input
              type="checkbox"
              checked={checked.includes(id)}
              onChange={() => onToggle(id)}
            />
            {id}
          </label>
        </li>
      ))}
    </ul>
  );
}

/**
 * Render the unlisted-manuscript checklist and registration action.
 *
 * @param props - See {@link UnlistedBannerProps}.
 * @returns The banner with checked checkboxes and the add button.
 */
export function UnlistedBanner({ discovery, session, register }: UnlistedBannerProps) {
  const [checked, setChecked] = useState<string[]>(() => [...discovery.unlisted]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Toggle one unlisted id in the checked list. */
  const toggle = (id: string): void => {
    setChecked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  /** Register the checked ids and track the outcome. */
  const submit = async (): Promise<void> => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(await register(checked));
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-outline p-4">
      <p className="text-sm text-black">
        {discovery.unlisted.length} manuscript(s) not listed in opendraft.yml
      </p>
      <UnlistedChecklist ids={discovery.unlisted} checked={checked} onToggle={toggle} />
      <button
        type="button"
        disabled={running || session === null || checked.length === 0}
        onClick={() => void submit()}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Add to opendraft.yml
      </button>
      <RegisterOutcome result={result} error={error} />
    </section>
  );
}

export default UnlistedBanner;
