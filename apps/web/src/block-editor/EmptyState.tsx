/**
 * Empty-manuscript card: DEO preset chips that create their section in
 * one click, plus a '+ Custom section' button opening the add form.
 */
import { useState } from 'react';
import { AddBlockForm } from './AddBlockForm';
import type { BlockDraft } from './AddBlockForm';
import { sectionTypePresets } from './deo-types';

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
      <ul className="flex flex-wrap gap-2">
        {sectionTypePresets().map((preset) => (
          <li key={preset.shortName}>
            <button
              type="button"
              onClick={() =>
                onCreate({
                  title: preset.title,
                  short: preset.shortName,
                  type: preset.shortName,
                })
              }
              className={`rounded-full border px-3 py-1 text-sm hover:bg-gray-50 ${preset.class}`}
            >
              {preset.title}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
      >
        + Custom section
      </button>
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
