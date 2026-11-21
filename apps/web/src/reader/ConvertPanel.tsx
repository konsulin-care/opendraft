/**
 * Repository conversion panel for the reader.
 *
 * Shown when a repository has no `opendraft.yml`. Anonymous visitors get a
 * sign-in link; signed-in users can start the conversion and follow the
 * resulting pull request or compare URL. Conversion errors are shown inline
 * and re-enable the trigger.
 */

import { useState } from 'react';
import type { BffSession } from '../github/bff-client';
import { loginUrl } from '../github/bff-client';
import type { ConvertResult } from './convert';

/** Props for {@link ConvertPanel}. */
export interface ConvertPanelProps {
  /** Signed-in session, or null for an anonymous visitor. */
  session: BffSession | null;
  /** Reader path returned to after sign-in. */
  returnTo: string;
  /** Start the conversion and resolve with its PR or compare result. */
  convert: () => Promise<ConvertResult>;
  /** Whether GitHub login is configured; defaults to true. */
  loginEnabled?: boolean;
}

/** Read a human-readable message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Render the anonymous sign-in link. */
function SignInLink({ returnTo }: { returnTo: string }) {
  return (
    <a
      href={loginUrl(returnTo)}
      className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white"
    >
      Sign in with GitHub to convert
    </a>
  );
}

/** Render the conversion trigger. */
function ConvertButton({ running, onClick }: { running: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={running}
      onClick={onClick}
      className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
    >
      Convert to OpenDraft
    </button>
  );
}

/** Render the conversion result link or error message. */
function ConvertOutcome({ result, error }: { result: ConvertResult | null; error: string | null }) {
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

/**
 * Render the conversion prompt, action and outcome.
 *
 * @param props - See {@link ConvertPanelProps}.
 * @returns The panel with a sign-in link or the conversion controls.
 */
export function ConvertPanel({
  session,
  returnTo,
  convert,
  loginEnabled = true,
}: ConvertPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Run the conversion, tracking its running, error and result state. */
  const handleConvert = async (): Promise<void> => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(await convert());
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-outline p-4">
      <p className="text-sm text-black">This repository is not an OpenDraft project yet.</p>
      {!loginEnabled ? (
        <p className="text-sm text-muted">
          Conversion needs the GitHub app configured on this server.
        </p>
      ) : session === null ? (
        <SignInLink returnTo={returnTo} />
      ) : (
        <div className="flex flex-col gap-2">
          <ConvertButton running={running} onClick={() => void handleConvert()} />
          <ConvertOutcome result={result} error={error} />
        </div>
      )}
    </section>
  );
}
