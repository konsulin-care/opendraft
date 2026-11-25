/**
 * Modal dialog for converting a plain repository into an OpenDraft project.
 *
 * Hosts the candidate checklist, runs the conversion with the chosen
 * decisions, and replaces the dialog body with the resulting pull request or
 * compare link. Failures are reported as an alert and submission is disabled
 * while the conversion runs.
 */

import { useState } from 'react';
import type { InitDecisions, ProjectDiscovery } from '@opendraft/manuscript';
import { ConvertChecklist } from './ConvertChecklist';
import type { ConvertResult } from './convert';

/** Props for {@link ConvertDialog}. */
export interface ConvertDialogProps {
  /** Read-only discovery result of the repository. */
  discovery: ProjectDiscovery;
  /** Default name for a new manuscript when nothing can be registered. */
  defaultId: string;
  /** Start the conversion with the chosen decisions and resolve with its result. */
  convert: (decisions: InitDecisions) => Promise<ConvertResult>;
  /** Close the dialog. */
  onClose: () => void;
}

/** Read a human-readable message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Track the conversion state and expose a runner for the chosen decisions. */
function useConversion(convert: (decisions: InitDecisions) => Promise<ConvertResult>) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (decisions: InitDecisions): Promise<void> => {
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

  return { running, result, error, run };
}

/** Render the conversion result link or error message. */
function ConvertOutcome(
  { result, error }: { result: ConvertResult | null; error: string | null },
) {
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
 * Render the conversion modal with the checklist and its outcome.
 *
 * @param props - See {@link ConvertDialogProps}.
 * @returns The modal dialog element.
 */
export function ConvertDialog({
  discovery,
  defaultId,
  convert,
  onClose,
}: ConvertDialogProps) {
  const { running, result, error, run } = useConversion(convert);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Convert to OpenDraft"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-black">Convert to OpenDraft</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <ConvertChecklist
          discovery={discovery}
          defaultId={defaultId}
          running={running}
          onSubmit={(decisions) => void run(decisions)}
        />
        <ConvertOutcome result={result} error={error} />
      </div>
    </div>
  );
}

export default ConvertDialog;
