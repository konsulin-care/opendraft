import { validateProject } from '@opendraft/validate';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { printReport, type Finding } from '../output.js';
import { cliProtocolOptions } from '../protocol.js';

/**
 * Run the `validate` command by delegating to validateProject.
 *
 * @param args - Optional project root (defaults to cwd) plus the flags
 *               `--json`, `--offline` and `--release`.
 * @returns Exit code: 0 when no errors (warnings allowed), 1 otherwise.
 */
export async function validateCommand(args: string[]): Promise<number> {
  const json = args.includes('--json');
  const offline = args.includes('--offline');
  const release = args.includes('--release');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const root = positional[0] ?? process.cwd();
  const found = await validateProject(new NodeFsWorkspace(root), {
    ...cliProtocolOptions({ offline }),
    offline,
    release,
  });
  const findings: Finding[] = found.flatMap((finding) =>
    finding.level === 'info' ? [] : [{ ...finding, level: finding.level }],
  );
  printReport(findings, json);
  return findings.some((finding) => finding.level === 'error') ? 1 : 0;
}
