// @vitest-environment jsdom
/**
 * New project dialog tests: the black Create accent required by the
 * metadata-editor overhaul. The name/id derivation and gating flow is
 * covered end-to-end in ProjectSwitcher.test.tsx.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewProjectDialog } from './NewProjectDialog';

describe('NewProjectDialog create button', () => {
  it('uses the black token for Create, not blue-600', () => {
    render(<NewProjectDialog onCreate={vi.fn()} onClose={vi.fn()} />);
    const create = screen.getByRole('button', { name: 'Create' });
    const classes = create.className.split(/\s+/);
    expect(classes).toContain('bg-black');
    expect(classes).toContain('text-white');
    expect(create.className).not.toMatch(/blue-600/);
  });
});
