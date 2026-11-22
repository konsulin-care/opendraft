/**
 * Injectable interaction surface for `opendraft init`.
 *
 * The CLI defaults to a readline-backed implementation when stdin is a TTY,
 * so scripted runs and tests never block on stdin. Tests can supply a fake
 * {@link InitIo} to answer prompts deterministically.
 */
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
