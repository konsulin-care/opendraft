import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DragHandle } from './DragHandle';

// @vitest-environment jsdom

describe('DragHandle', () => {
  it('renders drag handle button', () => {
    render(
      <DndContext>
        <DragHandle id="test-1" index={0} />
      </DndContext>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-label')).toContain('section 1');
  });
});
