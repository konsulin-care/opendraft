import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManuscriptWorkspace } from './ManuscriptWorkspace';
import { MemoryWorkspace } from '@opendraft/workspace';
import { seedWorkspace } from '../seed';

// @vitest-environment jsdom

describe('ManuscriptWorkspace rendering', () => {
  let workspace: MemoryWorkspace;

  beforeEach(async () => {
    workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);
  });

  it('renders workspace with sidebar tabs', () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    expect(screen.getAllByText('Blocks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Metadata').length).toBeGreaterThan(0);
    expect(screen.getAllByText('References').length).toBeGreaterThan(0);
  });

  it('mounts the continuous manuscript editor on the Blocks tab', () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    expect(screen.getByTestId('manuscript-editor')).toBeDefined();
  });
});