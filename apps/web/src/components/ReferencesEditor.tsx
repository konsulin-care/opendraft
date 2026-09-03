import { useState, useEffect } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';

interface ReferencesEditorProps {
  workspace: WorkspaceAdapter;
}

const REFERENCES_PATH = 'metadata/references.bib';

/**
 * Textarea editor for BibTeX references file.
 */
export function ReferencesEditor({ workspace }: ReferencesEditorProps) {
  const [content, setContent] = useState('');

  useEffect(() => {
    loadContent();
  }, [workspace]);

  async function loadContent() {
    const loaded = await workspace.readFile(REFERENCES_PATH) || '';
    setContent(loaded);
  }

  async function saveContent(newContent: string) {
    setContent(newContent);
    await workspace.writeFile(REFERENCES_PATH, newContent);
  }

  return (
    <div className="references-editor">
      <h3>References</h3>
      <label>references.bib</label>
      <textarea
        value={content}
        onChange={(e) => saveContent(e.target.value)}
        rows={12}
        placeholder="Enter BibTeX references..."
      />
    </div>
  );
}
