/**
 * Output formatting for the OpenDraft CLI: the human-readable report
 * lines and the machine-readable `--json` report.
 */

/** One finding: its level, project-relative location, path and message. */
export interface Finding {
  level: 'error' | 'warning';
  location: string;
  path: string;
  message: string;
}

/** One finding as it appears in the `--json` report. */
export interface JsonFinding {
  location: string;
  path: string;
  message: string;
}

/** Machine-readable report: errors and warnings as separate arrays. */
export interface JsonReport {
  errors: JsonFinding[];
  warnings: JsonFinding[];
}

/**
 * Format a finding as one human-readable line.
 *
 * @param finding - Finding to format.
 * @returns `location (path): message`; when the finding carries no path,
 *          just `location: message`.
 */
export function formatFinding(finding: Finding): string {
  const subject = finding.path ? `${finding.location} (${finding.path})` : finding.location;
  return `${subject}: ${finding.message}`;
}

/**
 * Split findings into the `--json` report shape, preserving discovery
 * order within each level.
 *
 * @param findings - All findings from the run.
 * @returns Report with `errors` and `warnings` arrays.
 */
export function toJsonReport(findings: Finding[]): JsonReport {
  const pick = (level: 'error' | 'warning'): JsonFinding[] =>
    findings
      .filter((finding) => finding.level === level)
      .map(({ location, path, message }) => ({ location, path, message }));
  return { errors: pick('error'), warnings: pick('warning') };
}

/**
 * Print the run's findings in the selected output mode.
 *
 * JSON mode writes a single JSON object to stdout and nothing else.
 * Human mode writes every finding line to stderr and, when no errors were
 * found, the pass line to stdout.
 *
 * @param findings - All findings from the run.
 * @param json - Whether `--json` was requested.
 */
export function printReport(findings: Finding[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(toJsonReport(findings)));
    return;
  }
  for (const finding of findings) {
    console.error(formatFinding(finding));
  }
  if (!findings.some((finding) => finding.level === 'error')) {
    console.log('✓ Project validation passed.');
  }
}
