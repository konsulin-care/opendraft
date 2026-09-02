import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Section, SectionDocument, SectionSplit, SectionMerge } from '@opendraft/editor';
import type { WorkspaceAdapter } from '@opendraft/workspace';

interface EditorProps {
  workspace: WorkspaceAdapter;
  manifestPath: string;
  initialContent?: string;
  onSave?: (content: string) => void;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

/**
 * WYSIWYG block editor component using TipTap with section-based semantics.
 *
 * @param workspace - Workspace adapter for file I/O
 * @param manifestPath - Path to manifest.json
 * @param initialContent - Optional initial HTML content
 * @param onSave - Callback when content changes
 * @param onEditorReady - Callback when editor instance is ready
 */
export function Editor({
  workspace: _workspace,
  manifestPath: _manifestPath,
  initialContent,
  onSave,
  onEditorReady,
}: EditorProps) {
  const editor = useEditor({
    extensions: [
      SectionDocument,
      Section,
      SectionSplit,
      SectionMerge,
      StarterKit.configure({ document: false }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: initialContent || '<div data-section><h1>Title</h1><p></p></div>',
    onUpdate: ({ editor: e }) => {
      if (onSave) {
        onSave(e.getHTML());
      }
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) {
    return <div className="editor-container">Loading editor...</div>;
  }

  return (
    <div className="editor-container">
      <EditorContent editor={editor} />
    </div>
  );
}

export default Editor;
