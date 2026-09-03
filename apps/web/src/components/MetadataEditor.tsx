import { useState, useEffect } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';

interface MetadataEditorProps {
  workspace: WorkspaceAdapter;
}

interface MetadataFile {
  name: string;
  path: string;
  content: string;
}

const METADATA_FILES = [
  { name: '_author.yml', path: 'metadata/_author.yml' },
  { name: '_abstract.yml', path: 'metadata/_abstract.yml' },
  { name: '_frontmatter.yml', path: 'metadata/_frontmatter.yml' },
];

/**
 * Textarea editor for YAML metadata files.
 */
export function MetadataEditor({ workspace }: MetadataEditorProps) {
  const [files, setFiles] = useState<MetadataFile[]>([]);

  useEffect(() => {
    loadFiles();
  }, [workspace]);

  async function loadFiles() {
    const loaded: MetadataFile[] = [];
    for (const file of METADATA_FILES) {
      const content = await workspace.readFile(file.path) || '';
      loaded.push({ name: file.name, path: file.path, content });
    }
    setFiles(loaded);
  }

  async function saveFile(index: number, content: string) {
    const file = files[index];
    await workspace.writeFile(file.path, content);
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, content } : f));
  }

  return (
    <div className="metadata-editor">
      <h3>Metadata</h3>
      {files.map((file, index) => (
        <div key={file.name} className="metadata-file">
          <label>{file.name}</label>
          <textarea
            value={file.content}
            onChange={(e) => saveFile(index, e.target.value)}
            rows={6}
            placeholder={`Enter ${file.name} content...`}
          />
        </div>
      ))}
    </div>
  );
}
