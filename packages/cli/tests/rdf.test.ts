import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../src/index.js';

let dir: string;

/** Run the CLI capturing console output. */
async function runCapture(args: string[]): Promise<{ code: number; output: string }> {
  const lines: string[] = [];
  const capture = (...data: unknown[]): void => {
    lines.push(data.map(String).join(' '));
  };
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(capture),
    vi.spyOn(console, 'error').mockImplementation(capture),
  ];
  try {
    return { code: await runCommand(args), output: lines.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/** Write a project with one manuscript `paper` and the given frontmatter. */
function scaffold(frontmatter: string): void {
  writeFileSync(
    join(dir, 'opendraft.yml'),
    'manuscripts:\n  - id: paper\n    path: manuscripts/paper\n',
  );
  const ms = join(dir, 'manuscripts', 'paper');
  mkdirSync(join(ms, 'blocks'), { recursive: true });
  writeFileSync(join(ms, '_frontmatter.yml'), frontmatter);
  writeFileSync(join(ms, 'blocks', '_intro.qmd'), '# Intro {#sec-intro}\n\nText.\n');
  writeFileSync(join(ms, 'paper.qmd'), '{{< include blocks/_intro.qmd >}}\n');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'od-rdf-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('opendraft rdf', () => {
  it('prints Turtle rooted at the draft IRI', async () => {
    scaffold('title: A Paper\n');
    const { code, output } = await runCapture(['rdf', dir, '-m', 'paper']);
    expect(output).toContain('<https://w3id.org/opendraft/draft/paper>');
    expect(code).toBe(0);
  });

  it('resolves 1 on invalid metadata', async () => {
    scaffold('title: [unclosed\n');
    const { code, output } = await runCapture(['rdf', dir, '-m', 'paper']);
    expect(code).toBe(1);
    expect(output).toContain('_frontmatter.yml');
  });
});
