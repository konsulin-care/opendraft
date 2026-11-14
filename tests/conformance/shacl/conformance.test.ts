/**
 * SHACL conformance gate (behavior T29).
 *
 * Runs the SHACL conformance runner as a child process —
 * `node --import tsx tests/conformance/shacl/run-conformance.ts` —
 * and asserts exit code 0. The runner itself checks that valid
 * fixtures and protocol examples report zero violations and that
 * every invalid fixture reports at least one violation, so exit
 * code 0 gates the whole conformance matrix in the root vitest
 * suite.
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

/** Repo-root-relative path of the SHACL conformance runner. */
const RUNNER = 'tests/conformance/shacl/run-conformance.ts';

/** Repo root, resolved from this file so the test never depends on cwd. */
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** Generous timeout: the runner loads every shapes and fixture graph. */
const TIMEOUT_MS = 120_000;

interface RunnerFailure {
  code?: number;
  stdout?: string;
  stderr?: string;
}

/**
 * Extract the numeric exit code from a rejected execFile call.
 *
 * @param error - Rejection value from the promisified execFile call.
 * @returns The exit code when present, otherwise 1.
 */
function exitCodeOf(error: unknown): number {
  const failure = error as RunnerFailure;
  return typeof failure.code === 'number' ? failure.code : 1;
}

describe('SHACL conformance (run-conformance.ts)', () => {
  it(
    'exits 0: valid fixtures and examples conform, invalid fixtures fail',
    async () => {
      let stdout: string;
      let stderr: string;
      let exitCode = 0;
      try {
        const result = await execFileAsync(process.execPath, ['--import', 'tsx', RUNNER], {
          cwd: REPO_ROOT,
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (error) {
        // Non-zero exit rejects; keep the output for the assertion message.
        exitCode = exitCodeOf(error);
        const failure = error as RunnerFailure;
        stdout = failure.stdout ?? '';
        stderr = failure.stderr ?? '';
      }
      expect(
        exitCode,
        `run-conformance exited ${exitCode}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
      ).toBe(0);
    },
    TIMEOUT_MS,
  );
});
