import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCommand } from '../src/commands/init.js';

/** Captured output and prompt questions for one interactive run. */
interface InteractiveRun {
  /** Exit code resolved by the command. */
  code: number;
  /** Questions passed to the fake interaction surface. */
  questions: string[];
}

let dir: string;

/**
 * Write a registrable legacy manuscript directly into the temp project.
 *
 * @param id - Manuscript folder name.
 */
function writeManuscript(id: string): void {
  const path = join(dir, 'manuscripts', id);
  mkdirSync(path, { recursive: true });
  const article = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

::: {#refs}
:::
`;
  writeFileSync(join(path, 'article.qmd'), article);
  writeFileSync(join(path, '_author.yml'), 'authors: []\naffiliations: []\n');
  writeFileSync(join(path, '_abstract.yml'), 'abstract: ""\n');
  writeFileSync(join(path, '_frontmatter.yml'), 'title: "Existing"\n');
}

/**
 * Write a valid project configuration listing one manuscript.
 *
 * @param id - Manuscript id to list.
 * @returns The configuration text written.
 */
function writeConfig(id: string): string {
  const revision = 'e849ba8a46528d523d5f3d18f5f0171853f13030';
  const config = `protocol:
  name: opendraft
  version: ${revision}
  repository: https://github.com/konsulin-care/opendraft
  commit: ${revision}
manuscripts:
  - id: ${id}
    path: manuscripts/${id}
`;
  writeFileSync(join(dir, 'opendraft.yml'), config);
  writeFileSync(join(dir, 'references.bib'), '@book{example}\n');
  return config;
}

/**
 * Run initCommand interactively with an answer to the first prompt.
 *
 * @param args - Arguments passed to initCommand.
 * @param answer - Answer returned by the fake interaction surface.
 * @returns Promise of the exit code plus the questions that were asked.
 */
async function runInteractive(args: string[], answer: string): Promise<InteractiveRun> {
  const questions: string[] = [];
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
  try {
    const code = await initCommand(args, {
      interactive: true,
      ask: (question: string) => {
        questions.push(question);
        return Promise.resolve(answer);
      },
    });
    return { code, questions };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-interactive-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('init — interactive unlisted prompt', () => {
  it('appends case-series-review to opendraft.yml when answering y', async () => {
    writeManuscript('paper');
    writeConfig('paper');
    writeManuscript('case-series-review');

    const run = await runInteractive([dir], 'y');

    expect(run.code).toBe(0);
    expect(run.questions).toEqual([
      'Add 1 unlisted manuscript(s) (case-series-review) to opendraft.yml? [y/N] ',
    ]);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toContain('case-series-review');
  });

  it('resolves 0 and leaves opendraft.yml unchanged when answering n', async () => {
    writeManuscript('paper');
    const config = writeConfig('paper');
    writeManuscript('case-series-review');

    const run = await runInteractive([dir], 'n');

    expect(run.code).toBe(0);
    expect(run.questions).toEqual([
      'Add 1 unlisted manuscript(s) (case-series-review) to opendraft.yml? [y/N] ',
    ]);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(config);
  });
});

describe('init — interactive project name prompt', () => {
  it('scaffolds manuscripts/my-paper from the normalized answer when no candidates exist', async () => {
    const run = await runInteractive([dir], 'My Paper');

    expect(run.code).toBe(0);
    expect(run.questions).toEqual(['No manuscripts found. Project name: ']);
    expect(existsSync(join(dir, 'manuscripts', 'my-paper', 'article.qmd'))).toBe(true);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toContain('my-paper');
  });
});
