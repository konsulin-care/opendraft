import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockRail } from './BlockRail';
import { seedWorkspace } from '../seed';

// @vitest-environment jsdom

describe('BlockRail', () => {
  let workspace: MemoryWorkspace;

  beforeEach(async () => {
    workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);
  });

  it('lists included sections with a draft flag on draft blocks', async () => {
    await workspace.writeFile('article.qmd', '{{< include blocks/intro.qmd >}}');
    await workspace.writeFile('blocks/intro.qmd', '# Introduction {#intro}\n\nbody');
    await workspace.writeFile('blocks/scratch.qmd', '# Scratch {#scratch}\n\nnotes');

    render(<BlockRail workspace={workspace} />);
    await waitFor(() => expect(screen.getByText('Introduction')).toBeDefined());

    const drafts = screen.getByText('Drafts');
    expect(drafts).toBeDefined();
    expect(screen.getByText('Scratch')).toBeDefined();
    expect(screen.getByText('draft')).toBeDefined();
  });

  it('dims other sections when one section is focused', async () => {
    await workspace.writeFile('article.qmd', [
      '{{< include blocks/intro.qmd >}}',
      '{{< include blocks/methods.qmd >}}',
    ].join('\n'));
    await workspace.writeFile('blocks/intro.qmd', '# Introduction {#intro}\n\nbody');
    await workspace.writeFile('blocks/methods.qmd', '# Methods {#methods}\n\nm1');

    render(<BlockRail workspace={workspace} />);
    fireEvent.click(await screen.findByText('Introduction'));

    await waitFor(() => {
      const rows = document.querySelectorAll('.rail-row');
      expect(rows.length).toBe(2);
      expect(document.querySelector('.dimmed')).toBeDefined();
    });
  });
});