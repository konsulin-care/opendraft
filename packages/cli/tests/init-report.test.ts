import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCommand } from '../src/commands/init.js';

/** Captured output split by stream for one init run. */
interface Captured {
  /** Exit code resolved by the command. */
  code: number;
  /** Everything printed to stdout. */
  stdout: string;
  /** Everything printed to stderr. */
  stderr: string;
}

let dir: string;

/** Front matter listing every metadata file and the shared bibliography. */
const COMPLETE_ARTICLE = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

::: {#refs}
:::
`;

/** Write a complete article.qmd plus the three metadata starter files. */
function writeCompleteManuscript(id: string, article = COMPLETE_ARTICLE): void {
  const path = join(dir, 'manuscripts', id);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'article.qmd'), article);
  writeFileSync(join(path, '_author.yml'), 'authors: []\naffiliations: []\n');
  writeFileSync(join(path, '_abstract.yml'), 'abstract: ""\n');
  writeFileSync(join(path, '_frontmatter.yml'), 'title: "Existing"\n');
}

/** Run init with stdout and stderr captured separately. */
async function capture(args: string[]): Promise<Captured> {
  const out: string[] = [];
  const err: string[] = [];
  const spies = [
    vi.spyOn(console, 'log').mockImplementation((...data: unknown[]) => {
      out.push(data.map(String).join(' '));
    }),
    vi.spyOn(console, 'error').mockImplementation((...data: unknown[]) => {
      err.push(data.map(String).join(' '));
    }),
  ];
  try {
    const code = await initCommand(args, {
      interactive: false,
      ask: () => Promise.resolve('ignored'),
    });
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-report-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('init — discovery reporting', () => {
  it('reports an invalid folder with its suggested id and still registers another candidate', async () => {
    writeCompleteManuscript('Case_Series');
    writeCompleteManuscript('paper');

    const run = await capture([dir]);

    expect(run.code).toBe(0);
    expect(run.stderr).toContain('manuscripts/Case_Series: rejected (invalid-id)');
    expect(run.stderr).toContain('suggested id: case-series');
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toContain('paper');
  });

  it('reports a bibliography warning on stderr but still registers the manuscript', async () => {
    writeCompleteManuscript(
      'case-series-review',
      COMPLETE_ARTICLE.replace('../references.bib', 'references.bib'),
    );

    const run = await capture([dir]);

    expect(run.code).toBe(0);
    expect(run.stderr).toContain('case-series-review: warning bibliography-mismatch');
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toContain('case-series-review');
  });

  it('prints the metadata file created for a repairable candidate on stdout', async () => {
    const path = join(dir, 'manuscripts', 'draft');
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'article.qmd'), COMPLETE_ARTICLE);
    writeFileSync(join(path, '_abstract.yml'), 'abstract: ""\n');
    writeFileSync(join(path, '_frontmatter.yml'), 'title: "Draft"\n');

    const run = await capture([dir]);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('manuscripts/draft/_author.yml: created');
  });
});
