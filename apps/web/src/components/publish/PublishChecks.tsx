import type { Finding } from '@opendraft/validate';
import type { PreflightResult } from '../../publish/preflight';

/** Props for {@link PublishChecks}. */
export interface PublishChecksProps {
  /** True while preflight is still running. */
  running: boolean;
  /** Latest preflight result, or null before the first run finishes. */
  result: PreflightResult | null;
  /** Called with a finding's path when the user opens that file. */
  onOpenFile: (path: string) => void;
}

/** Pluralised heading for the number of blocking findings. */
function errorHeading(count: number): string {
  return count === 1
    ? '1 thing needs fixing before you send'
    : `${count} things need fixing before you send`;
}

/** One clickable finding row that opens the offending file. */
function FindingButton({
  finding,
  onOpenFile,
}: {
  /** Finding to show and open. */
  finding: Finding;
  /** Called with the finding's path. */
  onOpenFile: (path: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenFile(finding.path)}
        className="w-full rounded-md px-2 py-1 text-left text-sm text-gray-800 hover:bg-gray-100"
      >
        {finding.path} — {finding.message}
      </button>
    </li>
  );
}

/** Collapsed list of optional warnings. */
function WarningList({ warnings }: { warnings: Finding[] }) {
  if (warnings.length === 0) return null;
  return (
    <details className="mt-3 text-sm text-gray-700">
      <summary className="cursor-pointer font-medium">
        Worth a look (optional)
      </summary>
      <ul className="mt-1 space-y-1 pl-4">
        {warnings.map((warning) => (
          <li key={`${warning.path}:${warning.message}`}>
            {warning.path} — {warning.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Preflight checklist shown before publishing or sending a draft. Reports the
 * running and clean states, lists blocking findings as file-opening buttons,
 * and keeps optional warnings collapsed.
 *
 * @param props - See {@link PublishChecksProps}.
 */
export function PublishChecks({ running, result, onOpenFile }: PublishChecksProps) {
  if (running) {
    return <p role="status">Checking your manuscript…</p>;
  }
  if (result === null) return null;

  return (
    <div>
      {result.ok ? (
        <p role="status">✓ Your manuscript is ready</p>
      ) : (
        <>
          <p className="font-medium text-red-700">{errorHeading(result.errors.length)}</p>
          <ul className="mt-1 space-y-1">
            {result.errors.map((finding) => (
              <FindingButton
                key={`${finding.path}:${finding.message}`}
                finding={finding}
                onOpenFile={onOpenFile}
              />
            ))}
          </ul>
        </>
      )}
      <WarningList warnings={result.warnings} />
    </div>
  );
}
