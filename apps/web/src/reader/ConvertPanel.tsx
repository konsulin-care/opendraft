/**
 * Repository conversion panel for the reader.
 *
 * Shown when a repository has no `opendraft.yml`. Anonymous visitors get a
 * sign-in link; signed-in users get a checklist of existing manuscripts and
 * can start the conversion, then follow the resulting pull request or compare
 * URL. Conversion errors are shown inline and re-enable the trigger.
 */

import { useState } from 'react';
import type { InitDecisions, ProjectDiscovery } from '@opendraft/manuscript';
import type { BffSession } from '../github/bff-client';
import { loginUrl } from '../github/bff-client';
import { ConvertChecklist } from './ConvertChecklist';
import type { ConvertResult } from './convert';

/** Props for {@link ConvertPanel}. */
export interface ConvertPanelProps {
  /** Signed-in session, or null for an anonymous visitor. */
  session: BffSession | null;
  /** Reader path returned to after sign-in. */
  returnTo: string;
  /** Read-only discovery result of the repository. */
  discovery: ProjectDiscovery;
  /** Default name for a new manuscript when nothing can be registered. */
  defaultId: string;
  /** Start the conversion with the chosen decisions and resolve with its result. */
  convert: (decisions: InitDecisions) => Promise<ConvertResult>;
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
 * Render the conversion prompt, checklist, action and outcome.
 *
 * @param props - See {@link ConvertPanelProps}.
 * @returns The panel with a sign-in link or the conversion checklist.
 */
export function ConvertPanel({
  session,
  returnTo,
  discovery,
  defaultId,
  convert,
  loginEnabled = true,
}: ConvertPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Run the conversion with the chosen decisions, tracking its state. */
  const handleConvert = async (decisions: InitDecisions): Promise<void> => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(await convert(decisions));
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
        <>
          <ConvertChecklist
            discovery={discovery}
            defaultId={defaultId}
            running={running}
            onSubmit={(decisions) => void handleConvert(decisions)}
          />
          <ConvertOutcome result={result} error={error} />
        </>
      )}
    </section>
  );
}
