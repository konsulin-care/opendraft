/**
 * Injectable interaction surface for `opendraft init`.
 *
 * The CLI defaults to a readline-backed implementation when stdin is a TTY,
 * so scripted runs and tests never block on stdin. Tests can supply a fake
 * {@link InitIo} to answer prompts deterministically.
 */
import type { InitPlan, ProjectDiscovery } from '@opendraft/manuscript';
import { createInterface } from 'node:readline/promises';

/** Interaction surface used by the init command. */
export interface InitIo {
  /** Whether prompts are available in the current environment. */
  interactive: boolean;
  /** Ask the user a question and resolve with the raw answer. */
  ask(question: string): Promise<string>;
}

/**
 * Ask one question on stdin and stdout through a short-lived readline
 * interface.
 *
 * @param question - Prompt text written before reading the answer.
 * @returns Promise of the raw answer line.
 */
async function askWithReadline(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

/**
 * Report rejected manuscript folders discovered under `manuscripts/`.
 *
 * Rejections and id suggestions are diagnostics, so they go to stderr and
 * never affect the command result.
 *
 * @param discovery - Read-only discovery result for the project.
 */
export function reportRejections(discovery: ProjectDiscovery): void {
  for (const candidate of discovery.candidates) {
    if (candidate.status !== 'rejected') continue;
    console.error(`${candidate.path}: rejected (${candidate.reason})`);
    if (candidate.suggestedId !== undefined) {
      console.error(`suggested id: ${candidate.suggestedId}`);
    }
  }
}

/**
 * Report warnings for registered candidates and created files from a plan.
 *
 * Warnings go to stderr; files the plan will create go to stdout. Reporting
 * is best-effort and never changes the exit code.
 *
 * @param plan - Planned file operations and registration warnings.
 * @param reportCreates - True to list created files on stdout.
 */
export function reportPlan(plan: InitPlan, reportCreates: boolean): void {
  for (const { id, warning } of plan.warnings) {
    console.error(`${id}: warning ${warning}`);
  }
  if (!reportCreates) return;
  for (const file of plan.files) {
    if (file.op === 'create') console.log(`${file.path}: created`);
  }
}

/** Default init interaction: readline prompts when stdin is a TTY. */
export const DEFAULT_INIT_IO: InitIo = {
  interactive: process.stdin.isTTY === true,
  ask(question: string): Promise<string> {
    if (process.stdin.isTTY !== true) {
      return Promise.reject(new Error('Interactive prompts are not available.'));
    }
    return askWithReadline(question);
  },
};
