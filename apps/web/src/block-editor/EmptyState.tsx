/**
 * Empty-manuscript card embedding the shared SectionPicker: core role
 * chips create their section in one click, 'More options' reveals the
 * extended DEO roles, and 'Custom section' opens the add form.
 */
import { useState } from 'react';
import { AddBlockForm } from './AddBlockForm';
import type { BlockDraft } from './AddBlockForm';
import { SectionPicker } from './SectionPicker';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Create a block from a preset chip or the custom section form. */
  onCreate: (draft: BlockDraft) => void;
}

/** Card shown while the manuscript has no blocks yet. */
export function EmptyState({ onCreate }: EmptyStateProps) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4 rounded-md border border-gray-200 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Start your manuscript</h2>
        <p className="text-sm text-gray-600">
          Pick a section type below, or add a custom section.
        </p>
      </div>
      {/* Chips hand {title, short, role}; createAt reads title/short only. */}
      <SectionPicker
        onCreate={(draft) => onCreate(draft as BlockDraft)}
        onCustom={() => setAdding(true)}
      />
      {adding && (
        <AddBlockForm
          taken={[]}
          onCreate={onCreate}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
