/**
 * Injectable interaction surface for `opendraft init`.
 *
 * The CLI defaults to a non-interactive implementation so scripted runs
 * and tests never block on stdin. A later task can replace the prompt
 * implementation with readline without changing the command.
 */

/** Interaction surface used by the init command. */
export interface InitIo {
  /** Whether prompts are available in the current environment. */
  interactive: boolean;
  /** Ask the user a question and resolve with the raw answer. */
  ask(question: string): Promise<string>;
}

/** Default init interaction: non-interactive, prompts reject. */
export const DEFAULT_INIT_IO: InitIo = {
  interactive: process.stdin.isTTY === true,
  ask(): Promise<string> {
    return Promise.reject(new Error('Interactive prompts are not available.'));
  },
};
